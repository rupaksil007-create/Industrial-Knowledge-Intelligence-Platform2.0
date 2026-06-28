"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Cpu, Play, Shield, Terminal, CheckCircle2, X } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

// Dynamically import the 3D component with SSR disabled
const Industrial3D = dynamic(() => import("../components/Industrial3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] md:min-h-[500px] flex items-center justify-center bg-zinc-950/20 border border-zinc-900 rounded-2xl">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-zinc-500">Initializing 3D Lattice...</span>
      </div>
    </div>
  ),
});

// Import other sections
import Navbar from "../components/Navbar";
import Features from "../components/Features";
import Workflow from "../components/Workflow";
import GraphPreview from "../components/GraphPreview";
import Security from "../components/Security";
import Testimonials from "../components/Testimonials";
import Pricing from "../components/Pricing";
import Footer from "../components/Footer";

export default function LandingPage() {
  const router = useRouter();
  const [modalType, setModalType] = useState<null | "demo" | "corporate">(null);
  
  // Standard demo request form state
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoCompany, setDemoCompany] = useState("");
  const [demoUseCase, setDemoUseCase] = useState("");
  const [demoSuccess, setDemoSuccess] = useState(false);

  // Corporate enterprise form state
  const [corpName, setCorpName] = useState("");
  const [corpEmail, setCorpEmail] = useState("");
  const [corpCompany, setCorpCompany] = useState("");
  const [corpDeployment, setCorpDeployment] = useState("SaaS");
  const [corpMessage, setCorpMessage] = useState("");
  const [corpSuccess, setCorpSuccess] = useState(false);

  const handleLaunchSandbox = (e: React.MouseEvent) => {
    e.preventDefault();
    const hasToken = document.cookie.includes("ikip_session_token");
    if (hasToken) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSuccess(true);
    setTimeout(() => {
      setDemoSuccess(false);
      setModalType(null);
      setDemoName("");
      setDemoEmail("");
      setDemoCompany("");
      setDemoUseCase("");
    }, 2000);
  };

  const handleCorpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCorpSuccess(true);
    setTimeout(() => {
      setCorpSuccess(false);
      setModalType(null);
      setCorpName("");
      setCorpEmail("");
      setCorpCompany("");
      setCorpMessage("");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-cyan-500 selection:text-zinc-950">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <main className="flex-grow pt-28 md:pt-36 pb-20 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,rgba(6,182,212,0.08),transparent)] pointer-events-none" />
        <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-[30%] right-[10%] w-72 h-72 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Hero Text */}
            <div className="lg:col-span-6 flex flex-col gap-6 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800/80 w-fit mx-auto lg:mx-0"
              >
                <Terminal className="h-4 w-4 text-cyan-400" />
                <span className="text-[10px] sm:text-xs font-mono text-zinc-400">
                  v2.0 Active: Hybrid RAG & Graph Engine
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
                className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]"
              >
                Cognitive Intelligence <br className="hidden sm:block" />
                for{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500">
                  Heavy Industry
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-base sm:text-lg text-zinc-400 max-w-xl mx-auto lg:mx-0 leading-relaxed"
              >
                Synthesize standard operating procedures, manuals, and compliance documentation. Map equipment tag relations and query RAG QA with deterministic citations.
              </motion.p>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mt-2"
              >
                <Link
                  href="/signup"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold hover:from-cyan-400 hover:to-blue-500 transition-all duration-300 shadow-lg shadow-cyan-500/15 hover:shadow-cyan-500/35 flex items-center justify-center gap-2 group"
                >
                  Get Started Free
                  <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 font-semibold transition-colors flex items-center justify-center gap-2 group"
                >
                  Sign In
                </Link>
              </motion.div>

              {/* Operations & Demo Actions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.8 }}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 mt-4 text-xs font-mono"
              >
                <button
                  onClick={handleLaunchSandbox}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 fill-cyan-400 text-cyan-400" />
                  Launch Sandbox
                </button>
                <span className="text-zinc-700 hidden sm:inline">|</span>
                <button
                  onClick={() => setModalType("demo")}
                  className="text-zinc-450 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Request Demo
                </button>
                <span className="text-zinc-700 hidden sm:inline">|</span>
                <button
                  onClick={() => setModalType("corporate")}
                  className="text-zinc-450 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Request Corporate Demo
                </button>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="grid grid-cols-3 gap-4 pt-8 border-t border-zinc-900/80 mt-4 max-w-md mx-auto lg:mx-0 text-left"
              >
                <div>
                  <span className="block text-xl sm:text-2xl font-extrabold text-cyan-400">99.8%</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider block mt-1">Citation Accuracy</span>
                </div>
                <div>
                  <span className="block text-xl sm:text-2xl font-extrabold text-amber-400">&lt; 5s</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider block mt-1">Query Latency</span>
                </div>
                <div>
                  <span className="block text-xl sm:text-2xl font-extrabold text-emerald-400">SOC 2</span>
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider block mt-1">Air-Gapped Ready</span>
                </div>
              </motion.div>
            </div>

            {/* 3D Visualizer Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="lg:col-span-6 relative aspect-square lg:aspect-auto lg:h-[500px] w-full"
            >
              {/* Decorative Tech Borders */}
              <div className="absolute inset-0 border border-zinc-800/40 rounded-3xl overflow-hidden bg-zinc-900/10 backdrop-blur-sm">
                {/* 3D Canvas */}
                <Industrial3D />
              </div>

              {/* Blueprint Grid Lines Overlay */}
              <div className="absolute top-4 left-4 text-[9px] font-mono text-zinc-600 pointer-events-none">
                GRID_SCALE: 1.25m <br />
                SYSTEM_MODE: SIMULATION
              </div>
              <div className="absolute bottom-4 right-4 text-[9px] font-mono text-zinc-600 pointer-events-none">
                ROTATION: AUTO <br />
                STATUS: ENCRYPTED
              </div>
            </motion.div>

          </div>
        </div>
      </main>

      {/* Features Showcase */}
      <Features />

      {/* Workflow Pipeline */}
      <Workflow />

      {/* Knowledge Graph Preview */}
      <GraphPreview />

      {/* Security & Compliance */}
      <Security />

      {/* Testimonials */}
      <Testimonials />

      {/* Pricing Section */}
      <Pricing />

      {/* Footer */}
      <Footer />

      {/* Modals */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-sm cursor-pointer"
            onClick={() => setModalType(null)}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-2xl shadow-cyan-500/5 max-h-[90vh] overflow-y-auto z-10"
          >
            <button
              onClick={() => setModalType(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-900"
            >
              <X className="h-5 w-5" />
            </button>

            {modalType === "demo" ? (
              demoSuccess ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-cyan-950/40 border border-cyan-800/80 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="h-7 w-7 text-cyan-400 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-2">Request Submitted</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Thank you, <span className="text-zinc-200 font-semibold">{demoName}</span>. Your demo request for <span className="text-zinc-200 font-semibold">{demoCompany}</span> has been registered. Our operations team will contact you shortly.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-6 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/30 text-cyan-400">
                      <Cpu className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100">Request Standard Demo</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">Explore IKIP 2.0 with guided operations scenarios.</p>
                    </div>
                  </div>

                  <form onSubmit={handleDemoSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={demoName}
                        onChange={(e) => setDemoName(e.target.value)}
                        placeholder="Sarah Jenkins"
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Work Email
                      </label>
                      <input
                        type="email"
                        value={demoEmail}
                        onChange={(e) => setDemoEmail(e.target.value)}
                        placeholder="sarah.j@company.com"
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={demoCompany}
                        onChange={(e) => setDemoCompany(e.target.value)}
                        placeholder="Chevron Heavy Industries"
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Sandbox Use Case (Optional)
                      </label>
                      <textarea
                        value={demoUseCase}
                        onChange={(e) => setDemoUseCase(e.target.value)}
                        placeholder="Describe your operational retrieval or tag mapping requirements..."
                        rows={3}
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold hover:from-cyan-400 hover:to-blue-500 transition-all duration-300 shadow-md shadow-cyan-500/10 hover:shadow-cyan-500/25 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      Request Sandbox Demo
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              )
            ) : (
              corpSuccess ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-cyan-950/40 border border-cyan-800/80 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="h-7 w-7 text-cyan-400 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-2">Corporate Request Received</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Thank you, <span className="text-zinc-200 font-semibold">{corpName}</span>. Your enterprise demo request for <span className="text-zinc-200 font-semibold">{corpCompany}</span> has been processed. Our plant integration team will email you at <span className="text-zinc-200 font-semibold">{corpEmail}</span> to arrange a briefing session.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-6 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/30 text-cyan-400">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-zinc-100">Request Corporate Demo</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">Contact Enterprise Sales for Air-Gapped deployment options.</p>
                    </div>
                  </div>

                  <form onSubmit={handleCorpSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        value={corpName}
                        onChange={(e) => setCorpName(e.target.value)}
                        placeholder="Alex Chen"
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Corporate Email
                      </label>
                      <input
                        type="email"
                        value={corpEmail}
                        onChange={(e) => setCorpEmail(e.target.value)}
                        placeholder="alex.chen@siemens.com"
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={corpCompany}
                        onChange={(e) => setCorpCompany(e.target.value)}
                        placeholder="Siemens Power Generation"
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Deployment Type
                      </label>
                      <select
                        value={corpDeployment}
                        onChange={(e) => setCorpDeployment(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 outline-none transition-colors cursor-pointer"
                      >
                        <option value="SaaS">SaaS Platform (Hosted)</option>
                        <option value="Private Cloud">Private Cloud (AWS/Azure VPC)</option>
                        <option value="On-Premise">On-Premise (Air-Gapped Cluster)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Brief Scope of Work
                      </label>
                      <textarea
                        value={corpMessage}
                        onChange={(e) => setCorpMessage(e.target.value)}
                        placeholder="Provide details on facility size, number of tags, or compliance standards (e.g. ISO 55001)..."
                        rows={3}
                        className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-cyan-500/50 rounded-xl py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold hover:from-cyan-400 hover:to-blue-500 transition-all duration-300 shadow-md shadow-cyan-500/10 hover:shadow-cyan-500/25 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      Submit Corporate RFP
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              )
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
