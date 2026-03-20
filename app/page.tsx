"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Link from "next/link";

interface Profile {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  entry_name?: string;
  avatar_url?: string;
  score?: number;
  fav_team_logo?: string | null;
  pwr_team_logo?: string | null;
}

// Custom Hook for Animated Score Counting
function AnimatedScore({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1500; // 1.5 seconds to count up
    const fps = 60;
    const increment = score / (duration / (1000 / fps));

    const timer = setInterval(() => {
      start += increment;
      if (start >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, 1000 / fps);

    return () => clearInterval(timer);
  }, [score]);

  return <>{displayScore}</>;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hypeText, setHypeText] = useState("CALCULATING ARENA...");

  useEffect(() => {
    fetchAndCalculateScores();
  }, []);

  const fetchAndCalculateScores = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    const [
      { data: profiles },
      { data: teamsData },
      { data: leaguePreds },
      { data: knockoutPreds },
      { data: actualStandings },
      { data: actualKnockoutsData },
      { data: settingsData }
    ] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("league_predictions").select("*"),
      supabase.from("knockout_predictions").select("*"),
      supabase.from("actual_standings").select("*"),
      supabase.from("actual_knockouts").select("*").eq("id", 1).maybeSingle(),
      supabase.from("system_settings").select("*").eq("id", 1).maybeSingle()
    ]);

    if (!profiles || !leaguePreds || !actualStandings || !teamsData) {
      setLoading(false);
      return;
    }

    // Privacy logic
    let revealed = false;
    if (settingsData) {
      const isPastDeadline = Date.now() >= new Date(settingsData.tournament_deadline).getTime();
      revealed = isPastDeadline || settingsData.unlock_team_view;
      setIsRevealed(revealed);
      setHypeText(isPastDeadline ? "TOURNAMENT LIVE - ARENA LOCKED" : "DRAFTING PHASE - PICKS SEALED");
    }

    const actualMap: Record<number, number> = {};
    const actualTop4 = new Set<number>();
    let actualBottomTeamId: number | null = null;

    actualStandings.forEach((standing) => {
      actualMap[standing.team_id] = standing.current_position;
      if (standing.current_position <= 4) actualTop4.add(standing.team_id);
      if (standing.current_position === 10) actualBottomTeamId = standing.team_id;
    });

    const calculatedProfiles = profiles.map((profile: Profile) => {
      let totalScore = 0;
      const userLeaguePreds = leaguePreds.filter((p) => p.user_id === profile.id);
      const userTop4 = new Set<number>();
      let userBottomTeamId: number | null = null;
      
      // Grab Fav and Power Teams for the UI
      const favPred = userLeaguePreds.find(p => p.multiplier === 2);
      const pwrPred = userLeaguePreds.find(p => p.multiplier === 3);
      const favTeamLogo = teamsData.find(t => t.id === favPred?.team_id)?.logo_url || null;
      const pwrTeamLogo = teamsData.find(t => t.id === pwrPred?.team_id)?.logo_url || null;

      userLeaguePreds.forEach((pred) => {
        if (pred.predicted_position <= 4) userTop4.add(pred.team_id);
        if (pred.predicted_position === 10) userBottomTeamId = pred.team_id;

        const actualPos = actualMap[pred.team_id];
        if (actualPos) {
          const positionDifference = Math.abs(actualPos - pred.predicted_position);
          const basePoints = 100 - (positionDifference * 10);
          totalScore += (basePoints * pred.multiplier);
        }
      });

      userTop4.forEach(teamId => {
        if (actualTop4.has(teamId)) totalScore += 50;
      });

      if (userBottomTeamId && userBottomTeamId === actualBottomTeamId) {
        totalScore += 50;
      }

      const userKnockout = knockoutPreds?.find((k) => k.user_id === profile.id);
      if (userKnockout && actualKnockoutsData) {
        const actualFinalists = [actualKnockoutsData.finalist_1_id, actualKnockoutsData.finalist_2_id].filter(Boolean);
        if (userKnockout.finalist_1_id && actualFinalists.includes(userKnockout.finalist_1_id)) totalScore += 100;
        if (userKnockout.finalist_2_id && actualFinalists.includes(userKnockout.finalist_2_id)) totalScore += 100;
        if (actualKnockoutsData.winner_id && userKnockout.winner_id === actualKnockoutsData.winner_id) totalScore += 200;
      }

      // Async save score in background
      supabase.from('profiles').update({ total_score: totalScore }).eq('id', profile.id).then();

      return { ...profile, score: totalScore, fav_team_logo: favTeamLogo, pwr_team_logo: pwrTeamLogo };
    });

    calculatedProfiles.sort((a, b) => (b.score || 0) - (a.score || 0));
    setLeaderboard(calculatedProfiles);
    
    // Find Current User for Sticky Footer
    if (currentUserId) {
      const loggedInUser = calculatedProfiles.find(p => p.id === currentUserId);
      if (loggedInUser) {
        // Find their actual rank (index + 1)
        const rank = calculatedProfiles.findIndex(p => p.id === currentUserId) + 1;
        setCurrentUser({ ...loggedInUser, rank } as any);
      }
    }

    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050814] text-cyan-500 font-black tracking-widest animate-pulse">BOOTING ARENA...</div>;

  const top3 = leaderboard.slice(0, 3);
  const restOfPack = leaderboard.slice(3);

  // Helper function to render the power badges
  const renderPowerBadges = (user: Profile) => {
    if (!isRevealed) {
      return (
        <div className="flex gap-1 mt-1">
           <span className="bg-gray-800/80 border border-gray-700 text-gray-500 text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><svg className="w-2 h-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg> SEALED</span>
        </div>
      );
    }
    return (
      <div className="flex gap-1.5 mt-1.5 items-center">
        {user.fav_team_logo && (
          <div className="flex items-center gap-1 bg-cyan-950/40 border border-cyan-500/30 px-1.5 py-0.5 rounded-md">
            <span className="text-[8px] font-black text-cyan-400">2x</span>
            <img src={user.fav_team_logo} alt="Fav" className="w-3 h-3 object-contain" />
          </div>
        )}
        {user.pwr_team_logo && (
          <div className="flex items-center gap-1 bg-yellow-950/40 border border-yellow-500/30 px-1.5 py-0.5 rounded-md">
            <span className="text-[8px] font-black text-yellow-500">3x</span>
            <img src={user.pwr_team_logo} alt="Pwr" className="w-3 h-3 object-contain" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050814] text-white pb-40 relative overflow-hidden">
      
      {/* Dynamic Header & Hype Bar */}
      <div className="sticky top-0 z-40 bg-[#050814]/90 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/oracle-logo.png" alt="Oracle X" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <span className="font-black text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">STANDINGS</span>
          </div>
        </div>
        <div className={`w-full py-1 text-center text-[10px] font-black tracking-[0.2em] ${isRevealed ? 'bg-red-900/40 text-red-500 border-b border-red-500/30' : 'bg-cyan-900/40 text-cyan-400 border-b border-cyan-500/30'}`}>
          {hypeText}
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 relative z-10">
        
        {/* THE PODIUM (Top 3) */}
        {top3.length > 0 && (
          <div className="flex justify-center items-end gap-3 pt-8 pb-10">
            {/* Rank 2 (Silver) */}
            {top3[1] && (
              <Link href={`/team/${top3[1].id}`} className="flex flex-col items-center group relative z-10 hover:-translate-y-1 transition-transform">
                <div className="text-xl font-black text-gray-300 mb-1 drop-shadow-[0_0_8px_rgba(209,213,219,0.5)]">2</div>
                <img src={top3[1].avatar_url || "/avatars/Hyena.png"} className="w-16 h-16 rounded-full border-4 border-gray-400 bg-gray-900 object-cover shadow-[0_0_20px_rgba(156,163,175,0.4)] mb-2" />
                <p className="font-bold text-sm text-center max-w-[80px] truncate">{top3[1].entry_name || top3[1].username}</p>
                {top3[1].first_name && <p className="text-[10px] text-gray-400 font-semibold">{top3[1].first_name} {top3[1].last_name?.charAt(0)}.</p>}
                {renderPowerBadges(top3[1])}
                <div className="mt-2 bg-gradient-to-t from-gray-400 to-gray-200 text-black px-3 py-1 rounded-lg font-black shadow-lg">
                  <AnimatedScore score={top3[1].score || 0} />
                </div>
              </Link>
            )}

            {/* Rank 1 (Gold) */}
            {top3[0] && (
              <Link href={`/team/${top3[0].id}`} className="flex flex-col items-center group relative z-20 mb-4 hover:-translate-y-1 transition-transform">
                <svg className="w-6 h-6 text-yellow-500 mb-1 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                <img src={top3[0].avatar_url || "/avatars/Hyena.png"} className="w-20 h-20 rounded-full border-4 border-yellow-500 bg-gray-900 object-cover shadow-[0_0_30px_rgba(234,179,8,0.6)] mb-2" />
                <p className="font-black text-base text-yellow-500 text-center max-w-[90px] truncate drop-shadow-md">{top3[0].entry_name || top3[0].username}</p>
                {top3[0].first_name && <p className="text-[10px] text-gray-300 font-bold">{top3[0].first_name} {top3[0].last_name}</p>}
                {renderPowerBadges(top3[0])}
                <div className="mt-2 bg-gradient-to-t from-yellow-600 to-yellow-400 text-black px-4 py-1.5 rounded-xl font-black text-xl shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                  <AnimatedScore score={top3[0].score || 0} />
                </div>
              </Link>
            )}

            {/* Rank 3 (Bronze) */}
            {top3[2] && (
              <Link href={`/team/${top3[2].id}`} className="flex flex-col items-center group relative z-10 hover:-translate-y-1 transition-transform">
                <div className="text-xl font-black text-amber-600 mb-1 drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]">3</div>
                <img src={top3[2].avatar_url || "/avatars/Hyena.png"} className="w-16 h-16 rounded-full border-4 border-amber-600 bg-gray-900 object-cover shadow-[0_0_20px_rgba(217,119,6,0.4)] mb-2" />
                <p className="font-bold text-sm text-center max-w-[80px] truncate">{top3[2].entry_name || top3[2].username}</p>
                {top3[2].first_name && <p className="text-[10px] text-gray-400 font-semibold">{top3[2].first_name} {top3[2].last_name?.charAt(0)}.</p>}
                {renderPowerBadges(top3[2])}
                <div className="mt-2 bg-gradient-to-t from-amber-700 to-amber-500 text-black px-3 py-1 rounded-lg font-black shadow-lg">
                  <AnimatedScore score={top3[2].score || 0} />
                </div>
              </Link>
            )}
          </div>
        )}

        {/* The Glass Arena (Ranks 4+) */}
        <div className="space-y-3">
          {restOfPack.map((user, index) => (
            <Link 
              href={`/team/${user.id}`}
              key={user.id} 
              className="bg-black/40 border border-white/5 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between transition-all hover:bg-white/5 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="flex items-center gap-4">
                <div className="text-xl font-black w-6 text-center text-gray-600">
                  {index + 4}
                </div>
                
                <img 
                  src={user.avatar_url || "/avatars/Hyena.png"} 
                  alt="Avatar" 
                  className="w-12 h-12 rounded-full border border-gray-700 object-cover bg-gray-900"
                />

                <div className="flex flex-col justify-center">
                  <p className="font-bold text-white text-base leading-tight">{user.entry_name || user.username}</p>
                  {user.first_name && <p className="text-[10px] text-gray-400 font-medium">{user.first_name} {user.last_name}</p>}
                  {renderPowerBadges(user)}
                </div>
              </div>

              <div className="text-right">
                <p className="text-2xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                  <AnimatedScore score={user.score || 0} />
                </p>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">PTS</p>
              </div>
            </Link>
          ))}
          
          {leaderboard.length === 0 && (
            <div className="text-center p-8 bg-black/40 rounded-2xl border border-white/5 text-gray-500 font-semibold">
              The Arena is currently empty.
            </div>
          )}
        </div>
      </div>

      {/* Sticky "Your Status" Footer */}
      {currentUser && (
        <div className="fixed bottom-28 left-0 right-0 p-3 z-40 flex justify-center pointer-events-none">
          <div className="bg-blue-900/90 backdrop-blur-xl border border-blue-400/50 rounded-2xl p-3 max-w-sm w-full shadow-[0_0_30px_rgba(37,99,235,0.3)] flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="bg-blue-950 text-blue-400 w-8 h-8 rounded-full flex items-center justify-center font-black border border-blue-500/30">
                #{(currentUser as any).rank}
              </div>
              <img src={currentUser.avatar_url || "/avatars/Hyena.png"} className="w-10 h-10 rounded-full border border-blue-400 object-cover" />
              <div>
                <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">Your Oracle</p>
                <p className="text-sm font-black text-white">{currentUser.entry_name}</p>
              </div>
            </div>
            <div className="text-right pr-2">
              <p className="text-xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                {currentUser.score}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}