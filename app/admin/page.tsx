"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
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
  current_position?: number;
  matches_played?: number | string;
  wins?: number | string;
  losses?: number | string;
  no_results?: number | string;
  points?: number | string;
  net_run_rate?: number | string;
}

function StatInput({ label, value, onChange, step = "1", highlight = false }: any) {
  return (
    <div className="flex flex-col items-center">
      <label className={`text-[8px] font-black tracking-widest mb-1 ${highlight ? 'text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'text-gray-500'}`}>{label}</label>
      <input type="number" step={step} value={value ?? ""} onChange={onChange} className={`w-full text-center bg-black/60 border rounded-md text-sm py-1.5 focus:outline-none focus:border-red-500 font-bold transition-colors ${highlight ? 'text-red-500 border-red-900/50 bg-red-950/20' : 'text-white border-white/10'}`} />
    </div>
  );
}

function SortableAdminRow({ team, index, moveUp, moveDown, onStatChange }: { team: Team; index: number; moveUp: () => void; moveDown: () => void; onStatChange: (id: number, field: keyof Team, value: string) => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: team.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`relative flex flex-col p-3 rounded-2xl border transition-all duration-200 ${isDragging ? "border-red-500 scale-105 bg-red-950/40 shadow-[0_0_20px_rgba(239,68,68,0.4)] opacity-95" : "border-white/10 bg-black/40 hover:bg-gray-900 hover:border-white/20"}`}>
      <div className="flex items-center justify-between w-full">
        {/* Added touch-none select-none to fix mobile dragging */}
        <div className="flex items-center gap-4 flex-grow overflow-hidden" >
          <div className="text-gray-500 cursor-grab active:cursor-grabbing px-2 py-2 hover:text-red-400 transition-colors touch-none select-none" {...attributes} {...listeners}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
          </div>
          <span className="text-xl font-black w-6 shrink-0 text-center text-gray-400">{index + 1}</span>
          {team.logo_url && <img src={team.logo_url} alt={team.short_name} className="w-8 h-8 shrink-0 object-contain drop-shadow-md" />}
          <p className="font-bold text-white text-lg tracking-wide truncate">{team.short_name}</p>
        </div>
        <div className="flex flex-col ml-1 gap-1 relative z-10 shrink-0">
          <button onClick={moveUp} className="bg-gray-800/80 rounded px-2 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-red-900/50 transition-colors">▲</button>
          <button onClick={moveDown} className="bg-gray-800/80 rounded px-2 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-red-900/50 transition-colors">▼</button>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2 mt-3 pt-3 border-t border-white/5 relative z-10">
        <StatInput label="P" value={team.matches_played} onChange={(e: any) => onStatChange(team.id, 'matches_played', e.target.value)} />
        <StatInput label="W" value={team.wins} onChange={(e: any) => onStatChange(team.id, 'wins', e.target.value)} />
        <StatInput label="L" value={team.losses} onChange={(e: any) => onStatChange(team.id, 'losses', e.target.value)} />
        <StatInput label="NR" value={team.no_results} onChange={(e: any) => onStatChange(team.id, 'no_results', e.target.value)} />
        <StatInput label="NRR" value={team.net_run_rate} step="0.001" onChange={(e: any) => onStatChange(team.id, 'net_run_rate', e.target.value)} />
        <StatInput label="PTS" value={team.points} onChange={(e: any) => onStatChange(team.id, 'points', e.target.value)} highlight={true} />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [finalist1Id, setFinalist1Id] = useState<number | "">("");
  const [finalist2Id, setFinalist2Id] = useState<number | "">("");
  const [winnerId, setWinnerId] = useState<number | "">("");
  const [deadline, setDeadline] = useState("");
  const [unlockTeamView, setUnlockTeamView] = useState(false);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => { checkAdminAndFetchData(); }, []);

  const checkAdminAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/login");

    const [{ data: teamsData }, { data: standingsData }, { data: knockoutsData }, { data: settingsData }] = await Promise.all([
      supabase.from("teams").select("*"), supabase.from("actual_standings").select("*"),
      supabase.from("actual_knockouts").select("*").eq("id", 1).maybeSingle(), supabase.from("system_settings").select("*").eq("id", 1).maybeSingle()
    ]);

    if (teamsData) {
      let mergedTeams = [...teamsData];
      if (standingsData && standingsData.length > 0) {
        mergedTeams = mergedTeams.map(team => {
          const standing = standingsData.find(s => s.team_id === team.id);
          return { ...team, current_position: standing?.current_position || 99, matches_played: standing?.matches_played || 0, wins: standing?.wins || 0, losses: standing?.losses || 0, no_results: standing?.no_results || 0, net_run_rate: standing?.net_run_rate || 0, points: standing?.points || 0 };
        }).sort((a, b) => (a.current_position || 99) - (b.current_position || 99));
      } else {
        mergedTeams.sort((a, b) => a.name.localeCompare(b.name));
      }
      setTeams(mergedTeams);
    }
    if (knockoutsData) {
      setFinalist1Id(knockoutsData.finalist_1_id || ""); setFinalist2Id(knockoutsData.finalist_2_id || ""); setWinnerId(knockoutsData.winner_id || "");
    }
    if (settingsData) {
      if (settingsData.tournament_deadline) {
        const dateObj = new Date(settingsData.tournament_deadline);
        const localISOTime = (new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        setDeadline(localISOTime);
      }
      setUnlockTeamView(settingsData.unlock_team_view || false);
    }
    setLoading(false);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setTeams((items) => arrayMove(items, items.findIndex((t) => t.id === active.id), items.findIndex((t) => t.id === over.id)));
    }
  };

  const moveUp = (index: number) => { if (index === 0) return; const newTeams = [...teams]; [newTeams[index - 1], newTeams[index]] = [newTeams[index], newTeams[index - 1]]; setTeams(newTeams); };
  const moveDown = (index: number) => { if (index === teams.length - 1) return; const newTeams = [...teams]; [newTeams[index + 1], newTeams[index]] = [newTeams[index], newTeams[index + 1]]; setTeams(newTeams); };
  const handleStatChange = (id: number, field: keyof Team, value: string) => { setTeams(prevTeams => prevTeams.map(t => t.id === id ? { ...t, [field]: value } : t)); };

  const handleUpdateEverything = async () => {
    setSaving(true);
    const toastId = toast.loading("Encrypting & Uploading...");
    try {
      const standingsToSave = teams.map((team, index) => ({
        team_id: team.id, current_position: index + 1, matches_played: Number(team.matches_played) || 0, wins: Number(team.wins) || 0, losses: Number(team.losses) || 0, no_results: Number(team.no_results) || 0, net_run_rate: Number(team.net_run_rate) || 0, points: Number(team.points) || 0, updated_at: new Date().toISOString(),
      }));
      const { error: standingsError } = await supabase.from("actual_standings").upsert(standingsToSave, { onConflict: 'team_id' });
      if (standingsError) throw standingsError;

      const knockoutData = { id: 1, finalist_1_id: finalist1Id === "" ? null : Number(finalist1Id), finalist_2_id: finalist2Id === "" ? null : Number(finalist2Id), winner_id: winnerId === "" ? null : Number(winnerId) };
      const { error: knockoutError } = await supabase.from("actual_knockouts").upsert(knockoutData, { onConflict: 'id' });
      if (knockoutError) throw knockoutError;

      const settingsData = { id: 1, tournament_deadline: new Date(deadline).toISOString(), unlock_team_view: unlockTeamView };
      const { error: settingsError } = await supabase.from("system_settings").upsert(settingsData, { onConflict: 'id' });
      if (settingsError) throw settingsError;

      toast.success("Database Overridden! Live payload published.", { id: toastId });
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error("Failed to update: " + error.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050814] text-red-500 font-black tracking-widest animate-pulse">BOOTING DIRECTOR CONSOLE...</div>;
  const getTeamLogo = (id: number | "") => id === "" ? null : teams.find(t => t.id === Number(id))?.logo_url || null;

  return (
    <div className="min-h-screen bg-[#050814] text-white pb-32 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-red-900/10 blur-[150px] pointer-events-none rounded-full"></div>
      <div className="sticky top-0 z-40 bg-[#050814]/90 backdrop-blur-xl border-b border-red-900/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/oracle-logo.png" alt="Oracle X" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] grayscale-[50%] sepia-[50%] hue-rotate-[-50deg] saturate-[300%]" />
          <span className="font-black text-lg tracking-wider text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">DIRECTOR OVERRIDE</span>
        </div>
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.2)]">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-[10px] font-black tracking-widest text-red-400">LIVE</span>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 relative z-10">
        <div className="bg-black/40 border border-red-900/50 rounded-3xl p-6 mb-8 shadow-[0_0_20px_rgba(220,38,38,0.05)] relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-5 text-9xl font-black pointer-events-none">SYS</div>
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Security & Timing
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">Global Lockdown (Deadline)</label>
              <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full bg-gray-900/80 border border-white/10 text-white font-bold rounded-xl p-3 text-sm focus:outline-none focus:border-red-500 focus:bg-red-950/10 transition-colors" />
            </div>
            <div className="flex items-center justify-between bg-gray-900/80 border border-white/10 p-4 rounded-xl">
              <div>
                <p className="text-xs font-bold text-white uppercase tracking-widest">Force Master Unlock</p>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Bypass deadline to reveal all intel.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={unlockTeamView} onChange={() => setUnlockTeamView(!unlockTeamView)} />
                <div className="w-12 h-6 bg-gray-800 border border-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:after:bg-white shadow-inner"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Live Data Override
            </h2>
            <span className="text-[10px] text-red-500 font-bold tracking-widest bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">DRAG & EDIT</span>
          </div>
          <div className="bg-black/40 border border-white/5 p-2 rounded-2xl shadow-xl relative">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={teams.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {teams.map((team, index) => (
                    <SortableAdminRow key={team.id} team={team} index={index} moveUp={() => moveUp(index)} moveDown={() => moveDown(index)} onStatChange={handleStatChange} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-3xl p-6 mb-8 shadow-xl relative">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Knockout Reality
          </h2>
          <div className="space-y-4">
            <div className="bg-gray-900/80 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-lg border border-gray-800 flex items-center justify-center shrink-0">
                {getTeamLogo(finalist1Id) ? <img src={getTeamLogo(finalist1Id)!} className="w-7 h-7 object-contain" /> : <span className="text-gray-600 text-[10px] font-black">F1</span>}
              </div>
              <div className="flex-grow">
                <label className="block text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-widest">Finalist 1</label>
                <select value={finalist1Id} onChange={(e) => setFinalist1Id(e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-transparent text-white font-bold text-sm focus:outline-none">
                  <option value="" className="bg-gray-900">-- Awaiting Result --</option>
                  {teams.map(team => <option key={team.id} value={team.id} className="bg-gray-900">{team.name}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-gray-900/80 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-lg border border-gray-800 flex items-center justify-center shrink-0">
                {getTeamLogo(finalist2Id) ? <img src={getTeamLogo(finalist2Id)!} className="w-7 h-7 object-contain" /> : <span className="text-gray-600 text-[10px] font-black">F2</span>}
              </div>
              <div className="flex-grow">
                <label className="block text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-widest">Finalist 2</label>
                <select value={finalist2Id} onChange={(e) => setFinalist2Id(e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-transparent text-white font-bold text-sm focus:outline-none">
                  <option value="" className="bg-gray-900">-- Awaiting Result --</option>
                  {teams.map(team => <option key={team.id} value={team.id} className="bg-gray-900">{team.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5">
              <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-xl p-3 flex items-center gap-3 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                <div className="w-12 h-12 bg-black rounded-xl border-2 border-yellow-500/50 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                  {getTeamLogo(winnerId) ? <img src={getTeamLogo(winnerId)!} className="w-9 h-9 object-contain drop-shadow-md" /> : <svg className="w-5 h-5 text-yellow-600/50" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>}
                </div>
                <div className="flex-grow">
                  <label className="block text-[10px] text-yellow-500/80 font-black mb-1 uppercase tracking-widest">Tournament Champion</label>
                  <select value={winnerId} onChange={(e) => setWinnerId(e.target.value === "" ? "" : Number(e.target.value))} className="w-full bg-transparent text-yellow-500 font-black text-base focus:outline-none">
                    <option value="" className="bg-gray-900 text-white">-- Crown Winner --</option>
                    {teams.filter(t => t.id === finalist1Id || t.id === finalist2Id).map(team => <option key={team.id} value={team.id} className="bg-gray-900 text-white">{team.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STATIC BUTTON AT BOTTOM OF CONTENT (No longer floating) */}
        <div className="mt-8 mb-6">
          <button onClick={handleUpdateEverything} disabled={saving} className={`w-full flex items-center justify-center py-4 font-black tracking-widest rounded-2xl transition-all shadow-xl relative overflow-hidden group ${saving ? "bg-red-900 text-red-300 border border-red-700 cursor-not-allowed" : "bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white border border-red-500/50 hover:shadow-[0_0_20px_rgba(220,38,38,0.5)] active:scale-95"}`}>
            {saving ? "ENCRYPTING..." : "PUBLISH TO LIVE SERVER"}
          </button>
        </div>

      </div>

      <style jsx global>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 20px); }
      `}</style>
    </div>
  );
}