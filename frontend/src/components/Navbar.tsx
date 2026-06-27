"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Cpu, Menu, X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Features", href: "#features" },
    { name: "Workflow", href: "#workflow" },
    { name: "Knowledge Graph", href: "#graph-preview" },
    { name: "Security", href: "#security" },
    { name: "Pricing", href: "#pricing" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60 py-4"
          : "bg-transparent py-6"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-cyan-500/50 transition-colors">
              <Cpu className="h-5 w-5 text-cyan-400 group-hover:rotate-90 transition-transform duration-500" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400">
              IKIP <span className="text-cyan-400 font-medium text-xs tracking-wider uppercase ml-1">2.0</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors duration-200 relative py-1 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-cyan-500 after:transform after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-300"
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-zinc-300 hover:text-zinc-100 px-4 py-2 rounded-lg hover:bg-zinc-900/50 transition-colors border border-transparent hover:border-zinc-800"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="group flex items-center gap-1.5 text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 px-4 py-2 rounded-lg shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 transition-all duration-300 font-semibold"
            >
              Request Demo
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-zinc-400 hover:text-zinc-200 p-1"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-zinc-950 border-b border-zinc-800"
          >
            <div className="px-4 pt-2 pb-6 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-base font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-4 flex flex-col gap-3">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center text-base font-medium text-zinc-300 hover:text-zinc-100 py-2.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center text-base font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-zinc-950 py-2.5 rounded-lg"
                >
                  Request Demo
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
