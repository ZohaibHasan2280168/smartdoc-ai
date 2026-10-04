"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  BarChart3
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

  // Live Console Logs
  const [logs, setLogs] = useState([
    {
      timestamp: new Date().toLocaleTimeString(),
      level: "INFO",
      source: "NextJS",
      message: "SmartDoc AI Dashboard initialized. Connecting to Tier 2 microservices..."
    }
  ]);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
      const data = await res.json();
      setHealth(data);
      addLog("INFO", "FastAPI", `Health probe OK: status=${data.status}, uptime=${data.uptime_seconds}s (${latency}ms)`);
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

  // Fetch Documents
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
    const interval = setInterval(fetchHealth, 30000); // 30s probe interval
    return () => clearInterval(interval);
  }, [fetchHealth, fetchDocuments]);

  // Execute AI Analysis
  const handleAnalyze = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    addLog("INFO", "FastAPI", `POST /api/v1/analyze initiated [doc_id=${selectedDocId || "none"}, mode=${analysisMode}]`);

    try {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/v1/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: selectedDocId,
          query: query.trim(),
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
      addLog("INFO", sourceTag, `Analysis completed: model=${data.model_used}, server_latency=${data.latency_ms}ms, cached=${data.cached}`);
      addLog("METRIC", "Prometheus", `Request total client latency: ${clientLatency}ms; tokens: ${data.tokens_used}`);
    } catch (err) {
      setAnalysisError(err.message);
      addLog("ERROR", "FastAPI", `Analysis error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === "healthy") return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === "degraded") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    return <XCircle className="w-4 h-4 text-rose-500" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold tracking-tight text-white">SmartDoc AI</h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Production Live V4 (GitHub Action)
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Automated Ingestion, RAG Inference & Microservice Telemetry
              </p>
            </div>
          </div>

          {/* Quick Health & Telemetry Badges */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">Postgres:</span>
              <span className={health?.dependencies?.database?.status === "connected" ? "text-emerald-400" : "text-rose-400"}>
                {health?.dependencies?.database?.status || "probing..."}
              </span>
              <span className="text-slate-700">|</span>
              <span className="text-slate-400">Redis:</span>
              <span className={health?.dependencies?.cache?.status === "connected" ? "text-emerald-400" : "text-rose-400"}>
                {health?.dependencies?.cache?.status || "probing..."}
              </span>
            </div>

            {/* Overall Health Pill */}
            <div
              onClick={fetchHealth}
              className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono cursor-pointer hover:border-slate-700 transition"
              title="Click to re-probe health"
            >
              {getStatusIcon(health?.status)}
              <span className="capitalize font-semibold text-slate-200">
                {health?.status || "Probing"}
              </span>
              {healthLoading && <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />}
            </div>

            {/* External Links to Swagger and Prometheus */}
            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center space-x-1 text-xs text-slate-400 hover:text-cyan-400 transition font-mono px-2 py-1 rounded bg-slate-900 border border-slate-800"
            >
              <span>Swagger</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={`${API_BASE}/metrics`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center space-x-1 text-xs text-slate-400 hover:text-emerald-400 transition font-mono px-2 py-1 rounded bg-slate-900 border border-slate-800"
            >
              <BarChart3 className="w-3 h-3" />
              <span>Metrics</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Architecture Pipeline Summary Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Production-Ready 3-Tier Architecture
              </p>
              <p className="text-xs text-slate-400">
                Tier 1 (Next.js) → Tier 2 (FastAPI Async + Fallback AI Engine) → Tier 3 (PostgreSQL 15 + Redis 7)
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-slate-800/80 text-slate-300 border border-slate-700">
              Docker Ready
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-800/80 text-slate-300 border border-slate-700">
              Prometheus Instrumented
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800">
              Deterministic Fallback OK
            </span>
          </div>
        </div>

        {/* 2-Column Application Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Document Upload & AI Prompt Form */}
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
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-semibold text-slate-100 tracking-wide">
                    Document Intelligence Query
                  </h2>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800 font-mono">
                  RAG Inference
                </span>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4">
                {/* Mode Selector */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">
                    ANALYSIS INFERENCE MODE
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "qa", label: "Q&A Insight" },
                      { id: "summary", label: "Summary" },
                      { id: "key_points", label: "Key Takeaways" },
                      { id: "technical", label: "DevOps Audit" },
                    ].map((mode) => (
                      <button
                        type="button"
                        key={mode.id}
                        onClick={() => setAnalysisMode(mode.id)}
                        className={`text-xs py-2 px-3 rounded-lg border font-medium transition-all ${analysisMode === mode.id
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm"
                          : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Query Text Area */}
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1.5">
                    QUERY / PROMPT
                  </label>
                  <textarea
                    rows={3}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="E.g., What are the deployment prerequisites and microservice tiers?"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition font-sans"
                  />
                </div>

                {/* Quick Prompt Suggestions */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-slate-500 font-mono self-center mr-1">
                    Quick queries:
                  </span>
                  {[
                    "Summarize architecture requirements",
                    "What are the health check endpoints?",
                    "Analyze database schema and caching layer",
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setQuery(preset)}
                      className="text-[11px] bg-slate-800/60 hover:bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700/60 transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isAnalyzing || !query.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-lg shadow-cyan-900/30"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Document Context...</span>
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
                <div className="mt-3 p-3 bg-red-950/40 border border-red-800 rounded-lg text-xs text-red-300">
                  {analysisError}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Output & Live Execution Console */}
          <div className="lg:col-span-6 space-y-6 flex flex-col">
            {/* AI Response Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-semibold text-slate-100 tracking-wide">
                    Analysis Inference Output
                  </h2>
                </div>

                {analysisResult && (
                  <div className="flex items-center space-x-2 font-mono text-[11px]">
                    {analysisResult.cached ? (
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center space-x-1">
                        <Flame className="w-3 h-3 text-rose-400" />
                        <span>REDIS CACHED</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>LIVE COMPUTED</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Analysis Result Content */}
              {analysisResult ? (
                <div className="space-y-4">
                  {/* Metadata Chips */}
                  <div className="flex flex-wrap gap-2 text-xs font-mono bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                    <div className="flex items-center space-x-1 text-slate-400">
                      <span>Model:</span>
                      <span className="text-cyan-300 font-semibold">{analysisResult.model_used}</span>
                    </div>
                    <span className="text-slate-700">|</span>
                    <div className="flex items-center space-x-1 text-slate-400">
                      <span>Latency:</span>
                      <span className="text-emerald-300">{analysisResult.latency_ms} ms</span>
                    </div>
                    <span className="text-slate-700">|</span>
                    <div className="flex items-center space-x-1 text-slate-400">
                      <span>Tokens:</span>
                      <span className="text-amber-300">{analysisResult.tokens_used}</span>
                    </div>
                  </div>

                  {/* Formatted Markdown Content */}
                  <div className="bg-slate-950 border border-slate-800/90 rounded-lg p-4 text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-line max-h-72 overflow-y-auto">
                    {analysisResult.response}
                  </div>
                </div>
              ) : (
                <div className="text-center py-14 border border-dashed border-slate-800 rounded-lg bg-slate-950/30">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-400">No Analysis Rendered Yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Select a document, formulate a query or prompt, and trigger analysis to review AI generation output and telemetry.
                  </p>
                </div>
              )}
            </div>

            {/* Live Microservice Execution Console */}
            <div className="flex-1">
              <AIConsole logs={logs} onClearLogs={() => setLogs([])} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-2">
          <div>
            SmartDoc AI Microservices Platform &copy; {new Date().getFullYear()} — Built for DevOps CI/CD & Cloud Orchestration
          </div>
          <div className="flex items-center space-x-4">
            <span>FastAPI v1.0.0</span>
            <span>Next.js 14 Standalone</span>
            <span>PostgreSQL 15</span>
            <span>Redis 7</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
