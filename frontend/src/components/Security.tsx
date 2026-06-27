"use client";

import React from "react";
import { Shield, Key, Eye, Lock, HardHat, FileCheck } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Lock,
    title: "Air-Gapped Deployment",
    description: "Supports fully disconnected, on-premise, or private VPC deployments (AWS, Azure, GCP) ensuring no operational data ever leaves your secure perimeter.",
  },
  {
    icon: Key,
    title: "Granular RBAC",
    description: "Enterprise-grade role-based access control mapping to industrial hierarchies. Control who can ingest documents, query RAG, or audit system configurations.",
  },
  {
    icon: Eye,
    title: "Comprehensive Audit Logs",
    description: "Every query, upload, and LLM reasoning step is logged with immutable cryptographic timestamps, creating a clean audit trail for safety compliance.",
  },
  {
    icon: FileCheck,
    title: "Regulatory Alignment",
    description: "Pre-configured mapping to key industrial standards including OSHA, ISO 9001, ISO 14001, and regional environmental regulations.",
  },
];

export default function Security() {
  return (
    <section id="security" className="py-24 bg-zinc-900/40 border-y border-zinc-900/50 relative overflow-hidden">
      {/* Background glowing orb */}
      <div className="absolute top-1/2 right-10 -translate-y-1/2 w-96 h-96 bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          
          {/* Badge and Title Panel */}
          <div className="w-full lg:w-1/2">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-full">
              Enterprise Security & Compliance
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              Zero-Trust Architecture for <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                Critical Infrastructure
              </span>
            </h2>
            <p className="mt-4 text-zinc-400 leading-relaxed max-w-xl">
              We understand that industrial data is proprietary and highly sensitive. Our platform is designed from the ground up to meet the rigorous security, safety, and compliance standards of Fortune 500 industrial enterprises.
            </p>

            {/* Compliance Badges */}
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { name: "SOC 2 TYPE II", status: "COMPLIANT" },
                { name: "ISO 27001", status: "CERTIFIED" },
                { name: "GDPR", status: "COMPLIANT" },
                { name: "HIPAA / OSHA", status: "COMPLIANT" },
              ].map((badge, idx) => (
                <div key={idx} className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl text-center">
                  <span className="block text-[10px] font-mono text-zinc-500">{badge.status}</span>
                  <span className="block text-xs font-bold text-zinc-200 mt-1">{badge.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grid of Security Features */}
          <div className="w-full lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="bg-zinc-950/80 border border-zinc-850 p-6 rounded-2xl hover:border-zinc-700/50 transition-all duration-300 group"
                >
                  <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400 w-fit mb-4 group-hover:bg-emerald-950/20 group-hover:border-emerald-900/50 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-100 mb-2 group-hover:text-emerald-300 transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    {feat.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
