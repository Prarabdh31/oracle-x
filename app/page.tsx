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
    const standingsMap: Record<number, { points: number; nrr: number }> = {};
    const actualTop4 = new Set<number>();
    let actualBottomTeamId: number | null = null;

    actualStandings.forEach((standing) => {
      actualMap[standing.team_id] = standing.current_position;
      standingsMap[standing.team_id] = {
        points: standing.points || 0,
        nrr: standing.net_run_rate || 0,
      };
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

          // Battlefield Bonus — independent of multiplier
          const standingData = standingsMap[pred.team_id];
          if (standingData) {
            const tps = Math.max(0, standingData.points + standingData.nrr * 10);
            const delta = positionDifference;
            const pf = 1 / (1 + (delta * delta) / 2);
            totalScore += Math.round(tps * pf);
          }
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

    // Hide disqualified entries (no predictions submitted — score stays 0)
    const activeProfiles = calculatedProfiles.filter(p => (p.score || 0) > 0);
    setLeaderboard(activeProfiles);

    // Find Current User for Sticky Footer (search all profiles, not just active)
    if (currentUserId) {
      const loggedInUser = calculatedProfiles.find(p => p.id === currentUserId);
      if (loggedInUser) {
        // Rank among active (non-zero) players only
        const rankIndex = activeProfiles.findIndex(p => p.id === currentUserId);
        const rank = rankIndex >= 0 ? rankIndex + 1 : null;
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
          <div className="pt-8 pb-4">
            <div className="flex items-end justify-center gap-2">

              {/* Rank 2 — Silver (left) */}
              {top3[1] && (
                <Link href={`/team/${top3[1].id}`} className="flex flex-col items-center w-[29%] group">
                  <div className="flex flex-col items-center w-full px-1 mb-1">
                    <img src={top3[1].avatar_url || "/avatars/Hyena.png"}
                      className="w-14 h-14 rounded-full border-[3px] border-gray-400 object-cover bg-gray-900 shadow-[0_0_18px_rgba(156,163,175,0.4)] mb-2 group-hover:scale-105 transition-transform duration-200" />
                    <p className="font-black text-[11px] text-gray-200 text-center leading-tight w-full break-words">{top3[1].entry_name || top3[1].username}</p>
                    {top3[1].first_name && <p className="text-[9px] text-gray-500 font-semibold mt-0.5">{top3[1].first_name}</p>}
                    <div className="mt-1 flex flex-wrap gap-1 justify-center">{renderPowerBadges(top3[1])}</div>
                    <div className="mt-2 bg-gray-800/80 border border-gray-600/50 rounded-lg px-2 py-1 text-center w-full">
                      <p className="font-black text-sm text-gray-100 leading-none tabular-nums"><AnimatedScore score={top3[1].score || 0} /></p>
                      <p className="text-[7px] text-gray-500 font-black tracking-widest mt-0.5">PTS</p>
                    </div>
                  </div>
                  <div className="w-full h-12 rounded-t-xl bg-gradient-to-b from-gray-300 to-gray-500 flex items-center justify-center shadow-[0_-4px_16px_rgba(156,163,175,0.25)]">
                    <span className="font-black text-2xl text-white/80">2</span>
                  </div>
                </Link>
              )}

              {/* Rank 1 — Gold (center, tallest) */}
              {top3[0] && (
                <Link href={`/team/${top3[0].id}`} className="flex flex-col items-center w-[38%] group">
                  <svg className="w-5 h-5 text-yellow-400 mb-1 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  <div className="flex flex-col items-center w-full px-1 mb-1">
                    <img src={top3[0].avatar_url || "/avatars/Hyena.png"}
                      className="w-[72px] h-[72px] rounded-full border-[3px] border-yellow-500 object-cover bg-gray-900 shadow-[0_0_28px_rgba(234,179,8,0.6)] mb-2 group-hover:scale-105 transition-transform duration-200" />
                    <p className="font-black text-sm text-yellow-400 text-center leading-tight w-full break-words">{top3[0].entry_name || top3[0].username}</p>
                    {top3[0].first_name && <p className="text-[9px] text-gray-300 font-semibold mt-0.5">{top3[0].first_name} {top3[0].last_name}</p>}
                    <div className="mt-1 flex flex-wrap gap-1 justify-center">{renderPowerBadges(top3[0])}</div>
                    <div className="mt-2 bg-yellow-500/15 border border-yellow-500/40 rounded-xl px-3 py-1.5 text-center w-full">
                      <p className="font-black text-lg text-yellow-400 leading-none tabular-nums drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]"><AnimatedScore score={top3[0].score || 0} /></p>
                      <p className="text-[7px] text-yellow-600 font-black tracking-widest mt-0.5">PTS</p>
                    </div>
                  </div>
                  <div className="w-full h-20 rounded-t-xl bg-gradient-to-b from-yellow-400 to-yellow-600 flex items-center justify-center shadow-[0_-4px_24px_rgba(234,179,8,0.35)]">
                    <span className="font-black text-3xl text-black/60">1</span>
                  </div>
                </Link>
              )}

              {/* Rank 3 — Bronze (right) */}
              {top3[2] && (
                <Link href={`/team/${top3[2].id}`} className="flex flex-col items-center w-[29%] group">
                  <div className="flex flex-col items-center w-full px-1 mb-1">
                    <img src={top3[2].avatar_url || "/avatars/Hyena.png"}
                      className="w-14 h-14 rounded-full border-[3px] border-amber-600 object-cover bg-gray-900 shadow-[0_0_18px_rgba(217,119,6,0.4)] mb-2 group-hover:scale-105 transition-transform duration-200" />
                    <p className="font-black text-[11px] text-amber-400 text-center leading-tight w-full break-words">{top3[2].entry_name || top3[2].username}</p>
                    {top3[2].first_name && <p className="text-[9px] text-gray-500 font-semibold mt-0.5">{top3[2].first_name}</p>}
                    <div className="mt-1 flex flex-wrap gap-1 justify-center">{renderPowerBadges(top3[2])}</div>
                    <div className="mt-2 bg-amber-900/40 border border-amber-600/40 rounded-lg px-2 py-1 text-center w-full">
                      <p className="font-black text-sm text-amber-400 leading-none tabular-nums"><AnimatedScore score={top3[2].score || 0} /></p>
                      <p className="text-[7px] text-amber-700 font-black tracking-widest mt-0.5">PTS</p>
                    </div>
                  </div>
                  <div className="w-full h-7 rounded-t-xl bg-gradient-to-b from-amber-500 to-amber-700 flex items-center justify-center shadow-[0_-4px_12px_rgba(217,119,6,0.25)]">
                    <span className="font-black text-lg text-black/60">3</span>
                  </div>
                </Link>
              )}

            </div>
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

      {/* Sticky "Your Status" Footer — tappable, links to own team page */}
      {currentUser && (
        <div className="fixed bottom-28 left-0 right-0 p-3 z-40 flex justify-center pointer-events-none">
          <Link
            href={`/team/${currentUser.id}`}
            className="bg-blue-900/90 backdrop-blur-xl border border-blue-400/50 rounded-2xl p-3 max-w-sm w-full shadow-[0_0_30px_rgba(37,99,235,0.3)] flex items-center justify-between pointer-events-auto hover:bg-blue-800/90 hover:border-blue-300/70 hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-950 text-blue-400 w-8 h-8 rounded-full flex items-center justify-center font-black border border-blue-500/30 shrink-0">
                {(currentUser as any).rank ? `#${(currentUser as any).rank}` : `—`}
              </div>
              <img src={currentUser.avatar_url || "/avatars/Hyena.png"} className="w-10 h-10 rounded-full border border-blue-400 object-cover shrink-0" />
              <div>
                <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">Your Oracle</p>
                <p className="text-sm font-black text-white">{currentUser.entry_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-1">
              <div className="text-right">
                <p className="text-xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                  {currentUser.score}
                </p>
              </div>
              <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}