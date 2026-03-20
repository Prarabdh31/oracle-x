"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface TeamStanding {
  id: number;
  name: string;
  short_name: string;
  logo_url: string;
  current_position: number;
  matches_played: number;
  wins: number;
  losses: number;
  no_results: number;
  net_run_rate: number;
  points: number;
}

interface KnockoutReality {
  finalist1: TeamStanding | null;
  finalist2: TeamStanding | null;
  winner: TeamStanding | null;
}

export default function LiveTablePage() {
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [knockouts, setKnockouts] = useState<KnockoutReality | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveTable();
  }, []);

  const fetchLiveTable = async () => {
    const [
      { data: teamsData },
      { data: standingsData },
      { data: knockoutsData }
    ] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("actual_standings").select("*"),
      supabase.from("actual_knockouts").select("*").eq("id", 1).maybeSingle()
    ]);

    if (teamsData && standingsData) {
      const merged: TeamStanding[] = teamsData.map((team) => {
        const stats = standingsData.find((s) => s.team_id === team.id);
        return {
          id: team.id,
          name: team.name,
          short_name: team.short_name,
          logo_url: team.logo_url,
          current_position: stats?.current_position || 99,
          matches_played: stats?.matches_played || 0,
          wins: stats?.wins || 0,
          losses: stats?.losses || 0,
          no_results: stats?.no_results || 0,
          net_run_rate: stats?.net_run_rate || 0,
          points: stats?.points || 0,
        };
      }).sort((a, b) => a.current_position - b.current_position);
      
      setStandings(merged);

      if (knockoutsData) {
        const findTeam = (id: number | null) => merged.find(t => t.id === id) || null;
        setKnockouts({
          finalist1: findTeam(knockoutsData.finalist_1_id),
          finalist2: findTeam(knockoutsData.finalist_2_id),
          winner: findTeam(knockoutsData.winner_id),
        });
      }
    }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050814] text-cyan-500 font-black tracking-widest animate-pulse">CONNECTING TO LIVE FEED...</div>;

  return (
    <div className="min-h-screen bg-[#050814] text-white pb-32 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-900/10 blur-[150px] pointer-events-none rounded-full"></div>

      {/* Broadcast Header */}
      <div className="sticky top-0 z-40 bg-[#050814]/90 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2">
          <img src="/oracle-logo.png" alt="Oracle X" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span className="font-black text-lg tracking-wider text-white drop-shadow-md">LIVE STANDINGS</span>
        </div>
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.2)]">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,1)]"></div>
          <span className="text-[10px] font-black tracking-widest text-red-400">OFFICIAL</span>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 relative z-10 mt-2">
        
        {/* Table Column Headers */}
        <div className="flex items-center justify-end px-3 py-2 mb-2 text-[9px] font-black text-gray-500 tracking-widest uppercase">
          <div className="flex gap-3 text-center mr-4">
            <span className="w-4">P</span>
            <span className="w-4">W</span>
            <span className="w-4">L</span>
            <span className="w-8">NRR</span>
          </div>
          <span className="w-8 text-right text-cyan-500 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">PTS</span>
        </div>

        {/* Live League Table */}
        <div className="space-y-2.5 mb-10">
          {standings.map((team, index) => {
            const isPlayoff = index < 4;
            const isLast = index === 9; // 10th place

            // Determine dynamic row styling
            let containerStyle = "bg-black/50 border-white/5";
            let rankStyle = "text-gray-500";
            
            if (isPlayoff) {
              containerStyle = "bg-blue-950/20 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)]";
              rankStyle = "text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]";
            } else if (isLast) {
              containerStyle = "bg-red-950/20 border-red-900/50";
              rankStyle = "text-red-500/70";
            }

            return (
              <div 
                key={team.id} 
                className={`relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${containerStyle}`}
              >
                {/* Visual Indicators */}
                {isPlayoff && (
                  <div className="absolute top-0 left-0 bg-blue-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded-br-lg rounded-tl-xl shadow-[0_0_5px_rgba(59,130,246,0.5)] z-10 tracking-widest uppercase">
                    Playoff Zone
                  </div>
                )}
                {isLast && (
                  <div className="absolute top-0 right-0 bg-red-900/80 text-red-200 text-[7px] font-black px-1.5 py-0.5 rounded-bl-lg rounded-tr-xl border-b border-l border-red-500/30 z-10 tracking-widest uppercase">
                    Danger
                  </div>
                )}

                {/* Left: Rank & Team */}
                <div className="flex items-center gap-3 w-[45%]">
                  <span className={`text-xl font-black w-5 text-center ${rankStyle}`}>
                    {team.current_position}
                  </span>
                  <div className="relative">
                    <img src={team.logo_url} alt={team.short_name} className="w-9 h-9 object-contain drop-shadow-lg" />
                    {isPlayoff && <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-md -z-10"></div>}
                  </div>
                  <p className="font-bold text-white text-sm tracking-wide">{team.short_name}</p>
                </div>

                {/* Right: The Broadcast Stats Grid */}
                <div className="flex items-center justify-end w-[55%] font-mono text-sm">
                  <div className="flex gap-3 text-center text-gray-300 mr-4">
                    <span className="w-4">{team.matches_played}</span>
                    <span className="w-4 font-bold text-white">{team.wins}</span>
                    <span className="w-4 text-gray-500">{team.losses}</span>
                    <span className={`w-8 text-[11px] font-bold ${team.net_run_rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {team.net_run_rate > 0 ? '+' : ''}{team.net_run_rate.toFixed(3)}
                    </span>
                  </div>
                  <div className={`w-8 text-right text-xl font-black ${isPlayoff ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'text-white drop-shadow-md'}`}>
                    {team.points}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Knockout Status Panel */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-yellow-500/10 blur-[50px] pointer-events-none"></div>
          
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Tournament Status
          </h2>

          {knockouts?.finalist1 || knockouts?.finalist2 ? (
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between gap-3 text-center bg-gray-900/50 border border-white/10 p-4 rounded-2xl relative">
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#050814] px-3 text-[9px] text-gray-500 uppercase font-black tracking-widest border border-white/10 rounded-full">The Finals</span>
                  
                  <div className="flex flex-col items-center gap-2 w-[40%]">
                      {knockouts.finalist1 ? (
                        <>
                          <img src={knockouts.finalist1.logo_url} className="w-12 h-12 object-contain drop-shadow-lg" />
                          <p className="font-bold text-sm text-white">{knockouts.finalist1.short_name}</p>
                        </>
                      ) : (
                        <div className="w-12 h-12 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-600 font-black text-xs">TBD</div>
                      )}
                  </div>
                  
                  <div className="text-xl font-black text-gray-600 italic">VS</div>
                  
                  <div className="flex flex-col items-center gap-2 w-[40%]">
                      {knockouts.finalist2 ? (
                        <>
                          <img src={knockouts.finalist2.logo_url} className="w-12 h-12 object-contain drop-shadow-lg" />
                          <p className="font-bold text-sm text-white">{knockouts.finalist2.short_name}</p>
                        </>
                      ) : (
                        <div className="w-12 h-12 rounded-full border border-dashed border-gray-600 flex items-center justify-center text-gray-600 font-black text-xs">TBD</div>
                      )}
                  </div>
              </div>

              {knockouts.winner && (
                <div className="text-center bg-gradient-to-b from-yellow-500/10 to-transparent border border-yellow-500/30 rounded-2xl p-6 relative shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                    <svg className="w-8 h-8 text-yellow-500 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>
                    <p className="text-[10px] text-yellow-500/80 font-black uppercase tracking-widest mb-3">Official Champion</p>
                    <img src={knockouts.winner.logo_url} alt="" className="w-20 h-20 object-contain mx-auto mb-2 drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]" />
                    <p className="text-2xl font-black text-white drop-shadow-md">{knockouts.winner.name}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500 font-semibold border border-dashed border-gray-700 rounded-2xl relative z-10 bg-black/20">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <p>Playoff bracket currently undetermined.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}