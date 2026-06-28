"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cpu, Shield, Key, Eye, EyeOff, User, ArrowRight, HardHat, FileCheck, ClipboardList, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { createJWT } from "../../utils/jwt";

type UserRole = "Admin" | "Engineer" | "Manager" | "Auditor";

const roleDetails = {
  Admin: {
    title: "System Administrator",
    desc: "Full operational authority. Access to all system configurations, document deletions, and user access management.",
    icon: Settings,
    color: "text-rose-400 border-rose-950 bg-rose-950/25",
  },
  Engineer: {
    title: "Operations Engineer",
    desc: "Ingestion and querying authority. Upload engineering manuals, build the knowledge graph, and run RAG QA.",
    icon: HardHat,
    color: "text-cyan-400 border-cyan-950 bg-cyan-950/25",
  },
  Manager: {
    title: "Plant Manager",
    desc: "Operational monitoring authority. View system health, query SOPs, and monitor maintenance alert statuses.",
    icon: ClipboardList,
    color: "text-amber-400 border-amber-950 bg-amber-950/25",
  },
  Auditor: {
    title: "Compliance Auditor",
    desc: "Audit and regulatory authority. Access to citation verification, compliance reports, and immutable audit logs.",
    icon: FileCheck,
    color: "text-emerald-400 border-emerald-950 bg-emerald-950/25",
  },
};

const demoUsers = {
  Admin: { email: "admin@ikip-platform.com", name: "Sarah Jenkins" },
  Engineer: { email: "engineer@ikip-platform.com", name: "Alex Chen" },
  Manager: { email: "manager@ikip-platform.com", name: "Robert Duval" },
  Auditor: { email: "auditor@ikip-platform.com", name: "Helena Rostova" },
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("Engineer");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      let matchedUser = null;
      
      const demoUserKey = Object.keys(demoUsers).find(
        (key) => demoUsers[key as UserRole].email.toLowerCase() === normalizedEmail
      ) as UserRole | undefined;

      if (demoUserKey) {
        if (password !== "demo-password-2026") {
          setError("Incorrect password. Please try again.");
          setLoading(false);
          return;
        }
        matchedUser = {
          name: demoUsers[demoUserKey].name,
          email: demoUsers[demoUserKey].email,
          role: demoUserKey,
          company: "IKIP Demo Org"
        };
      } else {
        let registeredUsers = [];
        const storedUsers = localStorage.getItem("ikip_registered_users");
        if (storedUsers) {
          try {
            registeredUsers = JSON.parse(storedUsers);
          } catch (e) {
            registeredUsers = [];
          }
        }
        
        const found = registeredUsers.find((u: any) => u.email.toLowerCase() === normalizedEmail);
        if (!found) {
          setError("Invalid email. No account associated with this email address.");
          setLoading(false);
          return;
        }
        
        if (found.password !== password) {
          setError("Incorrect password. Please try again.");
          setLoading(false);
          return;
        }
        
        matchedUser = found;
      }

      setRole(matchedUser.role);

      const avatarSeed = matchedUser.name.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U";
      
      const expirationSeconds = rememberMe ? (30 * 24 * 60 * 60) : (2 * 60 * 60);
      const exp = Math.floor(Date.now() / 1000) + expirationSeconds;
      
      const jwtPayload = {
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role,
        company: matchedUser.company || "IKIP Platform",
        exp
      };

      const token = await createJWT(jwtPayload);

      let cookieString = `ikip_session_token=${token}; path=/; SameSite=Lax; Secure`;
      if (rememberMe) {
        cookieString += `; max-age=${expirationSeconds}`;
      }
      document.cookie = cookieString;

      const session = {
        email: matchedUser.email,
        name: matchedUser.name,
        role: matchedUser.role,
        avatarSeed,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem("ikip_session", JSON.stringify(session));
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred during authentication.");
      setLoading(false);
    }
  };

  const fillDemoUser = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setEmail(demoUsers[selectedRole].email);
    setPassword("demo-password-2026");
  };

  const SelectedRoleIcon = roleDetails[role].icon;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-stretch overflow-hidden">
      {/* Left Column: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 md:p-16 relative z-10 bg-zinc-950/40">
        
        {/* Header Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-cyan-500/50 transition-colors">
              <Cpu className="h-5.5 w-5.5 text-cyan-400" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              IKIP <span className="text-cyan-400 font-normal text-xs ml-0.5">2.0</span>
            </span>
          </Link>
        </div>

        {/* Login Card */}
        <div className="max-w-md w-full mx-auto my-12">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              Enterprise Sign In
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
              Access the Industrial Knowledge Intelligence Platform.
            </p>
          </div>

          {error && (
            <div className="bg-rose-950/30 border border-rose-900 text-rose-400 text-xs rounded-xl p-3.5 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Select Your Role Profile
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(roleDetails) as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all duration-250 text-center flex flex-col items-center gap-1.5 ${
                      role === r
                        ? "border-cyan-500/70 bg-cyan-950/20 text-cyan-400 shadow-md shadow-cyan-500/5"
                        : "border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                  >
                    {React.createElement(roleDetails[r].icon, { className: "h-4 w-4" })}
                    <span>{r}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Work Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-550 outline-none transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Password
                </label>
                <a href="#" className="text-xs text-cyan-400 hover:text-cyan-300">
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                  <Key className="h-4 w-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-3 pl-10 pr-10 text-sm text-zinc-100 placeholder-zinc-550 outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-cyan-500 rounded border-zinc-800 bg-zinc-900 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                Remember Me
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-bold hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Authenticate Session
                  <ArrowRight className="h-4.5 w-4.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick-Fill Section */}
          <div className="mt-8 pt-6 border-t border-zinc-900">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest block mb-3">
              Sandbox Quick-Connect
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(demoUsers) as UserRole[]).map((selectedRole) => (
                <button
                  key={selectedRole}
                  type="button"
                  onClick={() => fillDemoUser(selectedRole)}
                  className="py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-left text-xs flex items-center justify-between group transition-colors"
                >
                  <div>
                    <span className="font-semibold block text-zinc-300">{selectedRole}</span>
                    <span className="text-[9px] font-mono text-zinc-500 block">Quick Ingress</span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center sm:text-left">
          <p className="text-xs text-zinc-600">
            New to the platform?{" "}
            <Link href="/signup" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              Request access credentials
            </Link>
          </p>
        </div>

      </div>

      {/* Right Column: Visual Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 border-l border-zinc-800 relative items-center justify-center p-12 overflow-hidden">
        {/* Technical grids and meshes */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-cyan-500/[0.015] blur-3xl pointer-events-none" />
        
        {/* Role Privileges Card */}
        <motion.div
          key={role}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 backdrop-blur-md relative"
        >
          {/* Header indicator */}
          <div className="flex items-center justify-between mb-8">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
              Role Authority Ledger
            </span>
            <div className={`p-2 rounded-lg border ${roleDetails[role].color}`}>
              <SelectedRoleIcon className="h-5 w-5" />
            </div>
          </div>

          <h3 className="text-2xl font-bold text-zinc-100">
            {roleDetails[role].title}
          </h3>
          <p className="text-sm text-zinc-450 mt-2 leading-relaxed">
            {roleDetails[role].desc}
          </p>

          <div className="mt-8 pt-6 border-t border-zinc-900/80 space-y-4">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Assigned Privileges
            </h4>
            
            <div className="space-y-3">
              {role === "Admin" && [
                "Full read-write-delete access to Vector & Graph Stores",
                "Ingestion queue priority and LLM model swapping",
                "Access control ledger & security audit trail purging",
                "On-premise hardware cluster telemetry dashboard",
              ].map((priv, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <span>{priv}</span>
                </div>
              ))}

              {role === "Engineer" && [
                "Document uploading and deletion in the library",
                "Entity resolution and relationship extraction editing",
                "Full RAG QA querying with citation verification",
                "Interactive Knowledge Graph visualization custom layout",
              ].map((priv, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 shrink-0" />
                  <span>{priv}</span>
                </div>
              ))}

              {role === "Manager" && [
                "Operational dashboard monitoring & plant analytics",
                "Natural language RAG QA querying across SOPs",
                "Full read-only Knowledge Graph exploration",
                "User activity logs & query feedback monitoring",
              ].map((priv, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>{priv}</span>
                </div>
              ))}

              {role === "Auditor" && [
                "Immutable compliance audit log exporting",
                "Verifiable citation source-tracing & document review",
                "Read-only access to regulatory standards & SOPs",
                "System answer feedback & accuracy flagging",
              ].map((priv, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>{priv}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
