"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Cpu, Play, Shield, Terminal, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

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
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold hover:from-cyan-400 hover:to-blue-500 transition-all duration-300 shadow-lg shadow-cyan-500/15 hover:shadow-cyan-500/35 flex items-center justify-center gap-2 group"
                >
                  Request Corporate Demo
                  <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 font-semibold transition-colors flex items-center justify-center gap-2 group"
                >
                  <Play className="h-4 w-4 fill-cyan-400 text-cyan-400 group-hover:scale-110 transition-transform" />
                  Launch Sandbox
                </Link>
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
    </div>
  );
}
