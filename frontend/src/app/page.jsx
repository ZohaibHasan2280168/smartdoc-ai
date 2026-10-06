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
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return `${window.location.protocol}//${hostname}:8000`;
      }
      if (hostname.includes("elb.amazonaws.com")) {
        return "";
      }
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
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchDocuments]);

  // Security: Client-side input validation and execution
  const handleAnalyze = async (e) => {
    e?.preventDefault();
    const sanitizedQuery = query.trim();

    if (!sanitizedQuery) return;

    if (sanitizedQuery.length > 2000) {
      setAnalysisError("Query exceeds the maximum allowed limit of 2,000 characters.");
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
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-300 bg-white sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Platform Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-xs text-white">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-base font-bold tracking-tight text-slate-900">SmartDoc AI</h1>
                <span className="text-[11px] font-mono-code px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
                  v4.5 • S3 Storage
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block font-medium">
                Enterprise 3-Tier Document Intelligence & Telemetry
              </p>
            </div>
          </div>

          {/* Microservices Status Telemetry Badges */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex items-center space-x-3 bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono-code font-medium">
              {/* PostgreSQL Status */}
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${health?.dependencies?.database?.status === "connected" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                <span className="text-slate-700">Postgres</span>
              </div>

              <span className="text-slate-300">|</span>

              {/* Redis Status */}
              <div className="flex items-center space-x-1.5">
                <span className={`w-2 h-2 rounded-full ${health?.dependencies?.cache?.status === "connected" ? "bg-emerald-500" : "bg-rose-500"}`}></span>
                <span className="text-slate-700">Redis</span>
              </div>
            </div>

            {/* Overall Health Pill */}
            <button
              onClick={fetchHealth}
              disabled={healthLoading}
              className="flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono-code transition-colors cursor-pointer font-medium"
              title="Click to re-probe health"
            >
              {health?.status === "healthy" ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="capitalize font-semibold text-slate-800">
                {health?.status || "Checking..."}
              </span>
              <RefreshCw className={`w-3 h-3 text-slate-500 ${healthLoading ? "animate-spin text-indigo-600" : ""}`} />
            </button>

            {/* Swagger & Prometheus Links */}
            <a
              href={`${API_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-700 hover:text-indigo-600 transition font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300"
            >
              <span>API Docs</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href={`${API_BASE}/metrics`}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-700 hover:text-indigo-600 transition font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Metrics</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Architecture & Telemetry Summary Bar */}
        <div className="bg-slate-200/90 border border-slate-300 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700 border border-indigo-200">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Production 3-Tier Microservices Architecture
              </p>
              <p className="text-xs text-slate-600 font-medium">
                Next.js 14 Standalone &rarr; FastAPI Async AI Engine &rarr; Amazon RDS PostgreSQL 15 & Redis 7 Cache
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono-code font-semibold">
            <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-300 shadow-xs">
              Zero-Trust SG Chained
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-white text-slate-700 border border-slate-300 shadow-xs">
              S3 Direct Stream
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
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
            <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      Document Intelligence Studio
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Target: <span className="text-slate-800 font-semibold">{selectedDocumentName}</span>
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-mono-code px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
                  RAG Inference
                </span>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-4">
                {/* Inference Mode Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
                        className={`text-xs py-2 px-3 rounded-lg border font-semibold transition-all ${
                          analysisMode === mode.id
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                            : "bg-slate-50 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
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
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Query / Analysis Prompt
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono-code font-medium">
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
                    className="w-full bg-slate-50/70 border border-slate-300 rounded-lg p-3 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-colors leading-relaxed font-medium"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 font-mono-code">
                    <span>Press <kbd className="px-1.5 py-0.5 bg-slate-200 border border-slate-300 rounded text-slate-800 text-[10px] font-semibold">Ctrl+Enter</kbd> to analyze</span>
                  </div>
                </div>

                {/* Quick Prompt Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500 font-semibold self-center mr-1">
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
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-md border border-slate-300 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isAnalyzing || !query.trim()}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-semibold text-xs sm:text-sm rounded-lg flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer"
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
                <div className="mt-3.5 p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-center space-x-2 font-medium">
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: AI Output & Live Execution Console */}
          <div className="lg:col-span-6 space-y-6 flex flex-col">
            {/* AI Analysis Result Card */}
            <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                      Analysis Inference Output
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      RAG Contextual Synthesis
                    </p>
                  </div>
                </div>

                {analysisResult && (
                  <div className="flex items-center space-x-2 font-mono-code text-[11px]">
                    {analysisResult.cached ? (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 flex items-center space-x-1 font-bold">
                        <Flame className="w-3 h-3 text-amber-600" />
                        <span>REDIS CACHED</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center space-x-1 font-bold">
                        <Zap className="w-3 h-3 text-emerald-600" />
                        <span>LIVE COMPUTED</span>
                      </span>
                    )}

                    <button
                      onClick={copyAnalysisToClipboard}
                      className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"
                      title="Copy response"
                    >
                      {copiedResult ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Analysis Result Output Body */}
              {analysisResult ? (
                <div className="space-y-3.5 flex-1 flex flex-col">
                  {/* Telemetry Chips */}
                  <div className="flex flex-wrap gap-3 text-xs font-mono-code bg-slate-50 p-2.5 rounded-lg border border-slate-300">
                    <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
                      <span>Model:</span>
                      <span className="text-slate-900 font-semibold">{analysisResult.model_used}</span>
                    </div>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
                      <span>Latency:</span>
                      <span className="text-emerald-700 font-semibold">{analysisResult.latency_ms} ms</span>
                    </div>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center space-x-1.5 text-slate-600 font-medium">
                      <span>Tokens:</span>
                      <span className="text-indigo-700 font-semibold">{analysisResult.tokens_used}</span>
                    </div>
                  </div>

                  {/* Sanitized Text Content Container */}
                  <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 text-xs sm:text-sm text-slate-900 leading-relaxed font-sans whitespace-pre-line max-h-72 overflow-y-auto flex-1 font-medium">
                    {analysisResult.response}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 border border-slate-200 rounded-xl bg-slate-50 text-slate-600 flex-1 flex flex-col items-center justify-center">
                  <FileText className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-800">No Inference Generated</p>
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
      <footer className="border-t border-slate-300 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 font-mono-code gap-2">
          <div>
            SmartDoc AI Platform &copy; {new Date().getFullYear()} — Enterprise DevOps CI/CD & Cloud Orchestration
          </div>
          <div className="flex items-center space-x-4 text-slate-600 font-semibold">
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
