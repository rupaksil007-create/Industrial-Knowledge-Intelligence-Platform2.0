"use client";

import React from "react";
import { Check, HelpCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

const tiers = [
  {
    name: "Pilot",
    price: "$1,200",
    period: "per plant / month",
    description: "Perfect for evaluating the platform's capabilities on a single operational site.",
    features: [
      "1 Operational Plant Site",
      "Up to 10 Engineer/Operator Users",
      "5 GB Document Library Capacity",
      "Standard Vector RAG QA",
      "Next-business-day Email Support",
      "Standard Encryption (Transit/Rest)",
    ],
    cta: "Start 30-Day Pilot",
    popular: false,
    highlight: "border-zinc-800 bg-zinc-900/10",
  },
  {
    name: "Professional",
    price: "$4,500",
    period: "per plant / month",
    description: "Designed for scaling cognitive search and relationship mapping across multiple facilities.",
    features: [
      "Up to 5 Operational Plant Sites",
      "Up to 100 Active Users",
      "50 GB Document Library Capacity",
      "Hybrid RAG (Vector + Knowledge Graph)",
      "Automated Tag & Entity Resolution",
      "Dedicated Customer Success Manager",
      "2-Hour Emergency Support SLA",
    ],
    cta: "Scale Your Operations",
    popular: true,
    highlight: "border-cyan-500/60 bg-cyan-950/10 shadow-lg shadow-cyan-500/5",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "tailored agreements",
    description: "Full-scale corporate deployment with dedicated resources, custom models, and maximum security.",
    features: [
      "Unlimited Plant Sites & Facilities",
      "Unlimited Users (Corporate License)",
      "Uncapped Document Storage",
      "On-Premise / Air-Gapped Deployment",
      "Custom Fine-tuned LLM Models",
      "SSO/SAML Integration & Advanced RBAC",
      "24/7/365 Dedicated Phone Support",
    ],
    cta: "Contact Sales",
    popular: false,
    highlight: "border-zinc-800 bg-zinc-900/10",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-zinc-900/20 border-t border-zinc-900 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-cyan-500/[0.01] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-full">
              Flexible Deployment Tiers
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              Transparent, Value-Driven <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-amber-500">
                Enterprise Pricing
              </span>
            </h2>
            <p className="mt-4 text-zinc-400 text-sm sm:text-base">
              All plans include core RAG capabilities. Professional and Enterprise tiers add advanced Knowledge Graph mapping and custom deployment models.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {tiers.map((tier, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.6 }}
              className={`flex flex-col justify-between rounded-2xl border p-8 backdrop-blur-sm relative group hover:border-zinc-700 transition-colors duration-300 ${tier.highlight}`}
            >
              {tier.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500 text-zinc-950 shadow-md">
                  Most Popular
                </span>
              )}

              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-zinc-100">{tier.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{tier.description}</p>
                </div>

                <div className="flex items-baseline gap-1.5 mb-8">
                  <span className="text-4xl font-extrabold text-zinc-100 tracking-tight">{tier.price}</span>
                  <span className="text-xs text-zinc-500 font-medium">{tier.period}</span>
                </div>

                <div className="space-y-4 mb-8">
                  <span className="text-xs font-semibold text-zinc-400 block uppercase tracking-wider">
                    What's included
                  </span>
                  <ul className="space-y-3">
                    {tier.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5 text-xs text-zinc-300">
                        <Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-auto">
                <Link
                  href={tier.cta === "Contact Sales" ? "/signup?plan=enterprise" : "/signup"}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 group transition-all duration-300 ${
                    tier.popular
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950"
                      : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {tier.cta}
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
