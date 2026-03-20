"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// 39 Final Avatars
const PREMADE_AVATARS = [
  "Cheetah","Dog","Hippo","Parrot","Lion","Rabbit","Koala","Elephant","Zebra",
  "Fox","Monkey","Otter","Pig","Peacock","Shiba","Bear","Cow","Owl","Horse",
  "Tiger","Racoon","Jaguar","Goat","Penguin","Wolf","Eagle","Mouse","Kangaroo",
  "Bull","Gorilla","Cat","Anteater","Sheep","Deer","Ostrich","Panda","Hyena",
  "Crocodile","Giraffe"
].map(name => `/avatars/${name}.png`);

interface TeamBlock {
  team_id: number;
  name: string;
  short_name: string;
  logo_url: string;
  predictedRank: number;
  multiplier: number;
  pointsEarned: number;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [entryName, setEntryName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [totalPoints, setTotalPoints] = useState(0);
  
  const [predictedTeams, setPredictedTeams] = useState<TeamBlock[]>([]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    fetchProfileAndData();
  }, []);

  const fetchProfileAndData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const userId = session.user.id;
    setUserEmail(session.user.email || "");

    const [
      { data: profileData },
      { data: teamsData },
      { data: leagueData },
      { data: actualStandings }
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("teams").select("*"),
      supabase.from("league_predictions").select("*").eq("user_id", userId),
      supabase.from("actual_standings").select("*")
    ]);

    if (profileData) {
      setFirstName(profileData.first_name || "");
      setLastName(profileData.last_name || "");
      setEntryName(profileData.entry_name || profileData.username || "");
      setSelectedAvatar(profileData.avatar_url || PREMADE_AVATARS[0]);
      setTotalPoints(profileData.total_score || 0);
    }

    // Calculate block points if predictions exist
    if (teamsData && leagueData && leagueData.length > 0) {
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

      const blocks: TeamBlock[] = leagueData.map(pred => {
        const team = teamsData.find(t => t.id === pred.team_id);
        const liveRank = actualMap[pred.team_id] || null;
        let finalRowPoints = 0;

        if (liveRank !== null) {
          const diff = Math.abs(liveRank - pred.predicted_position);
          let subtotal = 100 - (diff * 10);
          let multipliedTotal = subtotal * pred.multiplier;
          
          let bonus = 0;
          if (pred.predicted_position <= 4 && actualTop4.has(pred.team_id)) bonus += 50;
          if (pred.predicted_position === 10 && actualBottomTeamId === pred.team_id) bonus += 50;
          
          finalRowPoints = multipliedTotal + bonus;
        }

        return {
          team_id: team.id,
          name: team.name,
          short_name: team.short_name,
          logo_url: team.logo_url,
          predictedRank: pred.predicted_position,
          multiplier: pred.multiplier,
          pointsEarned: finalRowPoints
        };
      }).sort((a, b) => a.predictedRank - b.predictedRank);

      setPredictedTeams(blocks);
    }

    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          entry_name: entryName,
          avatar_url: selectedAvatar,
        })
        .eq("id", session.user.id);

      if (error) throw error;
      alert("Identity Updated Successfully! Returning to Arena.");
    } catch (error: any) {
      console.error("Update error:", error);
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050814] text-cyan-500 font-black tracking-widest animate-pulse">LOADING COMMAND CENTER...</div>;

  return (
    <div className="min-h-screen bg-[#050814] text-white pb-32 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-900/10 blur-[120px] pointer-events-none rounded-full"></div>
      
      {/* Global Header */}
      <div className="sticky top-0 z-40 bg-[#050814]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/oracle-logo.png" alt="Oracle X" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span className="font-black text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">ORACLE COMMAND</span>
        </div>
        <button onClick={handleLogout} className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </div>

      <div className="max-w-md mx-auto p-4 relative z-10">
        
        {/* Holographic ID Badge (Hero) */}
        <div className="flex flex-col items-center mt-6 mb-10">
          <div 
            onClick={() => setShowAvatarModal(true)}
            className="relative group cursor-pointer mb-4"
          >
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full group-hover:bg-cyan-500/40 transition-all duration-300"></div>
            <img 
              src={selectedAvatar} 
              alt="Avatar" 
              className="relative w-28 h-28 rounded-full border-4 border-cyan-500 object-cover bg-gray-900 shadow-[0_0_25px_rgba(6,182,212,0.5)] z-10"
            />
            {/* Edit Overlay */}
            <div className="absolute inset-0 z-20 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 border-4 border-transparent">
              <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black border border-cyan-500 text-cyan-400 text-[9px] font-black px-2 py-0.5 rounded-full z-30 uppercase tracking-widest whitespace-nowrap shadow-[0_0_10px_rgba(6,182,212,0.5)] group-hover:bg-cyan-500 group-hover:text-black transition-colors">
              Change Avatar
            </div>
          </div>
          
          <h1 className="text-3xl font-black text-white text-center leading-tight drop-shadow-md">{entryName || "Anonymous Oracle"}</h1>
          {(firstName || lastName) && <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">{firstName} {lastName}</p>}
          <p className="text-[10px] text-gray-600 font-semibold mt-1">{userEmail}</p>

          <div className="mt-4 flex items-center gap-2 bg-gradient-to-r from-gray-900 to-black border border-gray-800 px-6 py-2 rounded-2xl shadow-xl">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">Total Intel</span>
            <span className="text-xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">{totalPoints} PTS</span>
          </div>
        </div>

        {/* The "Oracle Table" (Active Prediction Grid) */}
        {predictedTeams.length > 0 && (
          <div className="mb-10">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              Active Draft Roster
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {predictedTeams.map((pred) => {
                const isFav = pred.multiplier === 2;
                const isPower = pred.multiplier === 3;
                return (
                  <div key={pred.team_id} className="bg-black/40 border border-white/5 backdrop-blur-md rounded-xl p-2 flex flex-col items-center justify-between relative overflow-hidden shadow-lg aspect-square">
                    {/* Position Label */}
                    <div className="absolute top-0 left-0 bg-gray-800 text-gray-300 text-[10px] font-black px-1.5 py-0.5 rounded-br-lg border-b border-r border-white/10 z-10">
                      {pred.predictedRank}
                      <span className="text-[8px] align-top">{pred.predictedRank === 1 ? 'st' : pred.predictedRank === 2 ? 'nd' : pred.predictedRank === 3 ? 'rd' : 'th'}</span>
                    </div>
                    
                    {/* Multiplier Badges */}
                    {isFav && <div className="absolute top-0 right-0 bg-cyan-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-[0_0_10px_rgba(6,182,212,0.8)] z-10">2x FAV</div>}
                    {isPower && <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-[0_0_10px_rgba(234,179,8,0.8)] z-10">3x PWR</div>}
                    
                    {/* Content */}
                    <img src={pred.logo_url} alt={pred.short_name} className="w-10 h-10 object-contain mt-4 drop-shadow-md" />
                    
                    <div className="w-full text-center mt-1">
                      <div className="bg-gray-900/80 border-t border-white/5 py-1 w-full flex flex-col items-center">
                        <span className="text-[10px] font-bold text-white leading-none mb-0.5">{pred.short_name}</span>
                        <span className="text-[10px] font-black text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">{pred.pointsEarned} PTS</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cyberpunk Identity Settings */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-32 h-32 bg-blue-600/10 blur-[40px] rounded-full pointer-events-none"></div>
          
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            System Identity
          </h2>
          
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder=" "
                  className="peer w-full px-4 pt-5 pb-2 bg-gray-900/50 border border-white/10 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500 focus:bg-cyan-950/10 transition-all placeholder-transparent"
                />
                <label htmlFor="firstName" className="absolute left-4 top-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-600 peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-cyan-500 pointer-events-none">
                  First Name
                </label>
              </div>
              <div className="relative">
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder=" "
                  className="peer w-full px-4 pt-5 pb-2 bg-gray-900/50 border border-white/10 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500 focus:bg-cyan-950/10 transition-all placeholder-transparent"
                />
                <label htmlFor="lastName" className="absolute left-4 top-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-600 peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-cyan-500 pointer-events-none">
                  Last Name
                </label>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                id="entryName"
                value={entryName}
                onChange={(e) => setEntryName(e.target.value)}
                placeholder=" "
                className="peer w-full px-4 pt-5 pb-2 bg-gray-900/50 border border-white/10 rounded-xl text-white font-bold focus:outline-none focus:border-cyan-500 focus:bg-cyan-950/10 transition-all placeholder-transparent"
              />
              <label htmlFor="entryName" className="absolute left-4 top-1 text-[10px] font-bold text-gray-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-600 peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-cyan-500 pointer-events-none">
                Team Display Name
              </label>
            </div>
            
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full py-4 mt-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black tracking-widest rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all disabled:opacity-50 relative overflow-hidden group"
            >
              <span className="relative z-10">{saving ? "UPDATING CORE..." : "UPDATE IDENTITY"}</span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
            </button>
          </div>
        </div>
      </div>      

      {/* Avatar Armory Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setShowAvatarModal(false)}>
          <div className="bg-[#0f1423] border border-cyan-500/30 rounded-3xl p-6 max-w-sm w-full max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] relative" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-white tracking-widest uppercase">Avatar Armory</h3>
              <button onClick={() => setShowAvatarModal(false)} className="text-gray-500 hover:text-white bg-gray-900 rounded-full p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-4 gap-3">
                {PREMADE_AVATARS.map((avatar, index) => {
                  const isSelected = selectedAvatar === avatar;
                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedAvatar(avatar);
                        setShowAvatarModal(false); // Auto-close on selection for fast UX
                      }}
                      className={`relative aspect-square rounded-2xl overflow-hidden transition-all duration-200 border-2 ${
                        isSelected 
                          ? "border-cyan-500 scale-110 shadow-[0_0_15px_rgba(6,182,212,0.6)] z-10" 
                          : "border-gray-800 opacity-60 hover:opacity-100 hover:border-gray-600 bg-black/50"
                      }`}
                    >
                      <img src={avatar} alt={`Avatar`} className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-cyan-500/20 ring-inset ring-2 ring-cyan-500/50 rounded-xl pointer-events-none"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-center text-[10px] text-gray-500 font-black tracking-widest uppercase">
              {PREMADE_AVATARS.length} Entities Available
            </div>
          </div>
        </div>
      )}

      {/* Required CSS for custom scrollbar and safe area */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.5); border-radius: 4px; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
      `}</style>
    </div>
  );
}