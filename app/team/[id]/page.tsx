"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Team {
  id: number;
  name: string;
  short_name: string;
  logo_url: string;
}

interface Profile {
  entry_name: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url: string;
  total_score: number;
}

interface PointBreakdown {
  liveRank: number | null;
  predictedRank: number;
  basePoints: number;
  penalty: number;
  subtotal: number;
  multiplier: number;
  multipliedTotal: number;
  bonus: number;
  bonusReason: string | null;
  finalRowPoints: number;
}

interface RankedTeam extends Team {
  breakdown: PointBreakdown;
}

export default function OpponentTeamPage() {
  const { id: userId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rankedTeams, setRankedTeams] = useState<RankedTeam[]>([]);
  const [knockouts, setKnockouts] = useState<any>(null);
  const [actualKnockouts, setActualKnockouts] = useState<any>(null);
  
  // Modal State
  const [selectedTeam, setSelectedTeam] = useState<RankedTeam | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetchOpponentData();
  }, [userId]);

  const fetchOpponentData = async () => {
    // 1. Grab the currently logged-in user's session FIRST
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    const [
      { data: profData },
      { data: teamsData },
      { data: leagueData },
      { data: knockoutData },
      { data: actualStandings },
      { data: actualKnockoutsData },
      { data: settingsData }
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("teams").select("*"),
      supabase.from("league_predictions").select("*").eq("user_id", userId),
      supabase.from("knockout_predictions").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("actual_standings").select("*"),
      supabase.from("actual_knockouts").select("*").eq("id", 1).maybeSingle(),
      supabase.from("system_settings").select("*").eq("id", 1).maybeSingle()
    ]);

    if (!profData || !teamsData || !leagueData) {
      setError("Could not find this Oracle's team or predictions.");
      setLoading(false);
      return;
    }

    if (settingsData) {
      const isPastDeadline = Date.now() >= new Date(settingsData.tournament_deadline).getTime();
      
      // 2. THE BYPASS: Reveal if past deadline, OR if admin unlocked, OR if looking at YOUR OWN team
      if (isPastDeadline || settingsData.unlock_team_view || currentUserId === userId) {
        setIsRevealed(true);
      } else {
        setIsRevealed(false);
        setLoading(false);
        return; 
      }
    }

    setProfile(profData);
    setActualKnockouts(actualKnockoutsData);

    // Map Actual Standings
    const actualMap: Record<number, number> = {};
    const actualTop4 = new Set<number>();
    let actualBottomTeamId: number | null = null;

    if (actualStandings) {
      actualStandings.forEach((standing) => {
        actualMap[standing.team_id] = standing.current_position;
        if (standing.current_position <= 4) actualTop4.add(standing.team_id);
        if (standing.current_position === 10) actualBottomTeamId = standing.team_id;
      });
    }

    // Determine user's Top 4 and Bottom Team
    const userTop4 = new Set<number>();
    let userBottomTeamId: number | null = null;
    leagueData.forEach(pred => {
      if (pred.predicted_position <= 4) userTop4.add(pred.team_id);
      if (pred.predicted_position === 10) userBottomTeamId = pred.team_id;
    });

    // Process each team and calculate row-level points
    const processedTeams: RankedTeam[] = leagueData.map(pred => {
      const team = teamsData.find(t => t.id === pred.team_id);
      const liveRank = actualMap[pred.team_id] || null;
      
      let penalty = 0;
      let subtotal = 0;
      let multipliedTotal = 0;
      let bonus = 0;
      let bonusReason = null;
      
      if (liveRank !== null) {
        const diff = Math.abs(liveRank - pred.predicted_position);
        penalty = diff * 10;
        subtotal = 100 - penalty;
        multipliedTotal = subtotal * pred.multiplier;
        
        if (pred.predicted_position <= 4 && actualTop4.has(pred.team_id)) {
          bonus += 50;
          bonusReason = "Top 4 Correct";
        }
        if (pred.predicted_position === 10 && actualBottomTeamId === pred.team_id) {
          bonus += 50;
          bonusReason = "10th Place Correct";
        }
      }

      const finalRowPoints = multipliedTotal + bonus;

      return {
        ...team,
        breakdown: {
          liveRank,
          predictedRank: pred.predicted_position,
          basePoints: liveRank ? 100 : 0,
          penalty,
          subtotal,
          multiplier: pred.multiplier,
          multipliedTotal,
          bonus,
          bonusReason,
          finalRowPoints
        }
      };
    }).sort((a, b) => a.breakdown.predictedRank - b.breakdown.predictedRank);

    setRankedTeams(processedTeams);

    if (knockoutData) {
      const findTeam = (id: number) => teamsData.find(t => t.id === id);
      setKnockouts({
        finalist1: findTeam(knockoutData.finalist_1_id),
        finalist2: findTeam(knockoutData.finalist_2_id),
        winner: findTeam(knockoutData.winner_id),
      });
    }

    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050814] text-cyan-500 font-black tracking-widest animate-pulse">DECRYPTING INTEL...</div>;

  if (!isRevealed) {
    return (
      <div className="min-h-screen bg-[#050814] text-white p-6 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-red-900/20 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h1 className="text-3xl font-black mb-3 text-red-500 tracking-widest">DOSSIER SEALED</h1>
        <p className="text-gray-400 max-w-xs mb-8">This Oracle's predictions are highly classified until the tournament officially begins.</p>
        <Link href="/" className="bg-gray-900 border border-gray-700 px-8 py-4 rounded-xl text-white font-bold hover:bg-gray-800 hover:border-cyan-500 transition-all shadow-lg">
          RETURN TO STANDINGS
        </Link>
      </div>
    );
  }

  if (error || !profile) return <div className="min-h-screen flex items-center justify-center bg-[#050814] text-red-500 font-black">{error || "Error"}</div>;

  // Helpers for knockout points
  const actualFinalists = actualKnockouts ? [actualKnockouts.finalist_1_id, actualKnockouts.finalist_2_id].filter(Boolean) : [];
  const gotF1 = actualFinalists.includes(knockouts?.finalist1?.id);
  const gotF2 = actualFinalists.includes(knockouts?.finalist2?.id);
  const gotWinner = actualKnockouts?.winner_id && actualKnockouts.winner_id === knockouts?.winner?.id;

  return (
    <div className="min-h-screen bg-[#050814] text-white pb-32 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-900/10 blur-[150px] pointer-events-none rounded-full"></div>

      <div className="max-w-md mx-auto p-4 relative z-10">
        
        {/* HERO DOSSIER */}
        <div className="bg-black/40 border border-white/10 rounded-3xl p-6 mb-6 mt-4 flex items-center gap-5 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-5 text-9xl font-black pointer-events-none transform -rotate-12">INTEL</div>
          <img src={profile.avatar_url || "/avatars/Hyena.png"} alt="Avatar" className="w-20 h-20 rounded-full bg-gray-900 border-2 border-cyan-500 object-cover shadow-[0_0_20px_rgba(6,182,212,0.4)] relative z-10" />
          <div className="relative z-10">
            <h1 className="text-2xl font-black text-white leading-tight">{profile.entry_name || profile.username}</h1>
            {profile.first_name && <p className="text-xs text-cyan-400 font-bold tracking-widest uppercase mb-2">{profile.first_name} {profile.last_name}</p>}
            <div className="inline-block bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-black px-3 py-1.5 rounded-lg border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              TOTAL: {profile.total_score} PTS
            </div>
          </div>
        </div>

        {/* ANALYTICAL LIST HEADER */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-900/80 border border-gray-800 rounded-lg mb-3 text-[10px] font-black text-gray-500 tracking-widest uppercase">
          <div className="flex gap-4">
            <span className="w-8 text-center">LIVE</span>
            <span className="w-8 text-center text-cyan-500">YOUR</span>
            <span className="ml-2">TEAM</span>
          </div>
          <span>POINTS</span>
        </div>

        {/* TEAM ROWS */}
        <div className="space-y-3 mb-10">
          {rankedTeams.map((team, index) => {
            const isFav = team.breakdown.multiplier === 2;
            const isPower = team.breakdown.multiplier === 3;
            const isPlayoff = index < 4;
            
            let containerStyle = "border-2 border-gray-800/80 bg-black/40 hover:bg-gray-900/80";
            if (isFav) containerStyle = "fav-moving-border cursor-pointer";
            else if (isPower) containerStyle = "pwr-moving-border cursor-pointer";
            else if (isPlayoff) containerStyle = "border-2 border-blue-500/30 bg-black/40 hover:bg-gray-900/80 cursor-pointer";

            return (
              <div 
                key={team.id} 
                onClick={() => setSelectedTeam(team)}
                className={`relative flex items-center justify-between p-2 rounded-xl transition-all duration-200 cursor-pointer ${containerStyle}`}
              >
                <div className="flex items-center gap-3 w-full">
                  {/* Rank Comparison Boxes */}
                  <div className="flex gap-2 shrink-0">
                    <div className="w-8 h-10 flex flex-col items-center justify-center bg-red-600/20 border border-red-500/50 rounded-md">
                      <span className="text-xs font-black text-red-500">{team.breakdown.liveRank || "-"}</span>
                      <span className="text-[8px] text-red-400/70 font-bold">LIVE</span>
                    </div>
                    <div className="w-8 h-10 flex flex-col items-center justify-center bg-cyan-900/30 border border-cyan-500/50 rounded-md shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                      <span className="text-xs font-black text-cyan-400">{team.breakdown.predictedRank}</span>
                      <span className="text-[8px] text-cyan-400/70 font-bold">PICK</span>
                    </div>
                  </div>

                  {/* Team Info */}
                  <div className="flex items-center gap-2 flex-grow overflow-hidden">
                    <img src={team.logo_url} alt={team.short_name} className="w-7 h-7 object-contain" />
                    <div className="flex flex-col">
                      <p className="font-bold text-white text-sm truncate">{team.short_name}</p>
                      <div className="flex gap-1 mt-0.5">
                        {isFav && <span className="text-[8px] font-black bg-cyan-500 text-black px-1.5 py-0.5 rounded shadow-[0_0_5px_rgba(6,182,212,0.8)]">2x FAV</span>}
                        {isPower && <span className="text-[8px] font-black bg-yellow-500 text-black px-1.5 py-0.5 rounded shadow-[0_0_5px_rgba(234,179,8,0.8)]">3x PWR</span>}
                      </div>
                    </div>
                  </div>

                  {/* Row Points */}
                  <div className="text-right shrink-0 pr-2">
                    <p className="text-lg font-black text-white">{team.breakdown.finalRowPoints}</p>
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest -mt-1">PTS</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* KNOCKOUT ARENA */}
        {knockouts && (
          <div className="bg-black/40 border border-white/5 rounded-3xl p-6 mb-6 relative overflow-hidden">
            <h2 className="text-xl font-black mb-6 text-center text-white tracking-widest uppercase">Final Battle Intel</h2>
            
            <div className="relative border border-gray-800/80 rounded-2xl p-5 mb-8 bg-gray-900/50">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#050814] px-3 text-[10px] text-gray-500 uppercase font-black tracking-widest border border-gray-800 rounded-full">Finalists</span>
                <div className="flex items-center justify-between gap-3 text-center">
                    <div className="flex flex-col items-center gap-2 w-1/2 relative">
                        {gotF1 && <span className="absolute -top-3 -right-2 bg-green-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.6)] z-10">+100</span>}
                        <img src={knockouts.finalist1?.logo_url} alt="" className="w-10 h-10 object-contain drop-shadow-lg" />
                        <p className="font-bold text-sm text-gray-300">{knockouts.finalist1?.short_name}</p>
                    </div>
                    <div className="text-lg font-black text-cyan-900/60 flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div className="flex flex-col items-center gap-2 w-1/2 relative">
                        {gotF2 && <span className="absolute -top-3 -left-2 bg-green-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.6)] z-10">+100</span>}
                        <img src={knockouts.finalist2?.logo_url} alt="" className="w-10 h-10 object-contain drop-shadow-lg" />
                        <p className="font-bold text-sm text-gray-300">{knockouts.finalist2?.short_name}</p>
                    </div>
                </div>
            </div>

            <div className="text-center bg-gradient-to-b from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-2xl p-6 relative">
                {gotWinner && <span className="absolute -top-3 right-4 bg-green-500 text-black text-[12px] font-black px-3 py-1 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.8)] z-10">+200 PTS</span>}
                <svg className="w-6 h-6 text-yellow-500 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                <p className="text-[10px] text-yellow-500/80 font-black uppercase tracking-widest mb-3">Predicted Champion</p>
                <img src={knockouts.winner?.logo_url} alt="" className="w-16 h-16 object-contain mx-auto mb-2 drop-shadow-xl" />
                <p className="text-xl font-black text-white">{knockouts.winner?.short_name}</p>
            </div>
          </div>
        )}
        
        {/* Floating Return Button */}
        <div className="fixed bottom-28 left-0 right-0 p-4 bg-gradient-to-t from-[#050814] via-[#050814]/90 to-transparent z-40 pb-safe">
          <Link href="/" className="w-full max-w-md mx-auto flex items-center justify-center py-4 font-black tracking-wide rounded-2xl bg-gray-900 border border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white transition-all shadow-2xl">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            BACK TO GLOBAL STANDINGS
          </Link>
        </div>
      </div>

      {/* DRILLDOWN MODAL (Math Inspector) */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedTeam(null)}>
          <div className="bg-[#0f1423] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4">
              <img src={selectedTeam.logo_url} className="w-12 h-12 object-contain" />
              <div>
                <h3 className="text-xl font-black text-white">{selectedTeam.name}</h3>
                <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">Point Inspector</p>
              </div>
            </div>

            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center text-gray-300">
                <span>Base Points</span>
                <span className="font-bold">{selectedTeam.breakdown.basePoints}</span>
              </div>
              
              <div className="flex justify-between items-center text-red-400">
                <span>Rank Penalty <span className="text-[10px] text-gray-500">({Math.abs((selectedTeam.breakdown.liveRank || 0) - selectedTeam.breakdown.predictedRank)} off)</span></span>
                <span className="font-bold">-{selectedTeam.breakdown.penalty}</span>
              </div>

              <div className="flex justify-between items-center text-gray-300 border-t border-white/5 pt-2">
                <span>Subtotal</span>
                <span className="font-bold text-white">{selectedTeam.breakdown.subtotal}</span>
              </div>

              {selectedTeam.breakdown.multiplier > 1 && (
                <div className={`flex justify-between items-center font-bold ${selectedTeam.breakdown.multiplier === 3 ? 'text-yellow-500' : 'text-cyan-400'}`}>
                  <span>Multiplier Applied</span>
                  <span>x{selectedTeam.breakdown.multiplier}</span>
                </div>
              )}

              {selectedTeam.breakdown.bonus > 0 && (
                <div className="flex justify-between items-center text-green-400 font-bold">
                  <span>Bonus <span className="text-[10px] text-green-500/60">({selectedTeam.breakdown.bonusReason})</span></span>
                  <span>+{selectedTeam.breakdown.bonus}</span>
                </div>
              )}

              <div className="flex justify-between items-center border-t border-white/20 pt-3 mt-2 text-lg font-black text-white">
                <span>FINAL POINTS</span>
                <span>{selectedTeam.breakdown.finalRowPoints}</span>
              </div>
            </div>

            <button onClick={() => setSelectedTeam(null)} className="w-full mt-8 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors tracking-widest uppercase text-sm">
              Close Report
            </button>
          </div>
        </div>
      )}

      {/* Required moving borders CSS (Preserved from Draft Page) */}
      <style jsx global>{`
        @keyframes flow-energy {
          0% { background-position: 0% 0%, 0% 50%; }
          100% { background-position: 0% 0%, 200% 50%; }
        }
        .fav-moving-border {
          border: 2px solid transparent;
          background: linear-gradient(#000000, #000000) padding-box, linear-gradient(90deg, #06B6D4, #022C22, #06B6D4, #022C22, #06B6D4) border-box;
          background-size: 100% 100%, 200% 100%;
          animation: flow-energy 2s linear infinite;
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);
        }
        .pwr-moving-border {
          border: 2px solid transparent;
          background: linear-gradient(#000000, #000000) padding-box, linear-gradient(90deg, #EAB308, #422006, #EAB308, #422006, #EAB308) border-box;
          background-size: 100% 100%, 200% 100%;
          animation: flow-energy 2s linear infinite;
          box-shadow: 0 0 15px rgba(234, 179, 8, 0.2);
        }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
      `}</style>
    </div>
  );
}