"use client";

import React from "react";
import Link from "next/link";
import { Cpu, Github, Linkedin, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          
          {/* Logo & Description */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-zinc-900 border border-zinc-800">
                <Cpu className="h-4.5 w-4.5 text-cyan-400" />
              </div>
              <span className="font-bold text-base tracking-tight text-zinc-100">
                IKIP <span className="text-cyan-400 font-normal text-xs ml-0.5">2.0</span>
              </span>
            </Link>
            <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
              Industrial Knowledge Intelligence Platform (IKIP). Production-grade cognitive RAG and entity relationship mapping for heavy industry operations.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs text-zinc-500">
              <li><a href="#features" className="hover:text-zinc-300 transition-colors">Features</a></li>
              <li><a href="#workflow" className="hover:text-zinc-300 transition-colors">Workflow Pipeline</a></li>
              <li><a href="#graph-preview" className="hover:text-zinc-300 transition-colors">Knowledge Graph</a></li>
              <li><a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing Plans</a></li>
            </ul>
          </div>

          {/* Security & Deploy */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Security</h4>
            <ul className="space-y-2.5 text-xs text-zinc-500">
              <li><a href="#security" className="hover:text-zinc-300 transition-colors">Air-Gapped Deployment</a></li>
              <li><a href="#security" className="hover:text-zinc-300 transition-colors">Role-Based Access</a></li>
              <li><a href="#security" className="hover:text-zinc-300 transition-colors">Audit Trail Logs</a></li>
              <li><a href="#security" className="hover:text-zinc-300 transition-colors">Compliance Certifications</a></li>
            </ul>
          </div>

          {/* Contact & Legal */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-2.5 text-xs text-zinc-500">
              <li><a href="#" className="hover:text-zinc-300 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-zinc-300 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-zinc-300 transition-colors">Terms of Service</a></li>
              <li><a href="mailto:support@ikip-platform.com" className="hover:text-zinc-300 transition-colors">Contact Support</a></li>
            </ul>
          </div>

        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <span className="text-[11px] text-zinc-600 font-mono">
            &copy; {new Date().getFullYear()} IKIP Platform Inc. All rights reserved.
          </span>
          <span className="text-[11px] text-zinc-600 font-mono">
            Designed for critical industrial infrastructure.
          </span>
        </div>
      </div>
    </footer>
  );
}
