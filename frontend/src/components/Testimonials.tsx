"use client";

import React from "react";
import { Quote, ArrowRight, Star, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const testimonials = [
  {
    quote: "IKIP has transformed how our field engineers access maintenance procedures. What used to take hours of digging through paper binders and legacy sharepoint folders now takes 10 seconds. The citations are a game changer for safety.",
    author: "Dr. Marcus Vance",
    role: "VP of Digital Operations",
    company: "AeroGen Utilities",
    avatarColor: "bg-cyan-500/20 text-cyan-400",
  },
  {
    quote: "Compliance auditing used to be our most stressful quarter. With the Auditor role in IKIP, our regulatory auditors can search our entire SOP library and instantly verify compliance with ISO and OSHA standards. Outstanding product.",
    author: "Elena Rostova",
    role: "Lead Compliance Auditor",
    company: "Apex Petrochemicals",
    avatarColor: "bg-amber-500/20 text-amber-400",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-zinc-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute bottom-0 left-0 right-0 h-96 bg-cyan-500/[0.01] blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-full">
              Case Studies & Feedback
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              Trusted by Leading <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-amber-500">
                Industrial Operators
              </span>
            </h2>
          </motion.div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {testimonials.map((test, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: idx === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, type: "spring" }}
              className="bg-zinc-900/30 border border-zinc-800/60 p-8 rounded-2xl relative flex flex-col justify-between backdrop-blur-sm hover:border-zinc-700/50 transition-all duration-300"
            >
              <div>
                <div className="flex items-center gap-1 text-amber-500 mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-500" />
                  ))}
                </div>
                <Quote className="h-10 w-10 text-cyan-500/10 absolute top-8 right-8" />
                <p className="text-base text-zinc-300 leading-relaxed italic relative z-10">
                  "{test.quote}"
                </p>
              </div>

              <div className="mt-8 flex items-center gap-4 pt-6 border-t border-zinc-900">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${test.avatarColor}`}>
                  {test.author.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100">{test.author}</h4>
                  <p className="text-xs text-zinc-500">
                    {test.role} &bull; <span className="text-zinc-400">{test.company}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Call to Action Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-cyan-950/40 via-zinc-900/50 to-amber-950/20 border border-zinc-800/80 p-8 md:p-12 text-center"
        >
          {/* Subtle decorative mesh */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.1),transparent)] pointer-events-none" />

          <h3 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-4">
            Ready to Accelerate Your Plant Intelligence?
          </h3>
          <p className="text-zinc-400 max-w-2xl mx-auto mb-8 text-sm sm:text-base">
            Upload your first set of standard operating procedures and start querying with industrial accuracy in less than 5 minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 font-bold hover:from-cyan-400 hover:to-blue-500 transition-all duration-300 shadow-lg shadow-cyan-500/15 hover:shadow-cyan-500/30 flex items-center justify-center gap-2 group"
            >
              Get Started Instantly
              <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquare className="h-4.5 w-4.5 text-cyan-400" />
              Launch Sandbox Demo
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
