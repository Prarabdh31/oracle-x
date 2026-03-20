"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Navbar() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
      }
    };
    fetchUser();
  }, [pathname]);

  if (pathname === "/login") return null;

  const isAdmin = userEmail === "cprarabdh@gmail.com";

  const isActive = (path: string) => {
    if (path === "/" && pathname !== "/") return false;
    return pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-2 pointer-events-none">
      <div className="bg-[#050814]/90 backdrop-blur-xl border border-white/10 rounded-3xl flex items-end justify-between px-2 pb-2 pt-3 shadow-[0_15px_40px_rgba(0,0,0,0.8)] pointer-events-auto relative">
        
        {/* 1. Live Table */}
        <Link href="/live" className={`flex flex-col items-center justify-end w-[15%] transition-all ${isActive("/live") ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] -translate-y-1" : "text-gray-500 hover:text-gray-300"}`}>
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          <span className="text-[8px] font-black tracking-widest uppercase">Live</span>
          {isActive("/live") && <div className="w-1 h-1 bg-cyan-400 rounded-full absolute -bottom-1 shadow-[0_0_5px_rgba(6,182,212,1)]"></div>}
        </Link>

        {/* 2. My Draft */}
        <Link href="/draft" className={`flex flex-col items-center justify-end w-[15%] transition-all ${isActive("/draft") ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] -translate-y-1" : "text-gray-500 hover:text-gray-300"}`}>
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          <span className="text-[8px] font-black tracking-widest uppercase">Draft</span>
          {isActive("/draft") && <div className="w-1 h-1 bg-cyan-400 rounded-full absolute -bottom-1 shadow-[0_0_5px_rgba(6,182,212,1)]"></div>}
        </Link>

        {/* 3. Leaderboard (The Centerpiece Orb) */}
        <div className="relative -top-5 flex flex-col items-center w-[20%]">
          <Link href="/" className="flex items-center justify-center w-14 h-14 bg-[#050814] rounded-full border border-white/10 relative group mb-1">
            <div className={`absolute inset-1 rounded-full flex items-center justify-center transition-all duration-300 ${isActive("/") ? "bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.5)]" : "bg-gray-900 group-hover:bg-gray-800"}`}>
              <svg className={`w-6 h-6 ${isActive("/") ? "text-white drop-shadow-md" : "text-gray-400"}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" /></svg>
            </div>
            <div className={`absolute -inset-1 rounded-full z-[-1] transition-opacity duration-300 ${isActive("/") ? "opacity-100 bg-gradient-to-tr from-cyan-400 to-blue-500 blur-sm" : "opacity-0"}`}></div>
          </Link>
          <span className={`text-[9px] font-black uppercase tracking-widest absolute -bottom-3 ${isActive("/") ? "text-cyan-400" : "text-gray-500"}`}>Arena</span>
        </div>

        {/* 4. My Team */}
        <Link href={userId ? `/team/${userId}` : "#"} className={`flex flex-col items-center justify-end w-[15%] transition-all ${pathname.includes(`/team/${userId}`) ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] -translate-y-1" : "text-gray-500 hover:text-gray-300"}`}>
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          <span className="text-[8px] font-black tracking-widest uppercase">Team</span>
          {pathname.includes(`/team/${userId}`) && <div className="w-1 h-1 bg-cyan-400 rounded-full absolute -bottom-1 shadow-[0_0_5px_rgba(6,182,212,1)]"></div>}
        </Link>

        {/* 5. Profile */}
        <Link href="/profile" className={`flex flex-col items-center justify-end w-[15%] transition-all ${isActive("/profile") ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] -translate-y-1" : "text-gray-500 hover:text-gray-300"}`}>
          <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          <span className="text-[8px] font-black tracking-widest uppercase">ID</span>
          {isActive("/profile") && <div className="w-1 h-1 bg-cyan-400 rounded-full absolute -bottom-1 shadow-[0_0_5px_rgba(6,182,212,1)]"></div>}
        </Link>

        {/* 6. Admin (Stealth Mode) */}
        {isAdmin && (
          <Link href="/admin" className={`flex flex-col items-center justify-end w-[15%] transition-all ${isActive("/admin") ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] -translate-y-1" : "text-gray-700 hover:text-red-900"}`}>
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="text-[8px] font-black tracking-widest uppercase">Admin</span>
            {isActive("/admin") && <div className="w-1 h-1 bg-red-500 rounded-full absolute -bottom-1 shadow-[0_0_5px_rgba(239,68,68,1)]"></div>}
          </Link>
        )}
      </div>
    </div>
  );
}