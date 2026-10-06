"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, Trash2, Activity, Copy, Check, Filter } from "lucide-react";

export default function AIConsole({ logs = [], onClearLogs }) {
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
        return <span className="text-sky-400 font-semibold">[INFO]</span>;
      case "METRIC":
        return <span className="text-emerald-400 font-semibold">[METRIC]</span>;
      case "WARN":
        return <span className="text-amber-400 font-semibold">[WARN]</span>;
      case "ERROR":
        return <span className="text-rose-400 font-semibold">[ERROR]</span>;
      default:
        return <span className="text-slate-400">[{level}]</span>;
    }
  };

  const getSourceBadge = (source) => {
    const colors = {
      FastAPI: "text-blue-400",
      PostgreSQL: "text-indigo-400",
      Redis: "text-rose-400",
      OpenAI: "text-emerald-400",
      "Mock-AI": "text-purple-400",
      Prometheus: "text-amber-400",
      NextJS: "text-teal-400",
    };
    return (
      <span className={`font-medium ${colors[source] || "text-slate-400"}`}>
        [{source}]
      </span>
    );
  };

  return (
    <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-xl shadow-lg shadow-black/20 flex flex-col h-full overflow-hidden backdrop-blur-sm">
      {/* Console Header */}
      <div className="bg-slate-900/60 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-mono-code font-semibold tracking-wider text-slate-200">
            MICROSERVICE LIVE TELEMETRY
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Level Filter Tabs */}
          <div className="flex rounded-md bg-slate-950/80 p-0.5 border border-slate-800 text-[10px] font-mono-code">
            {["ALL", "INFO", "METRIC", "ERROR"].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`px-2 py-0.5 rounded transition-all ${
                  filter === lvl
                    ? "bg-slate-800 text-slate-100 font-semibold shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <button
            onClick={copyToClipboard}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded transition-colors"
            title="Copy logs to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
            title="Clear console"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Stream Body */}
      <div className="p-4 font-mono-code text-[11px] leading-relaxed overflow-y-auto flex-1 bg-[#090d16]/95 space-y-2 min-h-[260px] max-h-[360px]">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 italic py-10 text-center text-xs">
            Awaiting microservice RPC events... Ingest a document or execute a query to view live traces.
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div key={idx} className="flex items-start space-x-2 border-b border-slate-900/40 pb-1.5">
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

      {/* Console Status Bar */}
      <div className="bg-slate-900/50 px-4 py-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono-code">
        <div className="flex items-center space-x-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span>Prometheus Scrape: Active</span>
        </div>
        <div>
          <span>{filteredLogs.length} events logged</span>
        </div>
      </div>
    </div>
  );
}
