import React, { useState, useEffect } from "react";
import { LogIn, User, Shield, Phone, Sparkles, Key, Mail, RefreshCw, Star, Info, ArrowLeft, Eye, EyeOff, FileText } from "lucide-react";
import { Student } from "../types";

interface LoginScreenProps {
  onLoginSuccess: (user: { role: "student" | "organizer"; data: any }) => void;
  mockStudents: Student[];
}

export default function LoginScreen({ onLoginSuccess, mockStudents }: LoginScreenProps) {
  const [role, setRole] = useState<"student" | "organizer">("student");
  
  // Login states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Screen management
  const [view, setView] = useState<"login" | "register" | "forgot">("login");
  
  // Registration selection (Student vs Coordinator)
  const [regRole, setRegRole] = useState<"student" | "organizer">("student");
  
  // Register states
  const [regName, setRegName] = useState("");
  const [regDept, setRegDept] = useState("Computer Science");
  const [regYear, setRegYear] = useState("1");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRoleTitle, setRegRoleTitle] = useState("Associate Coordinator");

  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);

  // Interface feedbacks
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Simulated Email Log Viewer state
  const [emails, setEmails] = useState<any[]>([]);
  const [showInbox, setShowInbox] = useState(false);

  // Fetch simulated emails from backend db
  const fetchSimulatedEmails = async () => {
    try {
      // Find user matching current filled email if any, or load all emails for IT audit simulation
      // Make a safe backend query to read the parsed JSON database logs directly!
      const queryRes = await fetch("/api/queries/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "SELECT * FROM emails ORDER BY email_id DESC LIMIT 20" })
      });
      if (queryRes.ok) {
        const result = await queryRes.json();
        if (result && Array.isArray(result.results)) {
          setEmails(result.results);
        }
      }
    } catch (e) {
      // Quietly swallow simulation warning
    }
  };

  useEffect(() => {
    if (showInbox) {
      fetchSimulatedEmails();
      const interval = setInterval(fetchSimulatedEmails, 3000);
      return () => clearInterval(interval);
    }
  }, [showInbox, email, forgotEmail, regEmail]);

  const handleLogin = async (overrideEmail?: string, overridePass?: string, overrideRole?: "student" | "organizer") => {
    const finalEmail = overrideEmail || email;
    const finalPass = overridePass || password;
    const finalRole = overrideRole || role;

    if (!finalEmail || !finalPass) {
      setError("Please supply both a valid email address and password credentials.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: finalRole, email: finalEmail, password: finalPass })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Access Denied: Invalid credentials.");
      }

      onLoginSuccess({ role: result.role, data: result.user });
    } catch (err: any) {
      setError(err.message || "Authentication breakdown error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const finalEmail = regEmail.trim();
    if (!regName || !finalEmail || !regPhone || !regPassword) {
      setError("Please complete all registration fields.");
      return;
    }

    if (regPassword.length < 6) {
      setError("Password fails security strength rules: Must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = regRole === "student" ? "/api/auth/register-student" : "/api/auth/register-organizer";
      const payload = regRole === "student" ? {
        name: regName,
        department: regDept,
        year: parseInt(regYear),
        email: finalEmail,
        phone: regPhone,
        password: regPassword
      } : {
        name: regName,
        role: regRoleTitle,
        email: finalEmail,
        phone: regPhone,
        password: regPassword
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Registration rejected.");
      }

      setSuccess(`Account registered securely! Logging you in as ${regName}...`);
      
      // Auto login
      setTimeout(() => {
        onLoginSuccess({ role: regRole, data: result });
      }, 1500);

    } catch (err: any) {
      setError(err.message || "Registration sequence failed.");
      setIsLoading(false);
    }
  };

  const handleRequestResetToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!forgotEmail) {
      setError("Please type your registered college email address.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail, role })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Password reset token generation failed.");
      }

      setSuccess("Simulated reset verification token dispatched! Open the simulated inbox below to copy your code.");
      setForgotStep(2);
      setShowInbox(true); // Auto expand inbox so they see the email instantly!
    } catch (err: any) {
      setError(err.message || "Reset request error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!forgotCode || !forgotNewPass) {
      setError("Please enter the recovery verification token code and your new password.");
      return;
    }

    if (forgotNewPass.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail,
          role,
          code: forgotCode.trim(),
          newPassword: forgotNewPass
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Token verification failed.");
      }

      setSuccess("Password updated successfully! Redirecting you back to the sign in panel...");
      setTimeout(() => {
        setView("login");
        setForgotStep(1);
        setForgotEmail("");
        setForgotCode("");
        setForgotNewPass("");
        setSuccess(null);
      }, 2000);

    } catch (err: any) {
      setError(err.message || "Reset submission failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="login-container" className="flex flex-col lg:flex-row min-h-[calc(100vh-140px)] bg-slate-50 text-slate-850 rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative">
      
      {/* BRANDING COLUMN */}
      <div className="flex-1 flex flex-col justify-between p-8 lg:p-12 bg-white border-r border-slate-200/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span className="font-mono">COLLEGE EVENT PORTAL</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-sans font-bold tracking-tight text-slate-900 leading-tight">
            EventEngine <br />
            <span className="text-blue-600 font-medium">Session Console</span>
          </h1>
        </div>

        <div className="my-10 space-y-6">
          <div className="space-y-2">
            <p className="text-slate-500 text-xs leading-relaxed">
              Welcome to the unified college coordinate center. Register for seminars, track live classroom locations, and manage schedules under salted SHA-256 PBKDF2 data encryption.
            </p>
          </div>

          {/* Quick Seed log-ins so teachers & testers can test instantly with zero guesswork */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                Default Testing Accounts
              </span>
              <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">
                Pass: password
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              <button
                onClick={() => {
                  setRole("student");
                  setEmail("alice.vance@college.edu");
                  setPassword("password");
                  setError(null);
                }}
                className="text-left bg-white hover:bg-slate-100 transition-colors p-2 rounded-xl border border-slate-200/80 group cursor-pointer"
              >
                <p className="font-semibold text-slate-800 text-[10px] truncate group-hover:text-blue-600">Alice Vance (CS Year 3)</p>
                <p className="font-mono text-[9px] text-slate-400 mt-0.5">alice.vance@college.edu</p>
              </button>

              <button
                onClick={() => {
                  setRole("student");
                  setEmail("bob.sterling@college.edu");
                  setPassword("password");
                  setError(null);
                }}
                className="text-left bg-white hover:bg-slate-100 transition-colors p-2 rounded-xl border border-slate-200/80 group cursor-pointer"
              >
                <p className="font-semibold text-slate-800 text-[10px] truncate group-hover:text-blue-600">Bob Sterling (IT Year 2)</p>
                <p className="font-mono text-[9px] text-slate-400 mt-0.5">bob.sterling@college.edu</p>
              </button>

              <button
                onClick={() => {
                  setRole("student");
                  setEmail("charlie.dev@college.edu");
                  setPassword("password");
                  setError(null);
                }}
                className="text-left bg-white hover:bg-slate-100 transition-colors p-2 rounded-xl border border-slate-200/80 group cursor-pointer"
              >
                <p className="font-semibold text-slate-800 text-[10px] truncate group-hover:text-blue-600">Charlie Dev (ECE Year 4)</p>
                <p className="font-mono text-[9px] text-slate-400 mt-0.5">charlie.dev@college.edu</p>
              </button>

              <button
                onClick={() => {
                  setRole("student");
                  setEmail("diana.prince@college.edu");
                  setPassword("password");
                  setError(null);
                }}
                className="text-left bg-white hover:bg-slate-100 transition-colors p-2 rounded-xl border border-slate-200/80 group cursor-pointer"
              >
                <p className="font-semibold text-slate-800 text-[10px] truncate group-hover:text-blue-600">Diana Prince (CS Year 1)</p>
                <p className="font-mono text-[9px] text-slate-400 mt-0.5">diana.prince@college.edu</p>
              </button>

              <button
                onClick={() => {
                  setRole("organizer");
                  setEmail("marcus.vance@college.edu");
                  setPassword("password");
                  setError(null);
                }}
                className="text-left bg-white hover:bg-slate-100 transition-colors p-2 rounded-xl border border-slate-200/80 group cursor-pointer"
              >
                <p className="font-semibold text-slate-800 text-[10px] truncate group-hover:text-blue-600">Prof. Marcus (Admin/Organizer)</p>
                <p className="font-mono text-[9px] text-slate-400 mt-0.5">marcus.vance@college.edu</p>
              </button>

              <button
                onClick={() => {
                  setRole("organizer");
                  setEmail("alan.kay@college.edu");
                  setPassword("password");
                  setError(null);
                }}
                className="text-left bg-white hover:bg-slate-105 transition-colors p-2 rounded-xl border border-slate-200/80 group cursor-pointer"
              >
                <p className="font-semibold text-slate-800 text-[10px] truncate group-hover:text-blue-600">Dr. Alan Kay (Admin/Organizer)</p>
                <p className="font-mono text-[9px] text-slate-400 mt-0.5">alan.kay@college.edu</p>
              </button>

              <button
                onClick={() => {
                  setRole("organizer");
                  setEmail("admin@college.edu");
                  setPassword("password");
                  setError(null);
                }}
                className="text-left bg-white hover:bg-slate-100 transition-colors p-2 rounded-xl border border-slate-200/80 group cursor-pointer col-span-1 sm:col-span-2 lg:col-span-3 text-center"
              >
                <p className="font-semibold text-slate-800 text-[10px] truncate group-hover:text-blue-600 text-center">System Admin</p>
                <p className="font-mono text-[9px] text-slate-400 mt-0.5 text-center">admin@college.edu</p>
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM OPTION: TOGGLE SIMULATED EMAIL INBOX DRAWER VISIBILITY */}
        <div>
          <button
            onClick={() => {
              setShowInbox(!showInbox);
              fetchSimulatedEmails();
            }}
            className={`w-full py-2 px-4 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              showInbox 
                ? "bg-slate-900 border-slate-900 text-white" 
                : "bg-white hover:bg-slate-50 border-slate-250 text-slate-700"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            {showInbox ? "Hide Simulated Mail Box" : "Open Simulated Mail Box (IT Audit)"}
          </button>
        </div>
      </div>

      {/* AUTH INTERACTION COLUMN */}
      <div className="flex-1 flex flex-col justify-center p-8 lg:p-12 bg-slate-50/50">
        <div className="w-full max-w-sm mx-auto space-y-6">
          
          {/* Form Header */}
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {view === "login" && "Access Security Console"}
              {view === "register" && "Create New Account"}
              {view === "forgot" && "Account Recovery Center"}
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              {view === "login" && "Specify your campus role credentials to log initialized entries."}
              {view === "register" && "Choose Student or Admin/Organizer pathway to allocate keys."}
              {view === "forgot" && "Request an OTP verification sequence key to change credentials."}
            </p>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs leading-relaxed animate-in fade-in duration-150">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs leading-relaxed animate-in fade-in duration-150">
              {success}
            </div>
          )}

          {/* VIEW 1: SIGN IN */}
          {view === "login" && (
            <div className="space-y-4">
              {/* Role Picker */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/60 rounded-xl border border-slate-200">
                <button
                  onClick={() => {
                    setRole("student");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    role === "student"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Student Portal
                </button>
                <button
                  onClick={() => {
                    setRole("organizer");
                    setError(null);
                  }}
                  className={`flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    role === "organizer"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin / Organizer
                </button>
              </div>

              {/* Email field */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Campus Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="e.g., username@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-250 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Security Password</label>
                  <button
                    onClick={() => {
                      setView("forgot");
                      setForgotEmail(email);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-[11px] text-blue-600 hover:underline cursor-pointer font-semibold transition-all"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter security password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-250 rounded-xl pl-9 pr-10 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Join action */}
              <button
                onClick={() => handleLogin()}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-450 text-white font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                {isLoading ? "Validating Session Logs..." : "Sign In to Portal"}
              </button>

              {/* Footer Links */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  New on campus?{" "}
                  <button
                    onClick={() => {
                      setView("register");
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Create credentials profile
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* VIEW 2: REGISTER */}
          {view === "register" && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              
              {/* Registration Role Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Join Pathway Choice</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/60 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setRegRole("student")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      regRole === "student" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Student Signup
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegRole("organizer")}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      regRole === "organizer" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Admin / Organizer Signup
                  </button>
                </div>
              </div>

              {/* Full name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Full Official Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sandra Mason"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Path Specific: Student vs Organizer */}
              {regRole === "student" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Department</label>
                    <select
                      value={regDept}
                      onChange={(e) => setRegDept(e.target.value)}
                      className="w-full bg-white border border-slate-250 rounded-xl px-2 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="Information Technology">Information Technology</option>
                      <option value="Electronics Engineering">Electronics Engineering</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Electrical Science">Electrical Science</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Academic Year</label>
                    <select
                      value={regYear}
                      onChange={(e) => setRegYear(e.target.value)}
                      className="w-full bg-white border border-slate-250 rounded-xl px-2 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="1">1st Year (Fresh)</option>
                      <option value="2">2nd Year (Soph)</option>
                      <option value="3">3rd Year (Junior)</option>
                      <option value="4">4th Year (Senior)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Professional Role / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lead CSE Coordinator"
                    value={regRoleTitle}
                    onChange={(e) => setRegRoleTitle(e.target.value)}
                    className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}

              {/* Email address */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">College Email Address</label>
                <input
                  type="email"
                  required
                  placeholder={regRole === "student" ? "e.g., student.name@college.edu" : "e.g., professor@college.edu"}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none font-mono"
                />
              </div>

              {/* Contact telephone */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Contact Telephone</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 555-0104"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Secure Password */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Secure Password (min 6 chars)</label>
                <input
                  type="password"
                  required
                  placeholder="Create personal security password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isLoading ? "Signing Salt Keys..." : "Configure Credentials & Login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setView("login");
                  setError(null);
                  setSuccess(null);
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800 hover:underline pt-1 cursor-pointer font-medium"
              >
                Back to Sign In
              </button>
            </form>
          )}

          {/* VIEW 3: FORGOT PASSWORD */}
          {view === "forgot" && (
            <div className="space-y-4">
              
              {/* Back to sign in header */}
              <button
                onClick={() => {
                  setView("login");
                  setForgotStep(1);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 hover:underline font-semibold flex items-center gap-1.5 cursor-pointer pb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Login Panel
              </button>

              {/* Step 1: Type Email to get token */}
              {forgotStep === 1 ? (
                <form onSubmit={handleRequestResetToken} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Reset Target Role</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/60 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setRole("student")}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          role === "student" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Student Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole("organizer")}
                        className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          role === "organizer" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Admin / Organizer Profile
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Registered College Email</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. student.name@college.edu"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {isLoading ? "Generating Recovery Security Key..." : "Generate Verification Code"}
                  </button>
                </form>
              ) : (
                /* Step 2: Check code and reset */
                <form onSubmit={handleVerifyAndReset} className="space-y-4">
                  <div className="bg-slate-100 p-3 rounded-xl text-[11px] text-slate-600 leading-snug space-y-1">
                    <p className="font-semibold text-slate-800">Mailbox active:</p>
                    <p>OTP dispatched to <strong className="font-mono">{forgotEmail}</strong>. Copy verification code from Simulated Mail Box below.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Enter Verification Code</label>
                    <input
                      type="text"
                      required
                      placeholder="RESET-XXXXXX"
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value)}
                      className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Set New Password (min 6 chars)</label>
                    <input
                      type="password"
                      required
                      placeholder="Type your new password"
                      value={forgotNewPass}
                      onChange={(e) => setForgotNewPass(e.target.value)}
                      className="w-full bg-white border border-slate-250 rounded-xl px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Key className="w-3.5 h-3.5" />
                    {isLoading ? "Updating Security Hash..." : "Override Password & Reset"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="w-full text-center text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Resend Code
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>

      {/* FLOATING DRAWER: SIMULATED INBOX (REALTIME college email listener) */}
      {showInbox && (
        <div className="w-full lg:absolute lg:right-0 lg:bottom-0 lg:left-0 lg:bg-white lg:border-t lg:border-slate-350 bg-slate-100 max-h-[340px] px-6 py-4 overflow-y-auto animate-in slide-in-from-bottom duration-300 z-30 select-none shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                📬 Simulated College Mail Delivery Logs (Sandbox IT Monitor)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchSimulatedEmails}
                className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold font-mono cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 animate-spin-once" /> Fetch Latest
              </button>
              <button
                onClick={() => setShowInbox(false)}
                className="text-xs text-slate-400 hover:text-slate-800 font-bold font-mono cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>

          {emails.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {emails.map((e) => (
                <div key={e.email_id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2 hover:border-indigo-400 transition-colors">
                  <div className="flex items-center justify-between text-[10px] font-mono border-b border-slate-100 pb-1.5">
                    <span className="text-blue-600 font-semibold truncate max-w-[150px]">To: {e.to_email}</span>
                    <span className="text-slate-400 font-medium">#{e.email_id}</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-800 font-sans leading-tight">{e.subject}</p>
                  <pre className="text-[10px] font-mono text-slate-600 bg-slate-50/50 p-2 rounded-lg leading-relaxed whitespace-pre-wrap max-h-[120px] overflow-y-auto break-words">
                    {e.body_text}
                  </pre>
                  <p className="text-[9px] text-slate-400 font-mono text-right font-medium">
                    Delivered: {new Date(e.sent_at).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-mono">No simulation emails have been dispatched by the secure mail engine yet.</p>
              <p className="text-[10px] text-slate-500 font-mono mt-1">Actions like registering to events, forgot password codes, or sign-up will write logs here in real-time.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
