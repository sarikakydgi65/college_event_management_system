import React, { useState, useEffect } from "react";
import { Database, LogOut, Shield, User, Sparkles } from "lucide-react";
import { Student } from "./types";
import LoginScreen from "./components/LoginScreen";
import StudentDashboard from "./components/StudentDashboard";
import OrganizerDashboard from "./components/OrganizerDashboard";

export default function App() {
  const [session, setSession] = useState<{ role: "student" | "organizer"; data: any } | null>(null);
  const [students, setStudents] = useState<Student[]>([]);

  // Fetch student listings from server on initialization to fuel the quick-login selector
  const fetchStudents = async () => {
    try {
      const response = await fetch("/api/students");
      if (response.ok) {
        const list = await response.json();
        setStudents(list);
      }
    } catch (err) {
      // Quietly handle students fetch issues
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [session]); // refetch when registration updates

  const handleLogout = () => {
    setSession(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Primary Application Header (Sticky navigation) */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg text-white shadow-sm">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight text-slate-900 tracking-tight flex items-center gap-1.5">
              EventEngine
              <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                v1.0
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wide">COLLEGE DATABASE MANAGEMENT</p>
          </div>
        </div>

        {/* Profile Card Summary Header section / Log Out */}
        {session ? (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 bg-slate-100/80 pl-3 pr-2 py-1 border border-slate-200 rounded-full">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-700">{session.data.name || session.data.organizer_name || "Admin"}</p>
                <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">
                  {session.role === "student" ? "STUDENT" : "ADMIN / ORGANIZER"}
                </p>
              </div>
              <div className="p-1.5 bg-white rounded-full border border-slate-200">
                {session.role === "student" ? (
                  <User className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 bg-red-50 hover:bg-red-105 border border-red-200 text-red-650 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span>SECURE GATEWAY</span>
          </div>
        )}
      </header>

      {/* Main Content Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {!session ? (
          /* Render login screen if no event session */
          <div className="animate-in fade-in duration-300">
            <LoginScreen onLoginSuccess={(usr) => setSession(usr)} mockStudents={students} />
          </div>
        ) : (
          /* Portal dashboard view based on active profile role */
          <div className="space-y-6 animate-in fade-in duration-350">
            {session.role === "student" ? (
              <StudentDashboard student={session.data} onLogout={handleLogout} />
            ) : (
              <OrganizerDashboard organizer={session.data} onLogout={handleLogout} />
            )}
          </div>
        )}
      </main>

      {/* Footer disclaimer block */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 font-mono">
        College Event Relational SQL Engine Model Simulator. MySQL 8.0 Salted Hash Standard Conformance.
      </footer>
    </div>
  );
}
