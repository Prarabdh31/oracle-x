"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false); // Toggle state
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp) {
      // Handle Sign Up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        if (data.user) {
          await supabase.from("profiles").insert([
            {
              id: data.user.id,
              username: email.split("@")[0],
            },
          ]);
        }
        router.push("/draft");
      }
    } else {
      // Handle Sign In
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push("/draft");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-[#050814] overflow-hidden p-4">
      
      {/* Background Ambient Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Glassmorphism Card */}
      <div className="relative w-full max-w-md z-10 flex flex-col items-center">
        
        {/* Oracle X Logo with Ambient Glow */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-cyan-400/20 blur-2xl rounded-full group-hover:bg-cyan-400/30 transition-all duration-500"></div>
          <img 
            src="/oracle-logo.png" 
            alt="Oracle X Logo" 
            className="relative w-56 mx-auto drop-shadow-[0_0_15px_rgba(0,0,0,0.5)] transform transition-transform duration-700 hover:scale-105"
          />
        </div>

        {/* The Form Container */}
        <div className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">
          
          <h2 className="text-2xl font-bold text-white text-center mb-6 tracking-wide">
            {isSignUp ? "Enter the Arena" : "Welcome Back"}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-6 text-center backdrop-blur-md">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="oracle@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="relative w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center overflow-hidden"
              >
                {loading ? (
                  <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  isSignUp ? "Create Team" : "Sign In"
                )}
              </button>
            </div>
          </form>

          {/* Seamless Toggle */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-sm text-gray-400 hover:text-cyan-400 transition-colors focus:outline-none"
            >
              {isSignUp 
                ? "Already have a team? Sign In" 
                : "New Oracle? Create your team"}
            </button>
          </div>
        </div>

        {/* The Tournament Hype Element */}
        <div className="mt-10 flex flex-col items-center justify-center animate-pulse">
          <div className="h-[1px] w-12 bg-yellow-500/50 mb-3"></div>
          <p className="text-yellow-500 font-bold tracking-widest uppercase text-xs">
            IPL 2026 Predictions Lock Soon
          </p>
          <div className="h-[1px] w-12 bg-yellow-500/50 mt-3"></div>
        </div>

      </div>
    </div>
  );
}