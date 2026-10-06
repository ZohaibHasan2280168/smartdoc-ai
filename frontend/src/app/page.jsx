"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Activity,
  Sparkles,
  Send,
  RefreshCw,
  Cpu,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Layers,
  FileText,
  Clock,
  ExternalLink,
  Flame,
  Zap,
  BarChart3,
  ShieldCheck,
  Server,
  Copy,
  Check,
  Terminal,
  Database
} from "lucide-react";
import FileUpload from "../components/FileUpload";
import AIConsole from "../components/AIConsole";

export default function SmartDocDashboard() {
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);

  // AI Query States
  const [query, setQuery] = useState("");
  const [analysisMode, setAnalysisMode] = useState("qa");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [copiedResult, setCopiedResult] = useState(false);

  // Live Console Logs
  const [logs, setLogs] = useState([
    {
      timestamp: new Date().toLocaleTimeString(),
      level: "INFO",
      source: "NextJS",
      message: "SmartDoc AI Dashboard initialized. Connected to Tier 2 microservices."
    }
  ]);

  const getApiBase = () => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      // If accessed via public IP (e.g. EC2 server: 3.94.149.149):
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return `${window.location.protocol}//${hostname}:8000`;
      }
      // If on AWS ELB, relative path /api:
      if (hostname.includes("elb.amazonaws.com")) {
        return "";
      }
      // If not localhost or 127.0.0.1, use port 8000 on same host:
      if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        return `${window.location.protocol}//${hostname}:8000`;
      }
    }
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  };

  const API_BASE = getApiBase();

  const addLog = useCallback((level, source, message) => {
    const newLog = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      source,
      message
    };
    setLogs((prev) => [...prev.slice(-150), newLog]);
  }, []);

  // Poll Health Check Endpoint
  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/v1/health`);
      const latency = Math.round(performance.now() - t0);
      
      if (!res.ok) {
        throw new Error(`Service returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setHealth(data);
      addLog("INFO", "FastAPI", `Health probe OK: status=${data.status}, uptime=${data.uptime_seconds?.toFixed(0)}s (${latency}ms)`);
    } catch (err) {
      setHealth({
        status: "unhealthy",
        dependencies: {
          database: { status: "disconnected" },
          cache: { status: "disconnected" }
        }
      });
      addLog("ERROR", "FastAPI", `Health probe failed: ${err.message}. Is backend running on ${API_BASE}?`);
    } finally {
      setHealthLoading(false);
    }
  }, [API_BASE, addLog]);

  // Fetch Ingested Documents
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (data.length > 0 && !selectedDocId) {
          setSelectedDocId(data[0].id);
        }
      }
    } catch (err) {
      addLog("WARN", "FastAPI", `Could not retrieve documents: ${err.message}`);
    }
  }, [API_BASE, selectedDocId, addLog]);

  useEffect(() => {
    fetchHealth();
    fetchDocuments();
    const interval = setInterval(fetchHealth, 30000); // 30s background probe interval
    return () => clearInterval(interval);
  }, [fetchHealth, fetchDocuments]);

  // Security: Client-side input validation and execution
  const handleAnalyze = async (e) => {
    e?.preventDefault();
    const sanitizedQuery = query.trim();

    if (!sanitizedQuery) return;

    if (sanitizedQuery.length > 2000) {
      setAnalysisError("Query exceeds the maximum allowed length of 2,000 characters.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    addLog("INFO", "FastAPI", `POST /api/v1/analyze initiated [doc_id=${selectedDocId || "all"}, mode=${analysisMode}]`);

    try {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/v1/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: selectedDocId,
          query: sanitizedQuery,
          mode: analysisMode
        })
      });

      const clientLatency = Math.round(performance.now() - t0);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: "Analysis failed" }));
        throw new Error(errJson.detail || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setAnalysisResult(data);

      const sourceTag = data.cached ? "Redis" : (data.model_used.includes("openai") ? "OpenAI" : "Mock-AI");
      addLog("INFO", sourceTag, `Analysis completed: model=${data.model_used}, latency=${data.latency_ms}ms, cached=${data.cached}`);
      addLog("METRIC", "Prometheus", `Total client RTT: ${clientLatency}ms; tokens: ${data.tokens_used}`);
    } catch (err) {
      setAnalysisError(err.message);
      addLog("ERROR", "FastAPI", `Analysis error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleAnalyze();
    }
  };

  const copyAnalysisToClipboard = () => {
    if (!analysisResult?.response) return;
    navigator.clipboard.writeText(analysisResult.response);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const selectedDocumentName = useMemo(() => {
    if (!selectedDocId) return "Entire Knowledge Repository";
    const doc = documents.find((d) => d.id === selectedDocId);
    return doc ? doc.filename : `Document #${selectedDocId}`;
  }, [documents, selectedDocId]);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Platform Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm border border-indigo-500/30">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-base font-semibold tracking-tight text-white">SmartDoc AI</h1>
                <span className="text-[11px] font-mono-code px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/80 font-medium">
                  v4.5 • S3 Storage
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Enterprise 3-Tier Document Intelligence & Telemetry
              </p>
            </div>
          </div>

          {/* Microservices Status Telemetry Badges */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-3 bg-slate-900/80 px-3.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono-code">
              {/* PostgreSQL Status */}
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${health?.dependencies?.database?.status === "connected" ? "bg-emerald-400" : "bg-rose-500"}`}></span>
                <span className="text-slate-400">Postgres</span>
              </div>

              <span className="text-slate-700">|</span>

              {/* Redis Status */}
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${health?.dependencies?.cache?.status === "connected" ? "bg-emerald-400" : "bg-rose-500"}`}></span>
                <span className="text-slate-400">Redis</span>
              </div>
            </div>

            {/* Overall Health Pill */}
            <button
              onClick={fetchHealth}
              disabled={healthLoading}
              className="flex items-center space-x-2 bg-slate-900/80 hover:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono-code transition-colors cursor-pointer"
              title="Click to re-probe health"
            >
              {health?.status === "healthy" ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className="capitalize font-medium text-slate-200">
                {health?.status || "Checking..."}
              </span>
              <RefreshCw className={`w-3 h-3 text-slate-400 ${healthLoading ? "animate-spin text-indigo-400" : ""}`} />
            </button>

            {/* Swagger & Prometheus Links */}
            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center space-x-1 text-xs text-slate-300 hover:text-white transition font-medium px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800"
            >
              <span>API Docs</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href={`${API_BASE}/metrics`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center space-x-1 text-xs text-slate-300 hover:text-white transition font-medium px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Metrics</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Architecture & Telemetry Summary Bar */}
        <div className="bg-[#0f172a]/70 border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                Production 3-Tier Microservices Architecture
              </p>
              <p className="text-xs text-slate-400">
                Next.js 14 Standalone &rarr; FastAPI Async AI Engine &rarr; Amazon RDS PostgreSQL 15 & Redis 7 Cache
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono-code">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/80">
              Zero-Trust SG Chained
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/80">
              S3 Direct Stream
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Prometheus Scraped
            </span>
          </div>
        </div>

        {/* 2-Column Responsive Application Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Document Ingestion & AI Query Studio */}
          <div className="lg:col-span-6 space-y-6">
            {/* File Upload Component */}
            <FileUpload
              selectedDocId={selectedDocId}
              onDocumentSelect={(id) => setSelectedDocId(id)}
              documents={documents}
              onRefreshDocs={fetchDocuments}
              onLog={addLog}
            />

            {/* AI Query & Analysis Execution Card */}
            <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-xl p-5 shadow-lg shadow-black/20 backdrop-blur-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
                      Document Intelligence Studio
                    </h2>
                    <p className="text-xs text-slate-400">
                      Context: <span className="text-slate-300 font-medium">{selectedDocumentName}</span>
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono-code px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  RAG Inference
                </span>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4">
                {/* Inference Mode Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Analysis Inference Mode
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "qa", label: "Q&A Insight" },
                      { id: "summary", label: "Executive Summary" },
                      { id: "key_points", label: "Key Takeaways" },
                      { id: "technical", label: "DevOps Audit" },
                    ].map((mode) => (
                      <button
                        type="button"
                        key={mode.id}
                        onClick={() => setAnalysisMode(mode.id)}
                        className={`text-xs py-2 px-3 rounded-lg border font-medium transition-all ${
                          analysisMode === mode.id
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                            : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Query Input Textarea */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Query / Analysis Prompt
                    </label>
                    <span className="text-[11px] text-slate-400 font-mono-code">
                      {query.length} / 2000 chars
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={2000}
                    placeholder="E.g., What are the deployment prerequisites and microservice architecture tiers?"
                    className="w-full bg-[#090d16] border border-slate-800 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400 font-mono-code">
                    <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 text-[10px]">Ctrl+Enter</kbd> to analyze</span>
                  </div>
                </div>

                {/* Quick Prompt Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 font-medium self-center mr-1">
                    Suggestions:
                  </span>
                  {[
                    "Summarize architecture requirements",
                    "What are the health check endpoints?",
                    "Analyze database schema & Redis caching",
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuery(preset)}
                      className="text-[11px] bg-slate-900/80 hover:bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isAnalyzing || !query.trim()}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-medium text-xs sm:text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-sm cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Context & Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Execute AI Analysis</span>
                    </>
                  )}
                </button>
              </form>

              {analysisError && (
                <div className="mt-3.5 p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs text-rose-300 flex items-center space-x-2">
                  <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Output & Live Execution Console */}
          <div className="lg:col-span-6 space-y-6 flex flex-col">
            {/* AI Analysis Result Card */}
            <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-xl p-5 shadow-lg shadow-black/20 backdrop-blur-sm flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
                      Analysis Inference Output
                    </h2>
                    <p className="text-xs text-slate-400">
                      RAG Contextual Synthesis
                    </p>
                  </div>
                </div>

                {analysisResult && (
                  <div className="flex items-center space-x-2 font-mono-code text-[11px]">
                    {analysisResult.cached ? (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center space-x-1 font-medium">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>REDIS CACHED</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center space-x-1 font-medium">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>LIVE COMPUTED</span>
                      </span>
                    )}

                    <button
                      onClick={copyAnalysisToClipboard}
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
                      title="Copy response"
                    >
                      {copiedResult ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Analysis Result Output Body */}
              {analysisResult ? (
                <div className="space-y-3.5 flex-1 flex flex-col">
                  {/* Telemetry Chips */}
                  <div className="flex flex-wrap gap-3 text-xs font-mono-code bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <span>Model:</span>
                      <span className="text-slate-200 font-medium">{analysisResult.model_used}</span>
                    </div>
                    <span className="text-slate-700">|</span>
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <span>Latency:</span>
                      <span className="text-emerald-400 font-medium">{analysisResult.latency_ms} ms</span>
                    </div>
                    <span className="text-slate-700">|</span>
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <span>Tokens:</span>
                      <span className="text-indigo-300 font-medium">{analysisResult.tokens_used}</span>
                    </div>
                  </div>

                  {/* Sanitized Text Content Container */}
                  <div className="bg-[#090d16] border border-slate-800/90 rounded-lg p-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line max-h-72 overflow-y-auto flex-1">
                    {analysisResult.response}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 border border-slate-800/80 rounded-xl bg-slate-900/20 text-slate-400 flex-1 flex flex-col items-center justify-center">
                  <FileText className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-300">No Inference Generated</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                    Select a document, formulate a prompt or query, and run analysis to view the synthesized RAG output and performance metrics.
                  </p>
                </div>
              )}
            </div>

            {/* Live Microservice Telemetry Console */}
            <div className="flex-1">
              <AIConsole logs={logs} onClearLogs={() => setLogs([])} />
            </div>
          </div>
        </div>
      </main>

      {/* Enterprise Platform Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0f172a]/60 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-mono-code gap-2">
          <div>
            SmartDoc AI Platform &copy; {new Date().getFullYear()} — Enterprise DevOps CI/CD & Cloud Orchestration
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>FastAPI 1.0</span>
            <span>Next.js 14 Standalone</span>
            <span>PostgreSQL 15</span>
            <span>Redis 7</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
