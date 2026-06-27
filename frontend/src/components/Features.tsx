"use client";

import React from "react";
import { Database, Network, Cpu, Shield, FileText, Search } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Cpu,
    title: "Industrial-Scale RAG",
    description: "Deep semantic understanding of complex industrial schemas, piping & instrumentation diagrams (P&IDs), standard operating procedures (SOPs), and equipment manuals.",
    color: "from-cyan-500/20 to-blue-500/20",
    iconColor: "text-cyan-400",
  },
  {
    icon: Network,
    title: "Enterprise Knowledge Graphs",
    description: "Automated extraction of entities (turbines, valves, sensors) and relationships (part-of, monitors, controls) to create an interconnected digital twin of operational intelligence.",
    color: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: FileText,
    title: "Deterministic Citations",
    description: "Eliminate hallucination in high-risk environments. Every system response is backed by pinpoint, verifiable citations linking directly to document names, page numbers, and exact text snippets.",
    color: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: Database,
    title: "Context-Aware Ingestion",
    description: "Advanced document parsing that preserves layout hierarchy, tables, headers, and metadata, ensuring that data chunking maintains complete structural context.",
    color: "from-indigo-500/20 to-purple-500/20",
    iconColor: "text-indigo-400",
  },
  {
    icon: Shield,
    title: "Role-Ready RBAC",
    description: "Granular access control tailored for industrial hierarchies. Specialized views and permissions for Admins, Operations Engineers, Plant Managers, and Compliance Auditors.",
    color: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-400",
  },
  {
    icon: Search,
    title: "Hybrid Vector & Keyword Search",
    description: "Combines dense vector embeddings for conceptual matching with sparse lexical search for exact industrial part numbers, codes, and tag IDs (e.g., 'VALVE-XV-102').",
    color: "from-violet-500/20 to-fuchsia-500/20",
    iconColor: "text-violet-400",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function Features() {
  return (
    <section id="features" className="py-24 relative overflow-hidden bg-zinc-950">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-full">
              Platform Capabilities
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-100">
              Cognitive Intelligence for <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500">
                Industrial Operations
              </span>
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Bridge the gap between unstructured engineering documents and real-time operational decision making with our enterprise-grade RAG and Knowledge Graph engine.
            </p>
          </motion.div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
        >
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={idx}
                variants={cardVariants}
                whileHover={{ y: -6 }}
                className="relative group overflow-hidden rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/50 p-8 transition-all duration-300 backdrop-blur-sm"
              >
                {/* Glow Effect */}
                <div className={`absolute -inset-px bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`} />
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

                <div className="flex items-center justify-between mb-6">
                  <div className={`p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 group-hover:border-zinc-700/60 transition-colors`}>
                    <Icon className={`h-6 w-6 ${feature.iconColor}`} />
                  </div>
                  <span className="text-xs font-mono text-zinc-600 group-hover:text-zinc-500 transition-colors">
                    [0{idx + 1}]
                  </span>
                </div>

                <h3 className="text-xl font-bold text-zinc-100 group-hover:text-cyan-300 transition-colors mb-3">
                  {feature.title}
                </h3>
                
                <p className="text-sm leading-relaxed text-zinc-400 group-hover:text-zinc-300 transition-colors">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
