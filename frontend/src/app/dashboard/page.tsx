"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Cpu,
  Database,
  FileText,
  HardHat,
  Layers,
  MessageSquare,
  Network,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Upload,
  User,
} from "lucide-react";

// Types
interface DocumentItem {
  id: string;
  name: string;
  total_chunks: number;
  total_pages: number;
  size_bytes: number;
  upload_date?: string;
  doc_type?: string;
}

interface Citation {
  doc_name: string;
  doc_id: string;
  page: number;
  text_snippet: string;
  score: number | null;
  explanation?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string;
}

export default function Dashboard() {
  // Configuration
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // State
  const [session, setSession] = useState<{
    name: string;
    email: string;
    role: string;
    avatarSeed: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ikip_session");
      if (stored) {
        try {
          setSession(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse session", e);
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }

      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["dashboard", "library", "chat", "graph", "compliance"].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ikip_session");
      document.cookie = "ikip_session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    }
    window.location.href = "/login";
  };

  const [activeTab, setActiveTab] = useState<"dashboard" | "library" | "chat" | "graph" | "compliance">("dashboard");
  
  // Compliance Intelligence States
  const [complianceData, setComplianceData] = useState<any>(null);
  const [isAnalyzingCompliance, setIsAnalyzingCompliance] = useState(false);
  const [complianceError, setComplianceError] = useState("");

  const fetchComplianceData = async () => {
    try {
      const res = await fetch(`${API_URL}/compliance/report`);
      if (res.ok) {
        const data = await res.json();
        setComplianceData(data);
        setComplianceError("");
      } else {
        setComplianceError("Failed to fetch compliance report.");
      }
    } catch (e: any) {
      console.error("Error fetching compliance report:", e);
      setComplianceError("Could not connect to compliance engine API.");
    }
  };

  const handleAnalyzeCompliance = async () => {
    setIsAnalyzingCompliance(true);
    setComplianceError("");
    try {
      const res = await fetch(`${API_URL}/compliance/analyze`, { method: "POST" });
      if (res.ok) {
        let count = 0;
        const interval = setInterval(async () => {
          await fetchComplianceData();
          count++;
          if (count >= 4) {
            clearInterval(interval);
            setIsAnalyzingCompliance(false);
          }
        }, 1500);
      } else {
        setComplianceError("Failed to trigger compliance analysis.");
        setIsAnalyzingCompliance(false);
      }
    } catch (e: any) {
      console.error("Error analyzing compliance:", e);
      setComplianceError("Error initiating compliance run.");
      setIsAnalyzingCompliance(false);
    }
  };

  useEffect(() => {
    if (activeTab === "compliance") {
      fetchComplianceData();
    }
  }, [activeTab]);

  const [backendStatus, setBackendStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const [backendConfig, setBackendConfig] = useState({
    app: "IKIP",
    embedding_provider: "chroma",
    llm_provider: "mock",
  });
  
  // Library States
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");
  const [dragActive, setDragActive] = useState(false);
  
  // Chat States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "System Initialized. I am the Industrial Knowledge Intelligence Assistant. Upload standard operating procedures, manuals, or compliance documents to the library, and I will perform RAG QA with precise citations.",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  
  // Search Metadata Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterDocName, setFilterDocName] = useState("");
  const [filterDocType, setFilterDocType] = useState("");
  const [filterUploadDate, setFilterUploadDate] = useState("");
  
  // UI States
  const [systemAlerts, setSystemAlerts] = useState<string[]>([]);
  const [connectionError, setConnectionError] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Knowledge Graph States
  const [graphNodes, setGraphNodes] = useState<any[]>([]);
  const [graphEdges, setGraphEdges] = useState<any[]>([]);
  const [graphSearchQuery, setGraphSearchQuery] = useState("");
  const [graphSearchResult, setGraphSearchResult] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [selectedNodeRelationships, setSelectedNodeRelationships] = useState<any[]>([]);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [nodePositions, setNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({});
  const [draggedNodeKey, setDraggedNodeKey] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Advanced Visualization States
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set([
    "Equipment",
    "Assets",
    "Systems",
    "Procedures",
    "Safety Items",
    "Departments",
    "Locations"
  ]));
  const velocitiesRef = useRef<{ [key: string]: { vx: number; vy: number } }>({});

  // Fetch Knowledge Graph Data
  const fetchGraphData = async () => {
    setIsGraphLoading(true);
    setGraphError("");
    try {
      const nodesRes = await fetch(`${API_URL}/graph/nodes`);
      const edgesRes = await fetch(`${API_URL}/graph/edges`);
      if (nodesRes.ok && edgesRes.ok) {
        const nodesData = await nodesRes.json();
        const edgesData = await edgesRes.json();
        setGraphNodes(nodesData);
        setGraphEdges(edgesData);
      } else {
        setGraphError("Failed to fetch graph data from backend.");
      }
    } catch (e) {
      setGraphError("Backend graph service is unreachable.");
      console.error("Failed to fetch graph data", e);
    } finally {
      setIsGraphLoading(false);
    }
  };

  // Handle Graph Search
  const handleGraphSearch = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setGraphSearchResult(null);
      return;
    }
    
    setIsGraphLoading(true);
    try {
      const res = await fetch(`${API_URL}/graph/search?q=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        setGraphSearchResult({
          nodes: data.nodes || [],
          edges: data.edges || []
        });
        
        // Auto-select first matching node
        if (data.nodes && data.nodes.length > 0) {
          const firstNode = data.nodes[0];
          setSelectedNode(firstNode);
          const nodeKey = firstNode.name.toLowerCase();
          const rels = (data.edges || []).filter((edge: any) => 
            edge.source.toLowerCase() === nodeKey || edge.target.toLowerCase() === nodeKey
          );
          setSelectedNodeRelationships(rels);
        } else {
          setSelectedNode(null);
          setSelectedNodeRelationships([]);
        }
      } else {
        console.error("Graph search failed.");
      }
    } catch (e) {
      console.error("Error searching graph", e);
    } finally {
      setIsGraphLoading(false);
    }
  };

  // Handle Node Click
  const handleNodeClick = async (node: any) => {
    setSelectedNode(node);
    try {
      const res = await fetch(`${API_URL}/graph/entity/${encodeURIComponent(node.name)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedNodeRelationships(data.relationships || []);
      } else {
        // Fallback
        const nodeKey = node.name.toLowerCase();
        const localRels = (graphSearchResult ? graphSearchResult.edges : graphEdges).filter(
          (edge: any) => edge.source.toLowerCase() === nodeKey || edge.target.toLowerCase() === nodeKey
        );
        setSelectedNodeRelationships(localRels);
      }
    } catch (e) {
      console.error("Error fetching entity relationships", e);
      const nodeKey = node.name.toLowerCase();
      const localRels = (graphSearchResult ? graphSearchResult.edges : graphEdges).filter(
        (edge: any) => edge.source.toLowerCase() === nodeKey || edge.target.toLowerCase() === nodeKey
      );
      setSelectedNodeRelationships(localRels);
    }
  };

  // Fetch graph on tab switch
  useEffect(() => {
    if (activeTab === "graph") {
      fetchGraphData();
      setGraphSearchResult(null);
      setSelectedNode(null);
      setSelectedNodeRelationships([]);
    }
  }, [activeTab]);

  // Run 300 iterations of force-directed simulation on data load to settle node positions
  useEffect(() => {
    const nodes = graphSearchResult ? graphSearchResult.nodes : graphNodes;
    const edges = graphSearchResult ? graphSearchResult.edges : graphEdges;

    const visibleNodes = nodes.filter(node => visibleTypes.has(node.type));
    if (visibleNodes.length === 0) return;

    const visibleNodeKeys = new Set(visibleNodes.map(n => n.name.toLowerCase()));
    const visibleEdges = edges.filter(edge => 
      visibleNodeKeys.has(edge.source.toLowerCase()) && 
      visibleNodeKeys.has(edge.target.toLowerCase())
    );

    const width = 780;
    const height = 420;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Initialize positions with a column layered scheme first to avoid overlays
    const columnMapping: { [key: string]: number } = {
      Locations: 0,
      Departments: 1,
      Equipment: 2,
      Assets: 2,
      Systems: 3,
      Procedures: 4,
      "Safety Items": 4
    };

    const nextPositions: { [key: string]: { x: number; y: number } } = {};
    const nodeGroups: any[][] = [[], [], [], [], []];
    
    visibleNodes.forEach(node => {
      const colIdx = columnMapping[node.type] !== undefined ? columnMapping[node.type] : 2;
      nodeGroups[colIdx].push(node);
    });

    const colSpacing = (width - 100) / 4;
    nodeGroups.forEach((group, colIdx) => {
      const x = 50 + colIdx * colSpacing;
      const n = group.length;
      if (n === 1) {
        nextPositions[group[0].name.toLowerCase()] = { x, y: centerY };
      } else if (n > 1) {
        group.forEach((node, idx) => {
          const y = 50 + (idx * (height - 100)) / (n - 1);
          nextPositions[node.name.toLowerCase()] = { x, y };
        });
      }
    });

    // Fallback for nodes that don't belong to any column or need placement
    visibleNodes.forEach((node, i) => {
      const key = node.name.toLowerCase();
      if (!nextPositions[key]) {
        const angle = (i / visibleNodes.length) * 2 * Math.PI;
        nextPositions[key] = {
          x: centerX + 120 * Math.cos(angle),
          y: centerY + 120 * Math.sin(angle)
        };
      }
    });

    // 2. Run simulation for 300 iterations
    const iterations = 300;
    const kRepulsion = 140000; // Increased repulsion force so nodes spread out more
    const kAttraction = 0.04;  // Slightly reduced attraction force
    const kGravity = 0.03;     // Reduced gravity to prevent crowding at the center
    const restLength = 160;    // Increased rest length of edges

    for (let step = 0; step < iterations; step++) {
      const fx: { [key: string]: number } = {};
      const fy: { [key: string]: number } = {};

      visibleNodes.forEach(node => {
        const key = node.name.toLowerCase();
        fx[key] = 0;
        fy[key] = 0;
      });

      // Node-Node Repulsion
      for (let i = 0; i < visibleNodes.length; i++) {
        const k1 = visibleNodes[i].name.toLowerCase();
        const p1 = nextPositions[k1];
        if (!p1) continue;

        for (let j = i + 1; j < visibleNodes.length; j++) {
          const k2 = visibleNodes[j].name.toLowerCase();
          const p2 = nextPositions[k2];
          if (!p2) continue;

          let dx = p1.x - p2.x;
          let dy = p1.y - p2.y;
          if (dx === 0 && dy === 0) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
          }

          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq);

          // Force inversely proportional to distance (squared)
          const force = kRepulsion / (distSq + 200);
          const forceX = (dx / dist) * force;
          const forceY = (dy / dist) * force;

          fx[k1] += forceX;
          fy[k1] += forceY;
          fx[k2] -= forceX;
          fy[k2] -= forceY;
        }
      }

      // Edge Attraction
      visibleEdges.forEach(edge => {
        const kS = edge.source.toLowerCase();
        const kT = edge.target.toLowerCase();
        const pS = nextPositions[kS];
        const pT = nextPositions[kT];

        if (!pS || !pT) return;

        const dx = pS.x - pT.x;
        const dy = pS.y - pT.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1.0;

        const force = kAttraction * (dist - restLength);
        const forceX = (dx / dist) * force;
        const forceY = (dy / dist) * force;

        fx[kS] -= forceX;
        fy[kS] -= forceY;
        fx[kT] += forceX;
        fy[kT] += forceY;
      });

      // Gravity force to keep graph centered
      visibleNodes.forEach(node => {
        const key = node.name.toLowerCase();
        const pos = nextPositions[key];
        if (!pos) return;

        fx[key] -= kGravity * (pos.x - centerX);
        fy[key] -= kGravity * (pos.y - centerY);
      });

      // Update positions
      visibleNodes.forEach(node => {
        const key = node.name.toLowerCase();
        const pos = nextPositions[key];
        if (!pos) return;

        const forceLen = Math.sqrt(fx[key] * fx[key] + fy[key] * fy[key]) || 1.0;
        const maxStep = Math.min(8, forceLen);
        const dx = (fx[key] / forceLen) * maxStep;
        const dy = (fy[key] / forceLen) * maxStep;

        nextPositions[key] = {
          x: Math.max(65, Math.min(715, pos.x + dx)), // Tighter boundaries (padding)
          y: Math.max(45, Math.min(375, pos.y + dy))  // Tighter boundaries (padding)
        };
      });
    }

    setNodePositions(nextPositions);
  }, [graphNodes, graphEdges, graphSearchResult, visibleTypes]);

  // Zoom and Pan Refs for wheel events (prevents re-registering listener)
  const zoomPanRef = useRef({ zoom, pan });
  useEffect(() => {
    zoomPanRef.current = { zoom, pan };
  }, [zoom, pan]);

  // Register non-passive wheel event listener on the SVG element for Zooming
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const handleScrollZoom = (e: WheelEvent) => {
      e.preventDefault();
      
      const { zoom: currentZoom, pan: currentPan } = zoomPanRef.current;
      const zoomFactor = 1.1;
      let nextZoom = currentZoom;
      
      if (e.deltaY < 0) {
        nextZoom = Math.min(5, currentZoom * zoomFactor);
      } else {
        nextZoom = Math.max(0.2, currentZoom / zoomFactor);
      }
      
      const rect = svgEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const dx = mouseX - currentPan.x;
      const dy = mouseY - currentPan.y;
      
      const nextPan = {
        x: mouseX - dx * (nextZoom / currentZoom),
        y: mouseY - dy * (nextZoom / currentZoom)
      };
      
      setZoom(nextZoom);
      setPan(nextPan);
    };

    svgEl.addEventListener("wheel", handleScrollZoom, { passive: false });
    return () => {
      svgEl.removeEventListener("wheel", handleScrollZoom);
    };
  }, []);

  // Reset zoom & pan to default state
  const resetZoomPan = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Node Drag and Viewport Panning mouse handlers
  const handleMouseDown = (nodeKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedNodeKey(nodeKey);
  };

  const handleBgMouseDown = (e: React.MouseEvent) => {
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === "svg" || (e.target as HTMLElement).id === "svg-bg") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNodeKey) {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      
      // Translate to zoom/pan coordinate system
      const x = (rawX - pan.x) / zoom;
      const y = (rawY - pan.y) / zoom;
      
      // Clamp node to SVG boundaries with padding so it cannot go outside during drag
      const clampedX = Math.max(65, Math.min(715, x));
      const clampedY = Math.max(45, Math.min(375, y));
      
      setNodePositions(prev => ({
        ...prev,
        [draggedNodeKey]: { x: clampedX, y: clampedY }
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDraggedNodeKey(null);
    setIsPanning(false);
  };

  // Toggle category visibility
  const toggleTypeVisibility = (type: string) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        // Clear selected node if it belongs to hidden category
        if (selectedNode && selectedNode.type === type) {
          setSelectedNode(null);
          setSelectedNodeRelationships([]);
        }
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Calculates intersection point of line with circle boundary
  const getLineCoords = (
    posS: { x: number; y: number },
    posT: { x: number; y: number },
    rS: number,
    rT: number
  ) => {
    const dx = posT.x - posS.x;
    const dy = posT.y - posS.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1.0;
    
    return {
      x1: posS.x + (dx / len) * rS,
      y1: posS.y + (dy / len) * rS,
      x2: posT.x - (dx / len) * (rT + 8),
      y2: posT.y - (dy / len) * (rT + 8)
    };
  };

  const getNodeStyles = (type: string) => {
    switch (type) {
      case "Equipment":
        return { fill: "#f43f5e", stroke: "#fda4af", bg: "bg-rose-950/40", text: "text-rose-400", border: "border-rose-500/30" };
      case "Assets":
        return { fill: "#f59e0b", stroke: "#fcd34d", bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-500/30" };
      case "Systems":
        return { fill: "#06b6d4", stroke: "#67e8f9", bg: "bg-cyan-950/40", text: "text-cyan-400", border: "border-cyan-500/30" };
      case "Procedures":
        return { fill: "#a855f7", stroke: "#d8b4fe", bg: "bg-purple-950/40", text: "text-purple-400", border: "border-purple-500/30" };
      case "Safety Items":
        return { fill: "#10b981", stroke: "#6ee7b7", bg: "bg-emerald-950/40", text: "text-emerald-400", border: "border-emerald-500/30" };
      case "Departments":
        return { fill: "#6366f1", stroke: "#a5b4fc", bg: "bg-indigo-950/40", text: "text-indigo-400", border: "border-indigo-500/30" };
      case "Locations":
        return { fill: "#0ea5e9", stroke: "#7dd3fc", bg: "bg-sky-950/40", text: "text-sky-400", border: "border-sky-500/30" };
      default:
        return { fill: "#71717a", stroke: "#d4d4d8", bg: "bg-zinc-900", text: "text-zinc-400", border: "border-zinc-800" };
    }
  };

  // Poll Backend Status and Fetch Docs on mount
  useEffect(() => {
    checkHealth();
    
    // Setup interval for health polling
    const interval = setInterval(() => {
      checkHealth();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Automatically fetch documents when backend transitions from offline to online (resolves stale state)
  useEffect(() => {
    if (backendStatus === "online") {
      fetchDocuments();
    }
  }, [backendStatus]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // Check Backend Health using compatible AbortController timeout
  const checkHealth = async () => {
    const healthUrl = `${API_URL}/health`;
    const docsUrl = `${API_URL}/documents`;
    console.log(`[HealthCheck] Pinging health endpoint: ${healthUrl}`);
    
    let healthSuccess = false;
    let healthErrorMsg = "";
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`[HealthCheck] Health ping timed out after 10000ms for: ${healthUrl}`);
        controller.abort();
      }, 10000);
      
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      console.log(`[HealthCheck] Health response status: ${res.status} ${res.statusText}`);
      
      if (res.ok) {
        const data = await res.json();
        setBackendStatus("online");
        setConnectionError("");
        setBackendConfig({
          app: data.app,
          embedding_provider: data.embedding_provider,
          llm_provider: data.llm_provider,
        });
        healthSuccess = true;
      } else {
        healthErrorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
      }
    } catch (e: any) {
      if (e.name === "AbortError") {
        healthErrorMsg = "Connection timed out after 10000ms";
      } else {
        healthErrorMsg = e.message || String(e);
      }
      console.error(`[HealthCheck] Health request failed: ${healthErrorMsg}`);
    }
    
    // If health check succeeded, do not check fallback
    if (healthSuccess) return;
    
    // Fallback: Check if documents endpoint is accessible
    console.log(`[HealthCheck] Health check failed or timed out (${healthErrorMsg}). Attempting fallback check: ${docsUrl}`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`[HealthCheck] Fallback documents ping timed out after 10000ms for: ${docsUrl}`);
        controller.abort();
      }, 10000);
      
      const res = await fetch(docsUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      console.log(`[HealthCheck] Fallback documents response status: ${res.status} ${res.statusText}`);
      if (res.ok) {
        setBackendStatus("online");
        setConnectionError("");
        console.log("[HealthCheck] Fallback succeeded. System is online.");
      } else {
        setBackendStatus("offline");
        setConnectionError(`Health failed (${healthErrorMsg}) & Documents failed (HTTP ${res.status}: ${res.statusText})`);
        console.error(`[HealthCheck] Fallback failed with status: ${res.status}`);
      }
    } catch (e: any) {
      setBackendStatus("offline");
      let docsErrorMsg = "";
      if (e.name === "AbortError") {
        docsErrorMsg = "Connection timed out after 10000ms";
      } else {
        docsErrorMsg = e.message || String(e);
      }
      console.error(`[HealthCheck] Fallback request failed: ${docsErrorMsg}`);
      setConnectionError(`Health failed (${healthErrorMsg}) & Documents failed (${docsErrorMsg})`);
    }
  };

  // Fetch Documents
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_URL}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        
        // Add default system alerts if database is empty
        if (data.length === 0) {
          setSystemAlerts(["Knowledge base is currently empty. Ingest documents to enable RAG reasoning."]);
        } else {
          setSystemAlerts([]);
        }
      }
    } catch (e) {
      console.error("Failed to fetch documents", e);
    }
  };

  // Format File Size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await handleUpload(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleUpload(file);
    }
  };

  // Handle Upload
  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Unsupported file type. Please upload a PDF.");
      return;
    }
    
    setIsUploading(true);
    setUploadStatusMsg("Uploading file to secure server...");
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      setUploadStatusMsg("Parsing PDF layouts & executing heading segmentation...");
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        const data = await res.json();
        setUploadStatusMsg(`Success: Indexed ${data.total_pages} pages using ${data.method} parsing.`);
        fetchDocuments();
        setTimeout(() => {
          setIsUploading(false);
          setUploadStatusMsg("");
        }, 3000);
      } else {
        const err = await res.json();
        setUploadStatusMsg(`Error: ${err.detail || "Ingestion failed."}`);
        setTimeout(() => setIsUploading(false), 5000);
      }
    } catch (e) {
      setUploadStatusMsg("Ingestion server unreachable. Verify backend is running.");
      setTimeout(() => setIsUploading(false), 5000);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document from the vector store?")) return;
    
    try {
      const res = await fetch(`${API_URL}/document/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchDocuments();
      } else {
        alert("Failed to delete document.");
      }
    } catch (e) {
      alert("Connection error occurred while deleting.");
    }
  };

  // Send Query to RAG Service
  const handleQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) return;
    
    setUserInput("");
    setChatLoading(true);
    
    const userMsgId = Date.now().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString(),
    };
    
    setMessages((prev) => [...prev, newUserMsg]);
    
    try {
      // Package query options with search filters
      const payload: any = {
        query: trimmed
      };
      if (filterDocName) {
        payload.document_name = filterDocName;
      }
      if (filterDocType) {
        payload.document_type = filterDocType;
      }
      if (filterUploadDate) {
        payload.upload_date = filterUploadDate;
      }

      const res = await fetch(`${API_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        const data = await res.json();
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.answer,
          citations: data.citations,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (data.citations && data.citations.length > 0) {
          setActiveCitations(data.citations);
        }
      } else {
        let errorMsg = "System encountered an error processing your query. Please confirm the vector database connection.";
        try {
          const errData = await res.json();
          if (errData && errData.detail) {
            if (typeof errData.detail === "string") {
              errorMsg = errData.detail;
            } else if (Array.isArray(errData.detail)) {
              errorMsg = errData.detail.map((e: any) => e.msg || JSON.stringify(e)).join("; ");
            } else {
              errorMsg = JSON.stringify(errData.detail);
            }
          }
        } catch (jsonErr) {
          // Fall back to default errorMsg if response is not JSON
        }
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${errorMsg}`,
          timestamp: new Date().toLocaleTimeString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (e) {
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Network error: Ingestion API server is offline. Run 'python app/main.py' to launch it.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // Quick Prompts
  const quickPrompts = [
    "What is Problem Statement 8 about?",
    "List safety equipment needed for turbine maintenance",
    "Explain the start-up sequence for gas systems",
    "What are the inspection intervals for industrial compressors?"
  ];

  // Ingestion stats calculations
  const totalDocsCount = documents.length;
  const totalChunksCount = documents.reduce((acc, curr) => acc + curr.total_chunks, 0);
  const totalPagesCount = documents.reduce((acc, curr) => acc + curr.total_pages, 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-[#f4f4f5]">
      
      {/* 1. Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#121214]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-cyan-900/40 border border-cyan-500/30 text-cyan-400">
            <HardHat className="h-6 w-6 animate-pulse-slow" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-cyan-400">IKIP</h1>
            <p className="text-xs text-zinc-500 font-mono">Industrial Knowledge Intelligence Platform</p>
          </div>
        </div>
        
        {/* Telemetry connection status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800 font-mono text-xs">
            <Cpu className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-400">LLM:</span>
            <span className="text-cyan-400 uppercase font-semibold">{backendConfig.llm_provider}</span>
          </div>
          
          <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800 font-mono text-xs">
            <Database className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-400">Vector:</span>
            <span className="text-cyan-400 uppercase font-semibold">{backendConfig.embedding_provider}</span>
          </div>

          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded border font-mono text-xs ${
            backendStatus === "online" 
              ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400"
              : backendStatus === "offline"
              ? "bg-rose-950/30 border-rose-500/30 text-rose-400"
              : "bg-amber-950/30 border-amber-500/30 text-amber-400"
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              backendStatus === "online" 
                ? "bg-emerald-400 animate-pulse" 
                : backendStatus === "offline"
                ? "bg-rose-500"
                : "bg-amber-400 animate-bounce"
            }`} />
            <span className="uppercase font-semibold tracking-wider">
              {backendStatus === "online" ? "System Active" : backendStatus === "offline" ? "System Offline" : "Connecting..."}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Layout Grid */}
      <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
        
        {/* 2.1 Sidebar Nav */}
        <aside className="w-full md:w-64 bg-[#0e0e10] border-r border-zinc-800 p-4 flex flex-col justify-between">
          <div className="space-y-6">
            <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-2">Navigation Panel</p>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-all duration-200 text-sm font-medium ${
                  activeTab === "dashboard"
                    ? "bg-cyan-950/40 text-cyan-400 border-l-2 border-cyan-500 font-semibold"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Activity className="h-4.5 w-4.5" />
                <span>Operations Dashboard</span>
              </button>
              
              <button
                onClick={() => setActiveTab("library")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-all duration-200 text-sm font-medium ${
                  activeTab === "library"
                    ? "bg-cyan-950/40 text-cyan-400 border-l-2 border-cyan-500 font-semibold"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <BookOpen className="h-4.5 w-4.5" />
                <span>Knowledge Library</span>
                {totalDocsCount > 0 && (
                  <span className="ml-auto bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full text-xs font-mono">
                    {totalDocsCount}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab("chat")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-all duration-200 text-sm font-medium ${
                  activeTab === "chat"
                    ? "bg-cyan-950/40 text-cyan-400 border-l-2 border-cyan-500 font-semibold"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <MessageSquare className="h-4.5 w-4.5" />
                <span>Intelligence Chat</span>
              </button>

              <button
                onClick={() => setActiveTab("graph")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-all duration-200 text-sm font-medium ${
                  activeTab === "graph"
                    ? "bg-cyan-950/40 text-cyan-400 border-l-2 border-cyan-500 font-semibold"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Network className="h-4.5 w-4.5" />
                <span>Knowledge Graph</span>
              </button>

              <button
                onClick={() => setActiveTab("compliance")}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded transition-all duration-200 text-sm font-medium ${
                  activeTab === "compliance"
                    ? "bg-cyan-950/40 text-cyan-400 border-l-2 border-cyan-500 font-semibold"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                <Shield className="h-4.5 w-4.5" />
                <span>Compliance Intelligence</span>
              </button>
            </nav>
          </div>
          
          {/* Footer of Sidebar: User Profile and Logout */}
          <div className="pt-4 border-t border-zinc-800 space-y-4">
            {session && (
              <div className="bg-zinc-950/50 border border-zinc-850 p-3 rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {session.avatarSeed}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-zinc-200 truncate">{session.name}</span>
                    <span className="block text-[10px] text-zinc-500 truncate">{session.email}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                    session.role === "Admin"
                      ? "bg-rose-950/40 text-rose-400 border border-rose-900/50"
                      : session.role === "Engineer"
                      ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/50"
                      : session.role === "Manager"
                      ? "bg-amber-950/40 text-amber-400 border border-amber-900/50"
                      : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50"
                  }`}>
                    {session.role}
                  </span>
                  
                  <button
                    onClick={handleLogout}
                    className="text-[10px] text-zinc-500 hover:text-rose-400 font-mono transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            )}
            
            <div className="text-[9px] text-zinc-600 font-mono text-center">
              IKIP Platform v2.0 (Role: {session?.role || "Engineer"})
            </div>
          </div>
        </aside>

        {/* 2.2 Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#09090b] p-6">
          
          {/* System Warning Banner if offline */}
          {backendStatus === "offline" && (
            <div className="mb-6 flex items-center space-x-3 bg-rose-950/30 border border-rose-500/40 text-rose-400 p-4 rounded text-sm font-mono">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <span className="font-bold">DATABASE COMMUNICATION FAILURE:</span> The platform is unable to ping the FastAPI backend at <code className="bg-rose-950/80 px-1.5 py-0.5 rounded">{API_URL}</code>.
                {connectionError && (
                  <div className="mt-1.5 text-rose-300 font-semibold">
                    Reason: {connectionError}
                  </div>
                )}
                <div className="mt-1 text-zinc-400 text-xs">
                  Please verify that the backend server is running using <code className="bg-rose-950/80 px-1 py-0.5 rounded">python app/main.py</code> and CORS headers are configured correctly.
                </div>
              </div>
            </div>
          )}
          
          {systemAlerts.map((alert, idx) => (
            <div key={idx} className="mb-6 flex items-center space-x-3 bg-amber-950/20 border border-amber-500/30 text-amber-400 p-4 rounded text-sm font-mono">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>{alert}</div>
            </div>
          ))}

          {/* TAB CONTENT: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* Telemetry Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 rounded-lg border border-zinc-800 relative overflow-hidden group">
                  <div className="absolute right-3 top-3 text-zinc-800 group-hover:text-cyan-500/20 transition-all duration-300">
                    <FileText className="h-14 w-14" />
                  </div>
                  <p className="text-xs font-mono uppercase text-zinc-500">Indexed Manuals</p>
                  <p className="text-3xl font-extrabold tracking-tight text-white mt-2 font-mono">{totalDocsCount}</p>
                  <p className="text-[11px] text-zinc-500 mt-2">Active documents in vector store</p>
                </div>

                <div className="glass-panel p-5 rounded-lg border border-zinc-800 relative overflow-hidden group">
                  <div className="absolute right-3 top-3 text-zinc-800 group-hover:text-cyan-500/20 transition-all duration-300">
                    <Layers className="h-14 w-14" />
                  </div>
                  <p className="text-xs font-mono uppercase text-zinc-500">Knowledge Chunks</p>
                  <p className="text-3xl font-extrabold tracking-tight text-white mt-2 font-mono">{totalChunksCount}</p>
                  <p className="text-[11px] text-zinc-500 mt-2">Semantic section subdivisions</p>
                </div>

                <div className="glass-panel p-5 rounded-lg border border-zinc-800 relative overflow-hidden group">
                  <div className="absolute right-3 top-3 text-zinc-800 group-hover:text-cyan-500/20 transition-all duration-300">
                    <BookOpen className="h-14 w-14" />
                  </div>
                  <p className="text-xs font-mono uppercase text-zinc-500">Indexed Pages</p>
                  <p className="text-3xl font-extrabold tracking-tight text-white mt-2 font-mono">{totalPagesCount}</p>
                  <p className="text-[11px] text-zinc-500 mt-2">Total pages indexed across files</p>
                </div>

                <div className="glass-panel p-5 rounded-lg border border-zinc-800 relative overflow-hidden group">
                  <div className="absolute right-3 top-3 text-zinc-800 group-hover:text-cyan-500/20 transition-all duration-300">
                    <Activity className="h-14 w-14" />
                  </div>
                  <p className="text-xs font-mono uppercase text-zinc-500">Retrieval Pipeline</p>
                  <p className="text-md font-bold text-cyan-400 mt-3 flex items-center space-x-1.5">
                    <CheckCircle className="h-4.5 w-4.5 text-cyan-500 shrink-0" />
                    <span>Hybrid (RRF + BM25)</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-2">Semantic + Keyword fusion</p>
                </div>
              </div>

              {/* Data Visualization / Details Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Stats Bar Chart */}
                <div className="lg:col-span-2 glass-panel rounded-lg border border-zinc-800 p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center space-x-2">
                      <Activity className="h-4.5 w-4.5 text-cyan-500" />
                      <span>Ingested Knowledge Telemetry</span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">Chunk distribution across document index size</p>
                  </div>
                  
                  {/* Graph */}
                  <div className="my-8 h-48 flex items-end justify-between gap-3 border-b border-zinc-800 pb-1 px-4">
                    {documents.length === 0 ? (
                      <div className="w-full text-center text-zinc-600 font-mono text-xs pb-16">
                        No telemetry data. Ingest documents in the library to populate metrics.
                      </div>
                    ) : (
                      documents.map((doc, idx) => {
                        const maxChunks = Math.max(...documents.map(d => d.total_chunks), 1);
                        const pct = (doc.total_chunks / maxChunks) * 100;
                        return (
                          <div key={doc.id} className="flex-1 flex flex-col items-center group relative">
                            {/* Hover tooltip */}
                            <div className="absolute -top-12 bg-zinc-950 border border-cyan-500/40 text-[10px] font-mono px-2 py-1 rounded text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                              {doc.total_chunks} Chunks
                            </div>
                            
                            {/* Bar */}
                            <div 
                              style={{ height: `${Math.max(pct, 5)}%` }} 
                              className="w-full bg-cyan-950/60 border-t border-x border-cyan-500/40 hover:bg-cyan-500/30 transition-all rounded-t-sm"
                            />
                            
                            <span className="text-[10px] font-mono text-zinc-500 mt-2 truncate w-full text-center">
                              {doc.name.slice(0, 10)}...
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                    <span>X-Axis: Uploaded Documents</span>
                    <span>Y-Axis: Total Chunks (Scaled)</span>
                  </div>
                </div>

                {/* System Diagnostics */}
                <div className="glass-panel rounded-lg border border-zinc-800 p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center space-x-2">
                      <Cpu className="h-4.5 w-4.5 text-cyan-500" />
                      <span>Diagnostics</span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">Platform microservice execution logs</p>
                  </div>
                  
                  <div className="mt-4 bg-zinc-950 p-4 rounded border border-zinc-800/80 font-mono text-[11px] space-y-2 flex-1 overflow-y-auto text-zinc-400 max-h-48">
                    <p className="text-emerald-500">[INFO] IKIP Ingestion Engine Init complete.</p>
                    <p className="text-zinc-500">[INFO] ChromaDB storage mapped to local directory.</p>
                    <p className="text-cyan-400">[INFO] Embedding Service: loaded provider '{backendConfig.embedding_provider}'.</p>
                    <p className="text-cyan-400">[INFO] LLM Service: loaded provider '{backendConfig.llm_provider}'.</p>
                    <p className="text-purple-400">[INFO] Hybrid Search Module: BM25 index built + RRF fusion active.</p>
                    {backendStatus === "online" ? (
                      <p className="text-emerald-400">[INFO] API heartbeat online. Ready for queries.</p>
                    ) : (
                      <p className="text-rose-500">[WARN] Connection failed. Waiting for uvicorn host.</p>
                    )}
                    {documents.map((doc) => (
                      <p key={doc.id} className="text-zinc-400">
                        [INFO] Loaded document index: {doc.name.slice(0, 15)}... ({doc.total_chunks} chunks, date: {doc.upload_date})
                      </p>
                    ))}
                  </div>
                  
                  <button 
                    onClick={() => { checkHealth(); fetchDocuments(); }}
                    className="mt-4 w-full flex items-center justify-center space-x-2 py-2 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono hover:bg-zinc-800 text-zinc-300 transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Force diagnostics sync</span>
                  </button>
                </div>
              </div>

              {/* Action Box */}
              <div className="bg-gradient-to-r from-cyan-950/20 to-zinc-900 p-6 rounded-lg border border-cyan-950/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-cyan-400 font-mono uppercase tracking-wider">Ready to query?</h4>
                  <p className="text-xs text-zinc-400">Navigate to the AI Assistant tab to query loaded knowledge bases with interactive citations.</p>
                </div>
                <button
                  onClick={() => setActiveTab("chat")}
                  className="px-4 py-2.5 rounded bg-cyan-500 text-zinc-950 text-xs font-bold font-mono tracking-wider hover:bg-cyan-400 transition"
                >
                  Launch AI Assistant
                </button>
              </div>

            </div>
          )}

          {/* TAB CONTENT: KNOWLEDGE LIBRARY */}
          {activeTab === "library" && (
            <div className="space-y-6">
              
              {/* Grid: Upload & File list */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* File Uploader */}
                <div className="lg:col-span-1 glass-panel rounded-lg border border-zinc-800 p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center space-x-2">
                      <Upload className="h-4.5 w-4.5 text-cyan-500" />
                      <span>Ingest Document</span>
                    </h3>
                    <p className="text-xs text-zinc-500 mt-1">Upload technical PDFs to vectorize</p>
                  </div>
                  
                  {/* Drop zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={triggerFileInput}
                    className={`mt-6 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition ${
                      dragActive 
                        ? "border-cyan-500 bg-cyan-950/20" 
                        : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40"
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept=".pdf" 
                    />
                    
                    {isUploading ? (
                      <div className="text-center space-y-4">
                        <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-xs font-mono text-cyan-400 uppercase animate-pulse">{uploadStatusMsg}</p>
                      </div>
                    ) : (
                      <div className="text-center space-y-3">
                        <Upload className="h-8 w-8 text-zinc-500 mx-auto" />
                        <div>
                          <p className="text-xs font-semibold text-zinc-300">Drag and drop document here</p>
                          <p className="text-[11px] text-zinc-500 font-mono mt-1">or click to browse local files</p>
                        </div>
                        <span className="inline-block px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-400 rounded border border-zinc-700 font-mono uppercase">
                          PDF ONLY
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 text-[10px] text-zinc-500 space-y-1.5 font-mono">
                    <p>● Max PDF size support: 100 MB.</p>
                    <p>● Heading preservation chunking active.</p>
                    <p>● Metadata (upload date, type) extracted.</p>
                  </div>
                </div>

                {/* File List Table */}
                <div className="lg:col-span-2 glass-panel rounded-lg border border-zinc-800 p-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center space-x-2 mb-4">
                    <BookOpen className="h-4.5 w-4.5 text-cyan-500" />
                    <span>Indexed Knowledge Bases</span>
                  </h3>
                  
                  {documents.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center border border-zinc-800 border-dashed rounded bg-zinc-950/10">
                      <FileText className="h-8 w-8 text-zinc-600 mb-2" />
                      <p className="text-xs font-mono text-zinc-500">No documents indexed in vector store.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-500">
                            <th className="pb-3 font-semibold">Document Name</th>
                            <th className="pb-3 font-semibold text-center hidden md:table-cell">Type</th>
                            <th className="pb-3 font-semibold text-center hidden md:table-cell">Upload Date</th>
                            <th className="pb-3 font-semibold text-center">Pages</th>
                            <th className="pb-3 font-semibold text-center text-cyan-400">Chunks</th>
                            <th className="pb-3 font-semibold text-right">Size</th>
                            <th className="pb-3 font-semibold text-center w-16">Purge</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {documents.map((doc) => (
                            <tr key={doc.id} className="hover:bg-zinc-900/30 text-zinc-300">
                              <td className="py-3 flex items-center space-x-2 font-sans font-medium text-white max-w-[200px] truncate">
                                <FileText className="h-4 w-4 text-cyan-500/80 shrink-0" />
                                <span className="truncate" title={doc.name}>{doc.name}</span>
                              </td>
                              <td className="py-3 text-center hidden md:table-cell uppercase text-[10px] text-zinc-400">{doc.doc_type || "pdf"}</td>
                              <td className="py-3 text-center hidden md:table-cell text-zinc-400">{doc.upload_date || "N/A"}</td>
                              <td className="py-3 text-center">{doc.total_pages}</td>
                              <td className="py-3 text-center text-cyan-500">{doc.total_chunks}</td>
                              <td className="py-3 text-right text-zinc-400">{formatBytes(doc.size_bytes)}</td>
                              <td className="py-3 text-center">
                                <button
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="p-1 rounded text-zinc-500 hover:text-rose-500 hover:bg-rose-950/20 transition"
                                  title="Delete document"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                
              </div>
            </div>
          )}

          {/* TAB CONTENT: KNOWLEDGE GRAPH */}
          {activeTab === "graph" && (
            <div className="space-y-6">
              
              {/* Stats & Search Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                
                {/* Stats cards */}
                <div className="md:col-span-1 flex space-x-4">
                  <div className="flex-1 glass-panel p-4 rounded-lg border border-zinc-800 flex flex-col justify-between">
                    <p className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Graph Entities</p>
                    <p className="text-2xl font-extrabold text-white mt-1 font-mono">
                      {graphSearchResult ? graphSearchResult.nodes.length : graphNodes.length}
                    </p>
                  </div>
                  <div className="flex-1 glass-panel p-4 rounded-lg border border-zinc-800 flex flex-col justify-between">
                    <p className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Relationships</p>
                    <p className="text-2xl font-extrabold text-cyan-400 mt-1 font-mono">
                      {graphSearchResult ? graphSearchResult.edges.length : graphEdges.length}
                    </p>
                  </div>
                </div>

                {/* Graph Search Bar */}
                <div className="md:col-span-2 flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      value={graphSearchQuery}
                      onChange={(e) => setGraphSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleGraphSearch(graphSearchQuery)}
                      placeholder="Search entities (e.g. Pump-4) or query dependencies..."
                      className="w-full pl-10 pr-4 py-2 rounded bg-zinc-950 text-sm border border-zinc-800 focus:outline-none focus:border-cyan-500/60 text-[#f4f4f5] font-sans"
                    />
                    {graphSearchResult && (
                      <button
                        onClick={() => {
                          setGraphSearchQuery("");
                          setGraphSearchResult(null);
                          setSelectedNode(null);
                        }}
                        className="absolute right-3 top-2 text-xs text-cyan-500 hover:text-cyan-400 font-mono font-bold"
                      >
                        [Clear]
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleGraphSearch(graphSearchQuery)}
                    className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold font-mono uppercase tracking-wider transition"
                  >
                    Search
                  </button>
                </div>
              </div>

              {/* Main Graph Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* SVG Graph Canvas */}
                <div className="lg:col-span-2 glass-panel rounded-lg border border-zinc-800 p-4 bg-zinc-950/20 flex flex-col justify-between relative min-h-[480px]">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-4">
                    <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center space-x-2">
                      <Network className="h-4.5 w-4.5 text-cyan-500" />
                      <span>Industrial Schema View</span>
                    </h3>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Drag nodes to organize. Click node to inspect details.
                    </span>
                  </div>

                  {isGraphLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                      <div className="h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-mono text-cyan-400 uppercase animate-pulse">Syncing Graph Data...</p>
                    </div>
                  ) : graphError ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                      <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
                      <p className="text-xs font-mono text-rose-400">{graphError}</p>
                      <button
                        onClick={fetchGraphData}
                        className="mt-4 px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        Retry Connection
                      </button>
                    </div>
                  ) : (graphSearchResult ? graphSearchResult.nodes : graphNodes).length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded bg-zinc-950/10">
                      <Database className="h-8 w-8 text-zinc-600 mb-2" />
                      <p className="text-xs font-mono text-zinc-500">No entities extracted yet.</p>
                      <p className="text-[10px] text-zinc-600 font-mono mt-1">Upload files in the Knowledge Library to generate the graph.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-hidden select-none relative">
                      {/* Floating Zoom/Pan Controls */}
                      <div className="absolute right-2 top-2 flex flex-col space-y-1.5 z-20 bg-zinc-900/90 border border-zinc-800/80 p-1.5 rounded-md backdrop-blur-sm">
                        <button
                          onClick={() => setZoom(z => Math.min(5, z * 1.2))}
                          className="p-1 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition text-xs font-bold w-6 h-6 flex items-center justify-center"
                          title="Zoom In"
                        >
                          +
                        </button>
                        <button
                          onClick={() => setZoom(z => Math.max(0.2, z / 1.2))}
                          className="p-1 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition text-xs font-bold w-6 h-6 flex items-center justify-center"
                          title="Zoom Out"
                        >
                          −
                        </button>
                        <button
                          onClick={resetZoomPan}
                          className="p-1 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-[9px] font-mono text-zinc-400 hover:text-white transition w-6 h-6 flex items-center justify-center"
                          title="Reset View"
                        >
                          R
                        </button>
                      </div>

                      <svg
                        ref={svgRef}
                        width="100%"
                        height="420"
                        viewBox="0 0 780 420"
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onMouseDown={handleBgMouseDown}
                        className={`w-full h-full select-none transition-colors duration-150 ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
                      >
                        {/* Invisible background rect to capture all pan mouse events */}
                        <rect id="svg-bg" width="100%" height="100%" fill="transparent" pointerEvents="all" />

                        {/* Define arrow markers for directed links */}
                        <defs>
                          <marker
                            id="arrow"
                            viewBox="0 0 10 10"
                            refX="6"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3f3f46" />
                          </marker>
                          <marker
                            id="arrow-active"
                            viewBox="0 0 10 10"
                            refX="6"
                            refY="5"
                            markerWidth="6"
                            markerHeight="6"
                            orient="auto-start-reverse"
                          >
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                          </marker>
                        </defs>

                        {/* Force Layout Zoom & Pan Container */}
                        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                          {/* Draw Edges */}
                          {(graphSearchResult ? graphSearchResult.edges : graphEdges)
                            .filter(edge => {
                              const srcNode = (graphSearchResult ? graphSearchResult.nodes : graphNodes).find(n => n.name.toLowerCase() === edge.source.toLowerCase());
                              const tgtNode = (graphSearchResult ? graphSearchResult.nodes : graphNodes).find(n => n.name.toLowerCase() === edge.target.toLowerCase());
                              return srcNode && tgtNode && visibleTypes.has(srcNode.type) && visibleTypes.has(tgtNode.type);
                            })
                            .map((edge, idx) => {
                              const srcKey = edge.source.toLowerCase();
                              const tgtKey = edge.target.toLowerCase();
                              const posS = nodePositions[srcKey];
                              const posT = nodePositions[tgtKey];
                              
                              if (!posS || !posT) return null;
                              
                              const isSelectedSource = selectedNode?.name.toLowerCase() === srcKey;
                              const isSelectedTarget = selectedNode?.name.toLowerCase() === tgtKey;
                              const isActive = isSelectedSource || isSelectedTarget;
                              
                              const rS = isSelectedSource ? 15 : 12;
                              const rT = isSelectedTarget ? 15 : 12;
                              
                              const coords = getLineCoords(posS, posT, rS, rT);
                              const midX = (coords.x1 + coords.x2) / 2;
                              const midY = (coords.y1 + coords.y2) / 2;
                              
                              // Fix any corrupted label text
                              const rawLabel = edge.type.toLowerCase().replace(/_/g, " ").trim();
                              const relLabel = rawLabel === "cdependsconc" ? "depends on" : rawLabel;
                              const isHovered = hoveredEdgeIdx === idx;
                              
                              return (
                                <g 
                                  key={`edge-${idx}`}
                                  onMouseEnter={() => setHoveredEdgeIdx(idx)}
                                  onMouseLeave={() => setHoveredEdgeIdx(null)}
                                >
                                  {/* Invisible thicker line to capture hover events easily */}
                                  <line
                                    x1={coords.x1}
                                    y1={coords.y1}
                                    x2={coords.x2}
                                    y2={coords.y2}
                                    stroke="transparent"
                                    strokeWidth="10"
                                    pointerEvents="stroke"
                                    className="cursor-pointer"
                                  />
                                  <line
                                    x1={coords.x1}
                                    y1={coords.y1}
                                    x2={coords.x2}
                                    y2={coords.y2}
                                    stroke={isActive ? "#06b6d4" : "#27272a"}
                                    strokeWidth={isActive ? "2" : "1.2"}
                                    strokeDasharray={edge.type === "DEPENDS_ON" ? "4,4" : "none"}
                                    markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow)"}
                                    className="transition-all duration-150"
                                  />
                                  {isHovered && (
                                    <text
                                      x={midX}
                                      y={midY - 4}
                                      fill="#06b6d4"
                                      stroke="#09090b"
                                      strokeWidth="3"
                                      paintOrder="stroke"
                                      strokeLinejoin="round"
                                      fontSize="8"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                      className="font-mono select-none pointer-events-none transition-all duration-150"
                                    >
                                      {relLabel}
                                    </text>
                                  )}
                                </g>
                              );
                            })}

                          {/* Draw Nodes */}
                          {(graphSearchResult ? graphSearchResult.nodes : graphNodes)
                            .filter(node => visibleTypes.has(node.type))
                            .map((node) => {
                              const key = node.name.toLowerCase();
                              const pos = nodePositions[key];
                              if (!pos) return null;
                              
                              const styles = getNodeStyles(node.type);
                              const isSelected = selectedNode?.name.toLowerCase() === key;
                              const abbrev = node.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
                              
                              // Keep node name labels inside canvas by estimating label half-width and shifting
                              const halfWidth = (node.name.length * 5.5) / 2;
                              let labelX = 0;
                              if (pos.x - halfWidth < 10) {
                                labelX = 10 - pos.x + halfWidth;
                              } else if (pos.x + halfWidth > 770) {
                                labelX = 770 - pos.x - halfWidth;
                              }
                              
                              return (
                                <g
                                  key={`node-${key}`}
                                  transform={`translate(${pos.x}, ${pos.y})`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNodeClick(node);
                                  }}
                                  onMouseDown={(e) => handleMouseDown(key, e)}
                                  className="cursor-grab active:cursor-grabbing group"
                                >
                                  <circle
                                    r={isSelected ? "18" : "14"}
                                    fill="transparent"
                                    stroke={styles.fill}
                                    strokeWidth="4"
                                    strokeOpacity={isSelected ? "0.3" : "0"}
                                    className="transition-all duration-200 group-hover:stroke-opacity-20 group-hover:r-16"
                                  />
                                  
                                  <circle
                                    r={isSelected ? "15" : "12"}
                                    fill="#09090b"
                                    stroke={isSelected ? "#06b6d4" : styles.fill}
                                    strokeWidth={isSelected ? "3" : "2"}
                                    className="transition-all duration-150"
                                  />
                                  
                                  <text
                                    dy=".3em"
                                    textAnchor="middle"
                                    fill={isSelected ? "#06b6d4" : styles.stroke}
                                    fontSize="8"
                                    fontWeight="bold"
                                    className="font-mono select-none pointer-events-none"
                                  >
                                    {abbrev}
                                  </text>
                                  
                                  <text
                                    x={labelX}
                                    y="24"
                                    textAnchor="middle"
                                    fill={isSelected ? "#22d3ee" : "#d4d4d8"}
                                    fontSize="9"
                                    fontWeight={isSelected ? "bold" : "semibold"}
                                    className="font-sans select-none pointer-events-none filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                                  >
                                    {node.name}
                                  </text>
                                </g>
                              );
                            })}
                        </g>
                      </svg>
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-2 border-t border-zinc-800/80 pt-3 mt-4 text-[9px] font-mono text-zinc-500 justify-center">
                    {[
                      { type: "Equipment", color: "bg-rose-500" },
                      { type: "Assets", color: "bg-amber-500" },
                      { type: "Systems", color: "bg-cyan-500" },
                      { type: "Procedures", color: "bg-purple-500" },
                      { type: "Safety Items", color: "bg-emerald-500" },
                      { type: "Departments", color: "bg-indigo-500" },
                      { type: "Locations", color: "bg-sky-500" }
                    ].map((item) => {
                      const isVisible = visibleTypes.has(item.type);
                      return (
                        <button
                          key={item.type}
                          onClick={() => toggleTypeVisibility(item.type)}
                          className={`flex items-center space-x-1.5 cursor-pointer select-none transition-all duration-150 py-1 px-2 rounded hover:bg-zinc-900 border border-transparent hover:border-zinc-800 ${
                            isVisible ? "text-zinc-300 font-semibold" : "opacity-30 text-zinc-600 line-through"
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${item.color} ${isVisible ? "" : "bg-zinc-700"}`} />
                          <span>{item.type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Graph Inspector Panel */}
                <div className="lg:col-span-1 glass-panel rounded-lg border border-zinc-800 flex flex-col overflow-hidden min-h-[480px]">
                  <div className="px-4 py-3 bg-[#121214] border-b border-zinc-800 flex items-center space-x-2 shrink-0">
                    <Search className="h-4.5 w-4.5 text-cyan-500" />
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">Entity Inspector</span>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/10">
                    {!selectedNode ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 font-mono text-xs space-y-2 py-12">
                        <Network className="h-8 w-8 text-zinc-800 animate-pulse" />
                        <p>Select any node in the schema or search above to inspect its metadata and relationships.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 font-mono text-xs">
                        
                        {/* Node Name and Type */}
                        <div className="bg-zinc-950 p-4 rounded border border-zinc-800/80 space-y-3 relative overflow-hidden">
                          <div className={`absolute top-0 right-0 px-2 py-0.5 text-[9px] rounded-bl border-l border-b ${getNodeStyles(selectedNode.type).border} ${getNodeStyles(selectedNode.type).bg} ${getNodeStyles(selectedNode.type).text}`}>
                            {selectedNode.type}
                          </div>
                          
                          <h4 className="text-sm font-bold text-white font-sans tracking-tight pr-12">
                            {selectedNode.name}
                          </h4>
                          
                          <div className="space-y-1.5 text-[10px] text-zinc-400 pt-1">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Source PDF:</span>
                              <span className="truncate max-w-[150px] text-right" title={selectedNode.source_document}>
                                {selectedNode.source_document || "N/A"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Page Reference:</span>
                              <span className="text-cyan-400 font-bold">Page {selectedNode.page_number || "1"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Node Relationships */}
                        <div className="space-y-2">
                          {(() => {
                            const visibleRels = selectedNodeRelationships.filter(rel => {
                              const isSource = rel.source.toLowerCase() === selectedNode.name.toLowerCase();
                              const connectedName = isSource ? rel.target : rel.source;
                              const connectedNodeObj = (graphSearchResult ? graphSearchResult.nodes : graphNodes).find(
                                n => n.name.toLowerCase() === connectedName.toLowerCase()
                              );
                              if (!connectedNodeObj) return true;
                              return visibleTypes.has(connectedNodeObj.type);
                            });

                            return (
                              <>
                                <h5 className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 border-b border-zinc-800/80 pb-1.5">
                                  Connected Relationships ({visibleRels.length})
                                </h5>
                                
                                {visibleRels.length === 0 ? (
                                  <p className="text-zinc-600 italic text-[10px] py-2">No active relationships found.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {visibleRels.map((rel, idx) => {
                                      const isSource = rel.source.toLowerCase() === selectedNode.name.toLowerCase();
                                      const connectedName = isSource ? rel.target : rel.source;
                                      const connectedNodeObj = (graphSearchResult ? graphSearchResult.nodes : graphNodes).find(
                                        n => n.name.toLowerCase() === connectedName.toLowerCase()
                                      );
                                      const connectedType = connectedNodeObj ? connectedNodeObj.type : "Assets";
                                      
                                      return (
                                        <div
                                          key={idx}
                                          className="p-2.5 rounded bg-zinc-900 border border-zinc-800/80 flex flex-col space-y-2 hover:border-zinc-700 transition"
                                        >
                                          <div className="flex items-center justify-between text-[9px]">
                                            <span className="text-cyan-400 font-bold tracking-wide uppercase px-1 py-0.5 rounded bg-cyan-950/40 border border-cyan-800/30">
                                              {rel.type}
                                            </span>
                                            <span className="text-zinc-500">
                                              {isSource ? "Outgoing" : "Incoming"}
                                            </span>
                                          </div>
                                          
                                          <div className="flex items-center justify-between pt-1">
                                            <div className="flex items-center space-x-1.5 font-sans font-bold text-white truncate max-w-[70%] text-[11px]">
                                              <span className="text-zinc-400 font-normal font-mono text-[9px]">
                                                {isSource ? "To:" : "From:"}
                                              </span>
                                              <span className="truncate">{connectedName}</span>
                                            </div>
                                            
                                            <button
                                              onClick={() => {
                                                if (connectedNodeObj) {
                                                  handleNodeClick(connectedNodeObj);
                                                } else {
                                                  handleNodeClick({ name: connectedName, type: connectedType });
                                                }
                                              }}
                                              className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-cyan-900/30 hover:text-cyan-400 text-[9px] border border-zinc-700/80 hover:border-cyan-500/20 transition-all font-mono"
                                            >
                                              [Inspect]
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>

                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB CONTENT: COMPLIANCE INTELLIGENCE */}
          {activeTab === "compliance" && (
            <div className="space-y-6">
              
              {/* Header and Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#121214] p-4 rounded-lg border border-zinc-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-cyan-400" />
                    Compliance & Gap Detection Engine
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono mt-1">
                    System last analyzed: {complianceData?.last_updated ? new Date(complianceData.last_updated).toLocaleString() : "Never"}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {complianceData && (
                    <button
                      onClick={() => {
                        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(complianceData, null, 2));
                        const downloadAnchor = document.createElement('a');
                        downloadAnchor.setAttribute("href", dataStr);
                        downloadAnchor.setAttribute("download", `compliance_report_${new Date().toISOString().slice(0,10)}.json`);
                        document.body.appendChild(downloadAnchor);
                        downloadAnchor.click();
                        downloadAnchor.remove();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
                    >
                      Export JSON
                    </button>
                  )}

                  <button
                    onClick={handleAnalyzeCompliance}
                    disabled={isAnalyzingCompliance}
                    className="group flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 px-4 py-2 rounded shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 transition-all duration-300 disabled:opacity-50 cursor-pointer"
                  >
                    {isAnalyzingCompliance ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-500" />
                        Run Audit Analysis
                      </>
                    )}
                  </button>
                </div>
              </div>

              {complianceError && (
                <div className="bg-rose-950/30 border border-rose-900 text-rose-400 text-xs rounded-lg p-4 font-mono">
                  {complianceError}
                </div>
              )}

              {!complianceData ? (
                <div className="glass-panel p-12 rounded-lg border border-zinc-800 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-mono text-zinc-450">Querying compliance ledger database...</span>
                </div>
              ) : (
                <>
                  {/* Top Row Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Score Card */}
                    <div className="glass-panel p-5 rounded-lg border border-zinc-800 relative overflow-hidden flex items-center gap-6 lg:col-span-1 bg-[#09090b]/40">
                      <div className="relative flex-shrink-0 flex items-center justify-center w-24 h-24 rounded-full border-4 border-zinc-800">
                        <div className="text-center">
                          <span className="block text-3xl font-black tracking-tight text-white font-mono">{complianceData.score}</span>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block -mt-1">/ 100</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block font-bold tracking-widest">Compliance Status</span>
                        <h3 className={`text-xl font-extrabold tracking-tight uppercase ${
                          complianceData.risk_level === "UNVERIFIED"
                            ? "text-zinc-500"
                            : complianceData.score >= 95
                            ? "text-emerald-400"
                            : complianceData.score >= 80
                            ? "text-cyan-400"
                            : complianceData.score >= 60
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}>
                          {complianceData.risk_level}
                        </h3>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          {complianceData.risk_level === "UNVERIFIED"
                            ? "No operational documents exist. Compliance cannot be assessed."
                            : complianceData.score >= 95
                            ? "Excellent rating. All mandatory SOPs and records are fully reconciled."
                            : complianceData.score >= 80
                            ? "Compliance is healthy, but minor documentation gaps exist."
                            : complianceData.score >= 60
                            ? "Warning: Several inspections or procedures are missing. Potential risk identified."
                            : "Critical Action Required: High compliance failure. Mandatory procedures absent."
                          }
                        </p>
                      </div>
                    </div>

                    {/* Historical Score Trend */}
                    <div className="glass-panel p-5 rounded-lg border border-zinc-800 lg:col-span-2 flex flex-col justify-between bg-[#09090b]/40">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-widest">Historical Compliance Trend</span>
                        <span className="text-[9px] text-zinc-650 font-mono">Last 5 Audits</span>
                      </div>

                      <div className="h-28 w-full relative pt-2">
                        {complianceData.historical_scores && complianceData.historical_scores.length > 0 ? (
                          <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                            <line x1="0" y1="20" x2="400" y2="20" stroke="#18181b" strokeWidth="0.75" strokeDasharray="3 3" />
                            <line x1="0" y1="50" x2="400" y2="50" stroke="#18181b" strokeWidth="0.75" strokeDasharray="3 3" />
                            <line x1="0" y1="80" x2="400" y2="80" stroke="#18181b" strokeWidth="0.75" strokeDasharray="3 3" />
                            
                            {(() => {
                              const points = complianceData.historical_scores;
                              const width = 400;
                              const height = 100;
                              const padding = 20;
                              const xStep = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
                              
                              const coords = points.map((p: any, i: number) => {
                                const x = padding + i * xStep;
                                const y = height - padding - (p.score / 100) * (height - padding * 2);
                                return { x, y, score: p.score, date: p.date };
                              });

                              const pathD = coords.reduce((acc: string, curr: any, i: number) => {
                                return i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
                              }, "");

                              return (
                                <>
                                  <path d={pathD} fill="none" stroke="url(#complianceChartGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  
                                  {coords.map((c: any, i: number) => (
                                    <g key={i}>
                                      <circle cx={c.x} cy={c.y} r="3" className="fill-cyan-500 stroke-zinc-950 stroke-2 cursor-pointer transition-all" />
                                      <text x={c.x} y={c.y - 7} textAnchor="middle" className="fill-zinc-300 text-[8px] font-mono font-bold">
                                        {c.score}%
                                      </text>
                                      <text x={c.x} y="95" textAnchor="middle" className="fill-zinc-550 text-[7px] font-mono">
                                        {c.date.slice(5)}
                                      </text>
                                    </g>
                                  ))}

                                  <defs>
                                    <linearGradient id="complianceChartGradient" x1="0" y1="0" x2="1" y2="0">
                                      <stop offset="0%" stopColor="#06b6d4" />
                                      <stop offset="100%" stopColor="#3b82f6" />
                                    </linearGradient>
                                  </defs>
                                </>
                              );
                            })()}
                          </svg>
                        ) : (
                          <div className="h-full flex items-center justify-center text-xs text-zinc-650 font-mono">
                            No historical audits recorded.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary Cards Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { 
                        title: "Missing Procedures", 
                        value: complianceData.gaps_summary.missing_procedures,
                        desc: "Unresolved SOPs / guides"
                      },
                      { 
                        title: "Missing Inspections", 
                        value: complianceData.gaps_summary.missing_inspections,
                        desc: "Audit checksheets missing"
                      },
                      { 
                        title: "Missing Certifications", 
                        value: complianceData.gaps_summary.missing_certifications,
                        desc: "Expired or missing licenses"
                      },
                      { 
                        title: "Missing Safety Records", 
                        value: complianceData.gaps_summary.missing_safety_records,
                        desc: "LOTO / PPE safety gaps"
                      }
                    ].map((card, cIdx) => (
                      <div key={cIdx} className="glass-panel p-4 rounded-lg border border-zinc-800 flex flex-col justify-between group hover:border-zinc-700 transition-colors bg-[#09090b]/20">
                        <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block tracking-wider">{card.title}</span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className={`text-2xl font-extrabold font-mono ${card.value > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                            {card.value}
                          </span>
                          <span className="text-[9px] text-zinc-550 font-mono">detected</span>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1 leading-normal font-mono">{card.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Coverage Matrix Grid */}
                  {complianceData.coverage_matrix && (
                    <div className="glass-panel p-5 rounded-lg border border-zinc-800 bg-[#09090b]/40">
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 mb-4 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-cyan-500" />
                        Semantic Compliance Coverage Matrix
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(complianceData.coverage_matrix).map(([cat, val]: any) => {
                          const details = complianceData.coverage_details?.[cat] || {};
                          const level = details.coverage_level || "Missing";
                          return (
                            <div key={cat} className="flex flex-col justify-between bg-zinc-950/60 border border-zinc-850 p-4 rounded hover:border-zinc-800 transition-all gap-3">
                              
                              {/* Header Row */}
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-zinc-200 text-xs">{cat}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                                    level === "Fully Covered"
                                      ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30"
                                      : level === "Partially Covered"
                                      ? "bg-amber-950/30 text-amber-400 border border-amber-900/30"
                                      : "bg-rose-950/30 text-rose-400 border border-rose-900/30"
                                  }`}>
                                    {level}
                                  </span>
                                  <span className="font-mono text-zinc-400 text-xs font-bold">{val}%</span>
                                </div>
                              </div>

                              {/* Confidence & Ratio row */}
                              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 border-b border-zinc-900/60 pb-2">
                                <span>Confidence: <span className={
                                  details.audit_confidence === "High Confidence" ? "text-emerald-400 font-semibold" :
                                  details.audit_confidence === "Medium Confidence" ? "text-amber-400 font-semibold" : "text-rose-400 font-semibold"
                                }>{details.audit_confidence || "Low"}</span></span>
                                <span>Ratio: {details.requirements_satisfied_count || 0} / {details.requirements_total_count || 0}</span>
                              </div>

                              {/* Subparts Checklist */}
                              {details.requirements_status && (
                                <div className="space-y-1.5 my-1">
                                  {Object.entries(details.requirements_status).map(([reqName, reqVal]: any) => {
                                    const isSat = reqVal.status === "satisfied";
                                    return (
                                      <div key={reqName} className="flex items-center justify-between text-[10px] font-sans">
                                        <span className="text-zinc-400 flex items-center gap-1.5 truncate pr-2">
                                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isSat ? "bg-emerald-500" : "bg-rose-500"}`} />
                                          <span className="truncate">{reqName}</span>
                                        </span>
                                        {isSat ? (
                                          <span className="text-emerald-400 font-mono text-[9px] truncate max-w-[130px] font-semibold" title={`${reqVal.doc_name} (Page ${reqVal.page})${reqVal.heading ? ` | Heading: ${reqVal.heading}` : ""}`}>
                                            {reqVal.doc_name} (p.{reqVal.page}){reqVal.heading && reqVal.heading !== "N/A" ? ` [${reqVal.heading.slice(0, 12)}...]` : ""}
                                          </span>
                                        ) : (
                                          <span className="text-zinc-650 font-mono text-[9px]">Missing</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Documents Match Row */}
                              {details.documents_matched && details.documents_matched.length > 0 && (
                                <div className="flex flex-wrap gap-1 text-[8px] font-mono text-zinc-600 border-t border-zinc-900/60 pt-2 mt-1">
                                  <span className="font-bold text-zinc-500 mr-1">Docs:</span>
                                  {details.documents_matched.map((doc: string, dIdx: number) => (
                                    <span key={dIdx} className="bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded truncate max-w-[90px]" title={doc}>
                                      {doc}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Detailed Table */}
                  <div className="glass-panel rounded-lg border border-zinc-800 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 bg-[#121214] border-b border-zinc-800 flex justify-between items-center">
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">Detailed Compliance Ledger & Gap Explanations</span>
                      <span className="text-[10px] text-zinc-550 font-mono">Showing {complianceData.gaps.length} gaps</span>
                    </div>

                    {complianceData.gaps.length === 0 ? (
                      <div className="p-8 text-center text-zinc-500 font-mono text-xs">
                        🎉 Excellent! No compliance gaps were identified in your current operational document library.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left font-sans text-xs">
                          <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-550 uppercase font-mono text-[9px] tracking-wider">
                              <th className="py-3 px-4 font-semibold">Severity</th>
                              <th className="py-3 px-4 font-semibold">Compliance Gap</th>
                              <th className="py-3 px-4 font-semibold">Category</th>
                              <th className="py-3 px-4 font-semibold">Source Document</th>
                              <th className="py-3 px-4 font-semibold">Evidence Snippet</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-850 bg-[#09090b]/10">
                            {complianceData.gaps.map((gap: any, gIdx: number) => (
                              <tr key={gIdx} className="hover:bg-zinc-900/30 group transition-colors">
                                <td className="py-3 px-4 shrink-0">
                                  <div className="flex flex-col gap-1">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider text-center ${
                                      gap.severity === "Critical"
                                        ? "bg-rose-950/40 text-rose-400 border border-rose-900/40"
                                        : gap.severity === "High"
                                        ? "bg-amber-950/40 text-amber-400 border border-amber-900/40"
                                        : gap.severity === "Medium"
                                        ? "bg-yellow-950/20 text-yellow-500 border border-yellow-900/30"
                                        : "bg-cyan-950/30 text-cyan-400 border border-cyan-900/30"
                                    }`}>
                                      {gap.severity}
                                    </span>
                                    {gap.confidence_score !== undefined && (
                                      <span className="text-[9px] text-zinc-550 font-mono text-center">
                                        Conf: {Math.round(gap.confidence_score * 100)}%
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div>
                                    <span className="font-bold text-zinc-200 block text-xs">{gap.gap}</span>
                                    <p className="text-zinc-450 mt-1 text-[11px] leading-normal font-sans pr-2 max-w-lg">{gap.explanation}</p>
                                    {gap.recommended_remediation && (
                                      <p className="text-cyan-400/90 mt-1.5 text-[10px] leading-normal font-sans">
                                        <span className="font-bold uppercase tracking-wider text-[8px] font-mono text-zinc-500 mr-1.5">Remediation:</span>
                                        {gap.recommended_remediation}
                                      </p>
                                    )}
                                    {gap.nodes_involved && gap.nodes_involved.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                                        <span className="text-[8px] font-mono text-zinc-500 uppercase font-bold mr-1.5">Nodes:</span>
                                        {gap.nodes_involved.map((n: string, ni: number) => (
                                          <span key={ni} className="bg-zinc-900 border border-zinc-850 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded font-mono">
                                            {n}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-zinc-400 font-mono text-[10px]">
                                  {gap.category}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="max-w-[150px] truncate text-zinc-300 font-mono" title={gap.source_document}>
                                    {gap.source_document}
                                  </div>
                                  <span className="text-[10px] text-zinc-550 font-mono block mt-0.5">Page {gap.page}</span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="max-w-xs text-[10px] text-zinc-500 bg-zinc-950/50 border border-zinc-850 p-2 rounded leading-relaxed max-h-[85px] overflow-y-auto font-mono whitespace-pre-wrap">
                                    {gap.evidence}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB CONTENT: CHAT ASSISTANT */}
          {activeTab === "chat" && (
            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] overflow-hidden">
              
              {/* Chat Box */}
              <div className="flex-1 flex flex-col glass-panel rounded-lg border border-zinc-800 overflow-hidden">
                {/* Chat Header */}
                <div className="px-4 py-3 bg-[#121214] border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4.5 w-4.5 text-cyan-500" />
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">Industrial QA Assistant</span>
                  </div>
                  
                  {chatLoading && (
                    <div className="flex items-center space-x-1.5 text-[10px] text-cyan-400 font-mono uppercase animate-pulse">
                      <span className="h-1.5 w-1.5 bg-cyan-400 rounded-full animate-bounce" />
                      <span>RAG Retrieving...</span>
                    </div>
                  )}
                </div>

                {/* Messages log */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/20">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex gap-3 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      {/* Avatar */}
                      <div className={`h-8 w-8 rounded flex items-center justify-center shrink-0 border text-xs font-mono font-bold ${
                        msg.role === "user" 
                          ? "bg-zinc-800 border-zinc-700 text-zinc-300"
                          : "bg-cyan-950/50 border-cyan-500/40 text-cyan-400"
                      }`}>
                        {msg.role === "user" ? <User className="h-4.5 w-4.5" /> : <Cpu className="h-4.5 w-4.5" />}
                      </div>

                      {/* Content Bubble */}
                      <div className="space-y-1">
                        <div className={`p-3 rounded text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-cyan-950/40 text-zinc-200 border border-cyan-800/40 rounded-tr-none"
                            : "bg-[#121214] text-zinc-300 border border-zinc-800/60 rounded-tl-none"
                        }`}>
                          {msg.content}
                        </div>
                        
                        {/* Show message metadata / timestamp */}
                        <div className={`text-[10px] font-mono text-zinc-500 px-1 ${msg.role === "user" ? "text-right" : ""}`}>
                          {msg.timestamp}
                          {msg.citations && msg.citations.length > 0 && (
                            <button
                              onClick={() => setActiveCitations(msg.citations || [])}
                              className="ml-2 text-cyan-500 hover:underline font-semibold"
                            >
                              [View {msg.citations.length} Citations]
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {chatLoading && (
                    <div className="flex gap-3 max-w-[85%] mr-auto">
                      <div className="h-8 w-8 rounded flex items-center justify-center shrink-0 border bg-cyan-950/50 border-cyan-500/40 text-cyan-400">
                        <Cpu className="h-4.5 w-4.5" />
                      </div>
                      <div className="p-4 bg-[#121214] border border-zinc-800/60 rounded-lg rounded-tl-none space-y-2 w-48 animate-pulse">
                        <div className="h-2.5 bg-zinc-800 rounded w-full" />
                        <div className="h-2.5 bg-zinc-800 rounded w-5/6" />
                        <div className="h-2.5 bg-zinc-800 rounded w-2/3" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input panel */}
                <div className="p-3 bg-[#121214] border-t border-zinc-800 space-y-3">
                  
                  {/* Collapsible Search Filters */}
                  <div className="border-b border-zinc-800/80 pb-2">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className="text-[10px] font-mono text-zinc-500 hover:text-cyan-400 flex items-center space-x-1 transition"
                    >
                      <span>{showFilters ? "[-] Hide Search Filters" : "[+] Show Search Filters"}</span>
                      {(filterDocName || filterDocType || filterUploadDate) && (
                        <span className="text-cyan-400 font-bold bg-cyan-950/40 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ml-2 border border-cyan-800/30">Active Filters</span>
                      )}
                    </button>
                    
                    {showFilters && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 p-2 bg-zinc-950/80 rounded border border-zinc-900 font-mono text-[11px]">
                        <div>
                          <label className="block text-zinc-500 mb-1">Document Name</label>
                          <select
                            value={filterDocName}
                            onChange={(e) => setFilterDocName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-cyan-500 text-[10px]"
                          >
                            <option value="">All Documents</option>
                            {documents.map((doc) => (
                              <option key={doc.id} value={doc.name}>{doc.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-zinc-500 mb-1">Doc Type</label>
                          <select
                            value={filterDocType}
                            onChange={(e) => setFilterDocType(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-cyan-500 text-[10px]"
                          >
                            <option value="">All Types</option>
                            <option value="pdf">PDF</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-zinc-500 mb-1">Upload Date</label>
                          <input
                            type="date"
                            value={filterUploadDate}
                            onChange={(e) => setFilterUploadDate(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-cyan-500 text-[10px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Prompts list (visible only when chat is quiet) */}
                  {messages.length === 1 && !chatLoading && (
                    <div className="flex flex-wrap gap-2 pb-1.5">
                      {quickPrompts.map((promptText, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuery(promptText)}
                          className="text-[11px] font-sans px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 transition"
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleQuery(userInput)}
                      placeholder={totalDocsCount === 0 ? "Upload documents to enable search query..." : "Query manual knowledge base..."}
                      disabled={chatLoading || totalDocsCount === 0}
                      className="flex-1 px-3 py-2 rounded bg-zinc-950 text-sm border border-zinc-800 focus:outline-none focus:border-cyan-500/60 disabled:opacity-50 disabled:cursor-not-allowed text-[#f4f4f5]"
                    />
                    <button
                      onClick={() => handleQuery(userInput)}
                      disabled={chatLoading || !userInput.trim() || totalDocsCount === 0}
                      className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold font-mono uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Execute
                    </button>
                  </div>
                </div>
              </div>

              {/* Citations Panel */}
              <div className="w-full lg:w-80 glass-panel rounded-lg border border-zinc-800 flex flex-col overflow-hidden">
                <div className="px-4 py-3 bg-[#121214] border-b border-zinc-800 flex items-center space-x-2 shrink-0">
                  <Search className="h-4.5 w-4.5 text-cyan-500" />
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-200">Source Citations</span>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-zinc-950/10">
                  {activeCitations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 font-mono text-xs space-y-2">
                      <Database className="h-8 w-8 text-zinc-800" />
                      <p>Ask a question or select citations in messages to inspect retrieved passages.</p>
                    </div>
                  ) : (
                    activeCitations.map((citation, idx) => (
                      <div 
                        key={idx} 
                        className="bg-zinc-950 p-3 rounded border border-zinc-800/80 space-y-2 font-mono text-[11px] relative overflow-hidden group hover:border-cyan-500/30 transition"
                      >
                        {/* Normalized percentage display score */}
                        <div className="absolute right-0 top-0 bg-cyan-950/60 text-cyan-400 border-l border-b border-cyan-800/40 px-1.5 py-0.5 text-[9px] rounded-bl">
                          {citation.score ? `${(citation.score * 100).toFixed(0)}% Match` : `Reference`}
                        </div>
                        
                        <div className="flex items-center space-x-1.5 text-white font-sans font-bold text-xs truncate max-w-[80%]">
                          <FileText className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                          <span className="truncate" title={citation.doc_name}>{citation.doc_name}</span>
                        </div>
                        
                        <div className="text-[10px] text-cyan-500 font-semibold uppercase">
                          Page {citation.page}
                        </div>
                        
                        <blockquote className="border-l border-zinc-700 pl-2 text-zinc-400 italic mt-2 whitespace-pre-wrap break-words leading-relaxed font-sans text-xs">
                          "...{citation.text_snippet}..."
                        </blockquote>

                        {/* Expandable Explanation Tooltip for debug scores */}
                        {citation.explanation && (
                          <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[9px] text-zinc-500 leading-normal font-mono group-hover:text-zinc-400 transition">
                            {citation.explanation}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
