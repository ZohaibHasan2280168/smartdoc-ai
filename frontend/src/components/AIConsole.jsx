"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, Trash2, ShieldCheck, Activity, Copy, Check } from "lucide-react";

export default function AIConsole({ logs, onClearLogs }) {
  const [filter, setFilter] = useState("ALL");
  const [copied, setCopied] = useState(false);
  const consoleBottomRef = useRef(null);

  const filteredLogs = logs.filter((log) => {
    if (filter === "ALL") return true;
    return log.level === filter;
  });

  useEffect(() => {
    consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const copyToClipboard = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level) => {
    switch (level) {
      case "INFO":
        return <span className="text-cyan-400 font-bold">[INFO]</span>;
      case "METRIC":
        return <span className="text-emerald-400 font-bold">[METRIC]</span>;
      case "WARN":
        return <span className="text-amber-400 font-bold">[WARN]</span>;
      case "ERROR":
        return <span className="text-rose-400 font-bold">[ERROR]</span>;
      default:
        return <span className="text-slate-400">[{level}]</span>;
    }
  };

  const getSourceBadge = (source) => {
    const colors = {
      FastAPI: "text-blue-400",
      PostgreSQL: "text-indigo-300",
      Redis: "text-rose-300",
      OpenAI: "text-emerald-300",
      "Mock-AI": "text-purple-300",
      Prometheus: "text-amber-300",
      NextJS: "text-teal-300",
    };
    return (
      <span className={`font-semibold ${colors[source] || "text-slate-300"}`}>
        [{source}]
      </span>
    );
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl flex flex-col h-full overflow-hidden">
      {/* Console Header */}
      <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200">
            MICROSERVICE LIVE TRACE CONSOLE
          </span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Level Filter Tabs */}
          <div className="flex rounded bg-slate-950 p-0.5 border border-slate-800 text-[10px] font-mono">
            {["ALL", "INFO", "METRIC", "ERROR"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  filter === lvl
                    ? "bg-slate-800 text-cyan-300 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={copyToClipboard}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            title="Copy logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
            title="Clear console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Body */}
      <div className="p-4 font-mono text-[11px] leading-relaxed overflow-y-auto flex-1 bg-black/80 space-y-1.5 min-h-[280px] max-h-[380px]">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 italic py-8 text-center">
            System waiting for HTTP telemetry... Perform an upload or query to stream logs.
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div key={idx} className="flex items-start space-x-2 border-b border-slate-900/60 pb-1 font-mono">
              <span className="text-slate-500 select-none text-[10px] flex-shrink-0">
                {log.timestamp}
              </span>
              <span className="flex-shrink-0">{getLevelBadge(log.level)}</span>
              <span className="flex-shrink-0">{getSourceBadge(log.source)}</span>
              <span className="text-slate-300 break-all">{log.message}</span>
            </div>
          ))
        )}
        <div ref={consoleBottomRef} />
      </div>

      {/* Console Footer */}
      <div className="bg-slate-900/40 px-4 py-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <div className="flex items-center space-x-2">
          <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>PROMETHEUS HOOK: ACTIVE</span>
        </div>
        <div>
          <span>{filteredLogs.length} LOG EVENTS RECORDED</span>
        </div>
      </div>
    </div>
  );
}
