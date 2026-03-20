"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Team {
  id: number;
  name: string;
  short_name: string;
  logo_url: string;
}

// --- SUB-COMPONENT: The Draggable Team Row ---
function SortableTeamRow({
  team,
  index,
  isLocked,
  isFav,
  isPower,
  onFavToggle,
  onPowerToggle,
  moveUp,
  moveDown,
}: {
  team: Team;
  index: number;
  isLocked: boolean;
  isFav: boolean;
  isPower: boolean;
  onFavToggle: () => void;
  onPowerToggle: () => void;
  moveUp: () => void;
  moveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: team.id, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  const isPlayoff = index < 4;

  // Map state directly to our new flawless CSS classes
  let containerStyle = "border-2 border-gray-800 bg-gray-900";

  if (isFav) {
    containerStyle = "fav-moving-border";
  } else if (isPower) {
    containerStyle = "pwr-moving-border";
  } else if (isPlayoff) {
    containerStyle = "border-2 border-blue-500/50 bg-gray-900";
  }

  const finalStyle = `relative flex items-center justify-between p-3 rounded-xl transition-all duration-200 ${containerStyle} ${
    isDragging ? "scale-105 opacity-90 shadow-2xl" : ""
  } ${isLocked ? "opacity-75" : ""}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={finalStyle}
    >
      {/* Left Side: Drag Handle & Info */}
      <div className="flex items-center gap-3" {...attributes} {...listeners}>
        {!isLocked && (
          <div className="text-gray-600 cursor-grab active:cursor-grabbing px-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>
        )}
        <span className={`text-xl font-black w-6 text-center ${isPlayoff ? "text-blue-400" : "text-gray-500"}`}>
          {index + 1}
        </span>
        {team.logo_url && <img src={team.logo_url} alt={team.short_name} className="w-8 h-8 object-contain" />}
        <p className="font-bold text-white text-lg tracking-wide">{team.short_name}</p>
      </div>

      {/* Right Side: Power-ups & Fallback Arrows */}
      <div className="flex items-center gap-2 relative z-10">
        <button
          onClick={onFavToggle}
          disabled={isLocked || isPower}
          className={`text-[10px] font-black px-2.5 py-1.5 rounded-md transition-all ${
            isFav ? "bg-cyan-500 text-black shadow-[0_0_10px_rgba(6,182,212,0.8)]" : "bg-gray-800 text-gray-400"
          } disabled:opacity-30`}
        >
          2x FAV
        </button>
        <button
          onClick={onPowerToggle}
          disabled={isLocked || isFav}
          className={`text-[10px] font-black px-2.5 py-1.5 rounded-md transition-all ${
            isPower ? "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.8)]" : "bg-gray-800 text-gray-400"
          } disabled:opacity-30`}
        >
          3x PWR
        </button>

        {!isLocked && (
          <div className="flex flex-col ml-1 gap-1">
            <button onClick={moveUp} className="bg-gray-800 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700">▲</button>
            <button onClick={moveDown} className="bg-gray-800 rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700">▼</button>
          </div>
        )}
      </div>

      {/* THE FIX: Pure Native CSS Background Clip Borders */}
      {/* This ensures mathematically perfect 2px borders everywhere that never break, with flowing energy animation */}
      <style jsx global>{`
        @keyframes flow-energy {
          0% { background-position: 0% 0%, 0% 50%; }
          100% { background-position: 0% 0%, 200% 50%; }
        }

        .fav-moving-border {
          border: 2px solid transparent;
          background:
            linear-gradient(#061019, #061019) padding-box, /* The tinted inner container */
            linear-gradient(90deg, #06B6D4, #022C22, #06B6D4, #022C22, #06B6D4) border-box; /* The moving border */
          background-size: 100% 100%, 200% 100%;
          animation: flow-energy 2s linear infinite;
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.4);
        }

        .pwr-moving-border {
          border: 2px solid transparent;
          background:
            linear-gradient(#141005, #141005) padding-box, /* The tinted inner container */
            linear-gradient(90deg, #EAB308, #422006, #EAB308, #422006, #EAB308) border-box; /* The moving border */
          background-size: 100% 100%, 200% 100%;
          animation: flow-energy 2s linear infinite;
          box-shadow: 0 0 15px rgba(234, 179, 8, 0.4);
        }
      `}</style>
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function DraftPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [favouriteTeamId, setFavouriteTeamId] = useState<number | null>(null);
  const [powerTeamId, setPowerTeamId] = useState<number | null>(null);
  const [finalist1Id, setFinalist1Id] = useState<number | null>(null);
  const [finalist2Id, setFinalist2Id] = useState<number | null>(null);
  const [winnerId, setWinnerId] = useState<number | null>(null);

  const [deadlineTime, setDeadlineTime] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("Calculating...");
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  useEffect(() => {
    if (!deadlineTime) return;
    const timer = setInterval(() => {
      const now = Date.now();
      if (now >= deadlineTime) {
        setIsLocked(true);
        setTimeLeft("Predictions Locked");
        clearInterval(timer);
      } else {
        const distance = deadlineTime - now;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`Locks in: ${days}d ${hours}h ${minutes}m`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [deadlineTime]);

  useEffect(() => {
    if (teams.length >= 4) {
      const top4Ids = teams.slice(0, 4).map((t) => t.id);
      if (finalist1Id && !top4Ids.includes(finalist1Id)) {
        setFinalist1Id(null);
        if (winnerId === finalist1Id) setWinnerId(null);
      }
      if (finalist2Id && !top4Ids.includes(finalist2Id)) {
        setFinalist2Id(null);
        if (winnerId === finalist2Id) setWinnerId(null);
      }
    }
  }, [teams, finalist1Id, finalist2Id, winnerId]);

  const checkUserAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    const userId = session.user.id;

    const [
      { data: teamsData },
      { data: predsData },
      { data: knockoutData },
      { data: settingsData },
    ] = await Promise.all([
      supabase.from("teams").select("*"),
      supabase.from("league_predictions").select("*").eq("user_id", userId),
      supabase.from("knockout_predictions").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("system_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (settingsData && settingsData.tournament_deadline) {
      setDeadlineTime(new Date(settingsData.tournament_deadline).getTime());
    }

    if (teamsData) {
      if (predsData && predsData.length > 0) {
        const sortedTeams = [...teamsData].sort((a, b) => {
          const predA = predsData.find((p) => p.team_id === a.id)?.predicted_position || 99;
          const predB = predsData.find((p) => p.team_id === b.id)?.predicted_position || 99;
          return predA - predB;
        });
        setTeams(sortedTeams);
        const fav = predsData.find((p) => p.multiplier === 2);
        if (fav) setFavouriteTeamId(fav.team_id);
        const power = predsData.find((p) => p.multiplier === 3);
        if (power) setPowerTeamId(power.team_id);
      } else {
        setTeams([...teamsData].sort((a, b) => a.name.localeCompare(b.name)));
      }

      if (knockoutData) {
        setFinalist1Id(knockoutData.finalist_1_id);
        setFinalist2Id(knockoutData.finalist_2_id);
        setWinnerId(knockoutData.winner_id);
      }
    }
    setLoading(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTeams((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const moveUp = (index: number) => {
    if (isLocked || index === 0) return;
    const newTeams = [...teams];
    [newTeams[index - 1], newTeams[index]] = [newTeams[index], newTeams[index - 1]];
    setTeams(newTeams);
  };

  const moveDown = (index: number) => {
    if (isLocked || index === teams.length - 1) return;
    const newTeams = [...teams];
    [newTeams[index + 1], newTeams[index]] = [newTeams[index], newTeams[index + 1]];
    setTeams(newTeams);
  };

  const toggleFinalist = (teamId: number) => {
    if (isLocked) return;
    if (finalist1Id === teamId) {
      setFinalist1Id(null);
      if (winnerId === teamId) setWinnerId(null);
      return;
    }
    if (finalist2Id === teamId) {
      setFinalist2Id(null);
      if (winnerId === teamId) setWinnerId(null);
      return;
    }
    if (!finalist1Id) setFinalist1Id(teamId);
    else if (!finalist2Id) setFinalist2Id(teamId);
  };

  const handleSavePredictions = async () => {
    if (isLocked) return alert("Predictions are locked.");
    if (!favouriteTeamId || !powerTeamId) return alert("Select both a 2x FAV and a 3x PWR team!");
    if (!finalist1Id || !finalist2Id || !winnerId) return alert("Complete your Knockout Stage predictions!");

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const userId = session.user.id;

      const leaguePredictions = teams.map((team, index) => ({
        user_id: userId,
        team_id: team.id,
        predicted_position: index + 1,
        multiplier: team.id === favouriteTeamId ? 2 : team.id === powerTeamId ? 3 : 1,
      }));

      const knockoutPrediction = {
        user_id: userId,
        finalist_1_id: finalist1Id,
        finalist_2_id: finalist2Id,
        winner_id: winnerId,
        updated_at: new Date().toISOString(),
      };

      await supabase.from("league_predictions").delete().eq("user_id", userId);
      const { error: leagueError } = await supabase.from("league_predictions").insert(leaguePredictions);
      if (leagueError) throw leagueError;

      await supabase.from("knockout_predictions").delete().eq("user_id", userId);
      const { error: knockoutError } = await supabase.from("knockout_predictions").insert(knockoutPrediction);
      if (knockoutError) throw knockoutError;

      alert("Awesome! Your Oracle Table is locked in.");
    } catch (error: any) {
      console.error("Save error:", error);
      alert("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050814] text-cyan-500 font-black tracking-widest animate-pulse">LOADING DRAFT HQ...</div>;

  const top4Teams = teams.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#050814] text-white pb-32 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-900/20 blur-[150px] pointer-events-none rounded-full"></div>

      {/* Global Glass Header */}
      <div className="sticky top-0 z-40 bg-[#050814]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/oracle-logo.png" alt="Oracle X" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span className="font-black text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">DRAFT HQ</span>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wider transition-colors ${
          isLocked ? 'bg-red-500/20 text-red-500 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
        }`}>
          {timeLeft}
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 relative z-10">
        
        {/* Title & Info Trigger */}
        <div className="flex justify-between items-end mb-6 mt-4">
          <div>
            <h1 className="text-3xl font-black mb-1">League Table</h1>
            <p className="text-gray-400 text-sm font-medium">Drag to rank. Activate power-ups.</p>
          </div>
          <button onClick={() => setShowInfo(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-cyan-400 hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
        </div>

        {/* Drag & Drop Context */}
        <div className="bg-black/40 border border-white/5 p-2 rounded-2xl mb-10 shadow-2xl relative">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={teams.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {teams.map((team, index) => (
                  <SortableTeamRow
                    key={team.id}
                    team={team}
                    index={index}
                    isLocked={isLocked}
                    isFav={favouriteTeamId === team.id}
                    isPower={powerTeamId === team.id}
                    onFavToggle={() => !isLocked && setFavouriteTeamId(favouriteTeamId === team.id ? null : team.id)}
                    onPowerToggle={() => !isLocked && setPowerTeamId(powerTeamId === team.id ? null : team.id)}
                    moveUp={() => moveUp(index)}
                    moveDown={() => moveDown(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Knockout Stage UI */}
        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-[50px]"></div>
          
          <h2 className="text-2xl font-black mb-1 text-white">Knockout Arena</h2>
          <p className="text-xs text-gray-400 mb-6 uppercase tracking-wider font-semibold">Select 2 Finalists from your Top 4</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            {top4Teams.map(team => {
              const isSelected = finalist1Id === team.id || finalist2Id === team.id;
              return (
                <button
                  key={team.id}
                  onClick={() => toggleFinalist(team.id)}
                  disabled={isLocked || (!isSelected && finalist1Id !== null && finalist2Id !== null)}
                  className={`flex flex-col items-center gap-2 py-4 rounded-2xl transition-all border-2 ${
                    isSelected 
                      ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-105' 
                      : 'bg-gray-900/50 border-gray-800 hover:bg-gray-800'
                  } disabled:opacity-50`}
                >
                  <img src={team.logo_url} alt="" className="w-12 h-12 object-contain drop-shadow-lg" />
                  <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-400'}`}>{team.short_name}</span>
                </button>
              );
            })}
          </div>

          {(finalist1Id || finalist2Id) && (
            <div className="pt-6 border-t border-white/5 animate-fade-in">
              <p className="text-xs text-yellow-500 mb-4 text-center font-black uppercase tracking-widest">Crown the Champion</p>
              <div className="flex justify-center gap-4">
                {[finalist1Id, finalist2Id].map(id => {
                  if (!id) return null;
                  const team = teams.find(t => t.id === id);
                  const isWinner = winnerId === id;
                  return (
                    <button
                      key={id}
                      onClick={() => !isLocked && setWinnerId(id)}
                      disabled={isLocked}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border-2 w-32 ${
                        isWinner 
                          ? 'bg-yellow-500/20 border-yellow-500 scale-110 shadow-[0_0_30px_rgba(234,179,8,0.4)] z-10' 
                          : 'bg-gray-900/50 border-gray-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={team?.logo_url} alt="" className="w-14 h-14 object-contain drop-shadow-xl" />
                      <span className={`font-black ${isWinner ? 'text-yellow-500' : 'text-gray-400'}`}>{team?.short_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Floating Save Dock */}
        <div className="fixed bottom-28 left-0 right-0 p-4 bg-gradient-to-t from-[#050814] via-[#050814]/90 to-transparent z-40">
          <button 
            onClick={handleSavePredictions}
            disabled={saving || isLocked}
            className={`w-full max-w-md mx-auto flex items-center justify-center py-4 font-black tracking-wide rounded-2xl transition-all shadow-2xl ${
              isLocked 
                ? "bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed" 
                : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            }`}
          >
            {isLocked ? (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                DATABASE LOCKED
              </>
            ) : saving ? "SAVING PROTOCOL..." : "SAVE ORACLE PREDICTIONS"}
          </button>
        </div>
      </div>

      {/* Info Modal Overlay */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f1423] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setShowInfo(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-black text-white mb-4">Intelligence Briefing</h3>
            <div className="space-y-4 text-sm text-gray-300">
              <p><strong className="text-white">Base Scoring:</strong> 100 points per team. Lose 10 pts for every spot your prediction is off from reality.</p>
              <div className="flex gap-2">
                <span className="bg-cyan-500 text-black font-black px-2 py-0.5 rounded text-xs">2x FAV</span>
                <p>Doubles the final points for this team.</p>
              </div>
              <div className="flex gap-2">
                <span className="bg-yellow-500 text-black font-black px-2 py-0.5 rounded text-xs">3x PWR</span>
                <p>Triples the final points. Choose wisely.</p>
              </div>
              <div className="h-px bg-white/10 my-2"></div>
              <p><strong className="text-blue-400">Playoffs (+50 pts):</strong> Correctly predicting a team to finish in the Top 4.</p>
              <p><strong className="text-purple-400">Finalist (+100 pts):</strong> Correctly predicting a team reaches the final.</p>
              <p><strong className="text-yellow-500">Champion (+200 pts):</strong> Predicting the ultimate winner.</p>
            </div>
            <button onClick={() => setShowInfo(false)} className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors">Understood</button>
          </div>
        </div>
      )}
    </div>
  );
}