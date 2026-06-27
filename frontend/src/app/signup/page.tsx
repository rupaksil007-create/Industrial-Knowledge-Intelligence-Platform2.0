"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cpu, User, Mail, Building, Key, Shield, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

type UserRole = "Admin" | "Engineer" | "Manager" | "Auditor";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("Engineer");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !company || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!agree) {
      setError("You must agree to the Terms of Service.");
      return;
    }

    setLoading(true);
    setError("");

    // Simulate registration and auto-login
    setTimeout(() => {
      setSubmitted(true);
      const session = {
        email,
        name,
        role,
        company,
        avatarSeed: name.split(" ").map(n => n[0]).join(""),
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem("ikip_session", JSON.stringify(session));
      
      // Redirect to dashboard after a short success screen
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    }, 1200);
  };

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

        {/* Form Container */}
        <div className="max-w-md w-full mx-auto my-10">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 rounded-full bg-cyan-950/40 border border-cyan-800 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-cyan-400" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-100 mb-3">Registration Complete</h2>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Welcome, <span className="text-zinc-200 font-semibold">{name}</span>. Your sandbox session has been initialized. Redirecting you to the dashboard...
              </p>
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </motion.div>
          ) : (
            <div>
              <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
                  Request Sandbox Access
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
                  Set up your profile to explore the RAG and Knowledge Graph.
                </p>
              </div>

              {error && (
                <div className="bg-rose-950/30 border border-rose-900 text-rose-400 text-xs rounded-xl p-3.5 mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSignup} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                      <User className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-550 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Work Email */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Work Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane.doe@company.com"
                      className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-550 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Company / Organization
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                      <Building className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Enter company name"
                      className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-550 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Role Profile
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["Admin", "Engineer", "Manager", "Auditor"] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-2 px-1 rounded-xl text-[11px] font-semibold border transition-all duration-200 text-center ${
                          role === r
                            ? "border-cyan-500/70 bg-cyan-950/20 text-cyan-400"
                            : "border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500 pointer-events-none">
                      <Key className="h-4 w-4" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-550 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Terms checkbox */}
                <div className="flex items-start gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="agree"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-1 accent-cyan-500 rounded border-zinc-800 bg-zinc-900"
                  />
                  <label htmlFor="agree" className="text-xs text-zinc-400 leading-normal select-none">
                    I agree to the{" "}
                    <a href="#" className="text-cyan-400 hover:text-cyan-300">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-cyan-400 hover:text-cyan-300">
                      Privacy Policy
                    </a>
                    .
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-bold hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Request Access Token
                      <ArrowRight className="h-4.5 w-4.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center sm:text-left">
          <p className="text-xs text-zinc-600">
            Already have sandbox access?{" "}
            <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold">
              Sign In here
            </Link>
          </p>
        </div>

      </div>

      {/* Right Column: Visual Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 border-l border-zinc-800 relative items-center justify-center p-12 overflow-hidden">
        {/* Technical grids and meshes */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
        <div className="absolute w-[600px] h-[600px] rounded-full bg-cyan-500/[0.015] blur-3xl pointer-events-none" />

        <div className="max-w-md w-full text-center">
          <div className="inline-flex p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/30 text-cyan-400 mb-6 animate-pulse">
            <Shield className="h-10 w-10" />
          </div>
          <h3 className="text-2xl font-bold text-zinc-100">
            Secure sandbox environment
          </h3>
          <p className="text-sm text-zinc-450 mt-3 leading-relaxed">
            The IKIP Sandbox is a fully functional, containerized simulation of the production platform. Try out ingestion, entity parsing, and RAG QA without affecting production assets.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4 text-left">
            {[
              { label: "Isolated Database", desc: "Separate vector/graph stores for sandbox sessions." },
              { label: "Role Telemetry", desc: "Switch roles on the fly to test different permissions." },
            ].map((item, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-850">
                <span className="text-xs font-bold text-zinc-200 block">{item.label}</span>
                <span className="text-[11px] text-zinc-500 block mt-1 leading-normal">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
