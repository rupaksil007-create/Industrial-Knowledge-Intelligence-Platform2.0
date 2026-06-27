"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Network, Info, Link2, ExternalLink } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  type: "Equipment" | "Standard" | "Procedure" | "System" | "Department";
  x: number;
  y: number;
  details: {
    tag?: string;
    description: string;
    owner?: string;
    criticality?: string;
    docRef?: string;
  };
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

const initialNodes: GraphNode[] = [
  {
    id: "pump-102",
    label: "Centrifugal Pump P-102",
    type: "Equipment",
    x: 250,
    y: 180,
    details: {
      tag: "PUMP-102-SYS1",
      description: "High-pressure hydrocarbon transfer pump in Refinery Sector 4.",
      owner: "Mechanical Maintenance Team",
      criticality: "CRITICAL (Class A)",
      docRef: "SOP-MECH-PUMP-v4.2",
    },
  },
  {
    id: "iso-10816",
    label: "ISO-10816-3 (Vibration)",
    type: "Standard",
    x: 420,
    y: 100,
    details: {
      tag: "ISO-10816-3:2017",
      description: "International standard for mechanical vibration evaluation on industrial machines.",
      owner: "HSE Compliance Office",
      criticality: "HIGH (Regulatory)",
      docRef: "ISO-10816-3-Vib-Spec.pdf",
    },
  },
  {
    id: "sop-204",
    label: "Vibration Alert SOP",
    type: "Procedure",
    x: 100,
    y: 120,
    details: {
      tag: "SOP-OPS-VIB-02",
      description: "Standard operating procedure for responding to high vibration alerts on rotating equipment.",
      owner: "Operations Control Center",
      criticality: "HIGH (Safety)",
      docRef: "SOP-OPS-VIB-02-Rev3.pdf",
    },
  },
  {
    id: "feed-sys",
    label: "Refinery Feed System",
    type: "System",
    x: 350,
    y: 280,
    details: {
      tag: "SYS-REF-FEED-01",
      description: "Primary crude oil feed system supplying distillation columns.",
      owner: "Refinery Operations Team",
      criticality: "CRITICAL (Class A)",
      docRef: "PID-REF-FEED-01.dwg",
    },
  },
  {
    id: "mech-dept",
    label: "Mechanical Department",
    type: "Department",
    x: 80,
    y: 260,
    details: {
      description: "Central maintenance department responsible for rotating equipment integrity.",
      owner: "Lead Mechanical Engineer",
      criticality: "Operational Hub",
    },
  },
];

const initialEdges: GraphEdge[] = [
  { source: "pump-102", target: "iso-10816", label: "evaluated_by" },
  { source: "pump-102", target: "sop-204", label: "governed_by" },
  { source: "pump-102", target: "feed-sys", label: "part_of" },
  { source: "mech-dept", target: "pump-102", label: "maintains" },
  { source: "mech-dept", target: "sop-204", label: "executes" },
];

const typeColors = {
  Equipment: { bg: "bg-cyan-950/80", border: "border-cyan-500", text: "text-cyan-400", glow: "shadow-cyan-500/20" },
  Standard: { bg: "bg-amber-950/80", border: "border-amber-500", text: "text-amber-400", glow: "shadow-amber-500/20" },
  Procedure: { bg: "bg-emerald-950/80", border: "border-emerald-500", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
  System: { bg: "bg-indigo-950/80", border: "border-indigo-500", text: "text-indigo-400", glow: "shadow-indigo-500/20" },
  Department: { bg: "bg-purple-950/80", border: "border-purple-500", text: "text-purple-400", glow: "shadow-purple-500/20" },
};

export default function GraphPreview() {
  const [selectedNode, setSelectedNode] = useState<GraphNode>(initialNodes[0]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const getConnectedEdges = (nodeId: string) => {
    return initialEdges.filter(
      (edge) => edge.source === nodeId || edge.target === nodeId
    );
  };

  const isConnected = (nodeId: string) => {
    if (!hoveredNodeId && !selectedNode) return false;
    const targetId = hoveredNodeId || selectedNode.id;
    if (nodeId === targetId) return true;
    return initialEdges.some(
      (edge) =>
        (edge.source === nodeId && edge.target === targetId) ||
        (edge.target === nodeId && edge.source === targetId)
    );
  };

  return (
    <section id="graph-preview" className="py-24 bg-zinc-950 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          
          {/* Text Content */}
          <div className="w-full lg:w-5/12">
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-full">
              Knowledge Graph Preview
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-100">
              Interactive Entity <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-400">
                Relationship Mapping
              </span>
            </h2>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              Unlock the power of relational context. The platform parses standard documents to extract equipment tags, compliance standards, and operating procedures, linking them in an interactive knowledge graph.
            </p>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded bg-zinc-900 border border-zinc-800 text-cyan-400">
                  <Network className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">Entity Resolution</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Automatically resolves tags across different document formats (e.g. mapping P-102 to Pump-102).</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1.5 rounded bg-zinc-900 border border-zinc-800 text-amber-400">
                  <Link2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-200">Compliance Auditing</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">Trace which regulatory standards (like ISO or OSHA) govern specific machinery and procedures.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Graph Panel */}
          <div className="w-full lg:w-7/12 flex flex-col md:flex-row gap-6 bg-zinc-900/20 border border-zinc-900 p-6 rounded-2xl backdrop-blur-md">
            
            {/* SVG Visualization */}
            <div className="w-full md:w-3/5 aspect-square md:aspect-auto md:h-[400px] bg-zinc-950/80 border border-zinc-800/60 rounded-xl relative overflow-hidden flex items-center justify-center">
              
              <svg className="w-full h-full" viewBox="0 0 500 380">
                {/* Defs for gradients */}
                <defs>
                  <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
                  </linearGradient>
                  <linearGradient id="edge-gradient-active" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#a5b4fc" stopOpacity="0.8" />
                  </linearGradient>
                </defs>

                {/* Draw Edges */}
                {initialEdges.map((edge, idx) => {
                  const sourceNode = initialNodes.find((n) => n.id === edge.source);
                  const targetNode = initialNodes.find((n) => n.id === edge.target);
                  if (!sourceNode || !targetNode) return null;
                  
                  const isEdgeActive =
                    (hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId)) ||
                    (!hoveredNodeId && selectedNode && (edge.source === selectedNode.id || edge.target === selectedNode.id));

                  return (
                    <g key={idx}>
                      <line
                        x1={sourceNode.x}
                        y1={sourceNode.y}
                        x2={targetNode.x}
                        y2={targetNode.y}
                        stroke={isEdgeActive ? "url(#edge-gradient-active)" : "url(#edge-gradient)"}
                        strokeWidth={isEdgeActive ? 2 : 1}
                        strokeDasharray={isEdgeActive ? "none" : "4 4"}
                        className="transition-all duration-300"
                      />
                      {/* Edge Label */}
                      {isEdgeActive && (
                        <rect
                          x={(sourceNode.x + targetNode.x) / 2 - 40}
                          y={(sourceNode.y + targetNode.y) / 2 - 8}
                          width={80}
                          height={16}
                          rx={3}
                          fill="#09090b"
                          stroke="#27272a"
                          strokeWidth={0.5}
                        />
                      )}
                      {isEdgeActive && (
                        <text
                          x={(sourceNode.x + targetNode.x) / 2}
                          y={(sourceNode.y + targetNode.y) / 2 + 4}
                          textAnchor="middle"
                          fill="#a1a1aa"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Draw Nodes */}
                {initialNodes.map((node) => {
                  const colors = typeColors[node.type];
                  const isNodeActive = isConnected(node.id);
                  const isNodeSelected = selectedNode?.id === node.id;

                  return (
                    <g
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      className="cursor-pointer group"
                    >
                      {/* Glow Ring */}
                      {(isNodeSelected || isNodeActive) && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={24}
                          className="fill-cyan-500/10 stroke-cyan-500/20 animate-pulse"
                          strokeWidth={1}
                        />
                      )}
                      {/* Node Shape */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={14}
                        className={`${colors.bg} ${colors.border} transition-all duration-300`}
                        strokeWidth={isNodeSelected ? 2.5 : 1.5}
                      />
                      {/* Node Letter */}
                      <text
                        x={node.x}
                        y={node.y + 4}
                        textAnchor="middle"
                        className={`${colors.text} font-bold text-xs pointer-events-none`}
                      >
                        {node.type.charAt(0)}
                      </text>
                      {/* Node Label (Always show selected or hovered, or simple) */}
                      <text
                        x={node.x}
                        y={node.y + 28}
                        textAnchor="middle"
                        fill={isNodeSelected ? "#f4f4f5" : "#a1a1aa"}
                        fontSize="10"
                        fontWeight={isNodeSelected ? "bold" : "normal"}
                        className="pointer-events-none transition-colors duration-300"
                      >
                        {node.label.split(" ").pop()}
                      </text>
                    </g>
                  );
                })}
              </svg>
              
              <span className="absolute bottom-3 left-3 text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                <Info className="h-3 w-3" /> Click nodes to inspect relationships
              </span>
            </div>

            {/* Details Panel */}
            <div className="w-full md:w-2/5 flex flex-col justify-between border border-zinc-800 bg-zinc-950/40 p-5 rounded-xl">
              <div>
                <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${typeColors[selectedNode.type].bg} ${typeColors[selectedNode.type].text} border border-zinc-800`}>
                  {selectedNode.type}
                </span>
                
                <h3 className="text-base font-bold text-zinc-100 mt-3 flex items-center gap-1.5">
                  {selectedNode.label}
                </h3>

                {selectedNode.details.tag && (
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">
                    Tag: <span className="text-zinc-300">{selectedNode.details.tag}</span>
                  </p>
                )}

                <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                  {selectedNode.details.description}
                </p>

                <div className="mt-4 pt-4 border-t border-zinc-900 space-y-2.5">
                  {selectedNode.details.owner && (
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Owner/Custodian</span>
                      <span className="text-xs text-zinc-300">{selectedNode.details.owner}</span>
                    </div>
                  )}
                  {selectedNode.details.criticality && (
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Criticality Rating</span>
                      <span className={`text-xs font-semibold ${selectedNode.details.criticality.includes("CRITICAL") ? "text-rose-400" : selectedNode.details.criticality.includes("HIGH") ? "text-amber-400" : "text-zinc-300"}`}>
                        {selectedNode.details.criticality}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedNode.details.docRef && (
                <div className="mt-4 pt-4 border-t border-zinc-900">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400 font-medium hover:text-cyan-300 cursor-pointer">
                    <span className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> View Source SOP
                    </span>
                    <span className="text-zinc-500 font-mono">{selectedNode.details.docRef.substring(0, 12)}...</span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
