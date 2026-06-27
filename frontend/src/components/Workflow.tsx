"use client";

import React from "react";
import { Upload, Cpu, Network, Database, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: Upload,
    title: "1. Multi-Source Ingestion",
    description: "Ingest PDFs, XMLs, CAD metadata, and DOCX files. Supports manual upload via the Library dashboard or automatic synchronization with enterprise document management systems (DMS).",
    badge: "Ingestion Engine",
    tech: "OCR, LayoutLM, PyPDF",
  },
  {
    icon: Cpu,
    title: "2. Layout-Aware Parsing",
    description: "Deconstruct documents into clean semantic units. The ingestion pipeline extracts tables, parses headers, processes footnotes, and isolates technical schematics without losing structural context.",
    badge: "Parsing Pipeline",
    tech: "Nougat, TableTransformer",
  },
  {
    icon: Network,
    title: "3. Entity & Relation Extraction",
    description: "Extract industrial entities (e.g. pumps, compressors, valves) and their relationships (e.g. 'part-of', 'regulates', 'monitored-by') using fine-tuned NLP models to construct the operational knowledge graph.",
    badge: "Entity Linker",
    tech: "GLiNER, Llama-3-70B",
  },
  {
    icon: Database,
    title: "4. Hybrid Dual-Store Indexing",
    description: "Index text chunks as high-dimensional vector embeddings in our vector store (Chroma), while simultaneously saving structured entity relationships in our Graph Database.",
    badge: "Storage Engine",
    tech: "ChromaDB, NetworkX",
  },
  {
    icon: MessageSquare,
    title: "5. Citations-Verified RAG QA",
    description: "Ask natural language questions. The engine performs hybrid retrieval (vector + graph), synthesizes the answer, and appends precise, clickable citations pointing directly to the source page and text.",
    badge: "Reasoning Agent",
    tech: "Cross-Encoder, Reranker",
  },
];

export default function Workflow() {
  return (
    <section id="workflow" className="py-24 bg-zinc-900/20 border-y border-zinc-900 relative overflow-hidden">
      {/* Grid pattern background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370a_1px,transparent_1px),linear-gradient(to_bottom,#1f29370a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-full">
              Operational Pipeline
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-zinc-100">
              The Knowledge Ingestion <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-amber-500">
                & Reasoning Lifecycle
              </span>
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              How the platform transforms raw engineering documents into structured, queryable, and auditable enterprise intelligence.
            </p>
          </motion.div>
        </div>

        <div className="relative">
          {/* Vertical Timeline Line */}
          <div className="absolute left-4 md:left-1/2 top-2 bottom-2 w-[2px] bg-gradient-to-b from-cyan-500 via-zinc-800 to-amber-500 transform md:-translate-x-1/2" />

          {/* Timeline Steps */}
          <div className="space-y-16 md:space-y-24">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isEven = idx % 2 === 0;
              return (
                <div
                  key={idx}
                  className={`flex flex-col md:flex-row ${
                    isEven ? "md:flex-row-reverse" : ""
                  } relative`}
                >
                  {/* Timeline Node Icon */}
                  <div className="absolute left-4 md:left-1/2 w-8 h-8 rounded-full bg-zinc-950 border-2 border-cyan-500 flex items-center justify-center transform -translate-x-1/2 z-20 shadow-lg shadow-cyan-500/20">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  </div>

                  {/* Content Panel */}
                  <div className="w-full md:w-[calc(50%-2.5rem)] ml-12 md:ml-0">
                    <motion.div
                      initial={{ opacity: 0, x: isEven ? 50 : -50 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ type: "spring", stiffness: 80, damping: 12 }}
                      className="p-8 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 hover:border-zinc-700/60 transition-all duration-300 backdrop-blur-sm relative group"
                    >
                      {/* Subtle hover background highlight */}
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl -z-10" />

                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[10px] font-mono font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-900 px-2 py-0.5 rounded uppercase tracking-wider">
                          {step.badge}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {step.tech}
                        </span>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
                          <Icon className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-zinc-100 mb-2">
                            {step.title}
                          </h3>
                          <p className="text-sm leading-relaxed text-zinc-400 group-hover:text-zinc-300 transition-colors">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  {/* Empty Spacer Column on Desktop */}
                  <div className="hidden md:block w-[calc(50%-2.5rem)]" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
