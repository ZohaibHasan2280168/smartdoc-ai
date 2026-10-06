"use client";

import React, { useState, useRef } from "react";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Loader2, 
  Database,
  FileCheck
} from "lucide-react";

export default function FileUpload({ 
  onDocumentSelect, 
  selectedDocId, 
  documents, 
  onRefreshDocs, 
  onLog 
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const getApiBase = () => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      // If accessed via public IP (e.g. EC2 server: 3.94.149.149):
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
        return `${window.location.protocol}//${hostname}:8000`;
      }
      // If on AWS ELB, relative path /api (proxied via Next.js rewrites):
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

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    onLog?.("INFO", "FastAPI", `Starting multipart ingestion for "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/v1/upload`, {
        method: "POST",
        body: formData,
      });

      const latency = Math.round(performance.now() - t0);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(errorData.detail || `Upload failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      onLog?.("INFO", "PostgreSQL", `Document stored in DB [id=${data.id}, size=${data.file_size_bytes}B, latency=${latency}ms]`);
      onLog?.("METRIC", "Prometheus", `POST /api/v1/upload responded 201 in ${latency}ms`);

      if (onRefreshDocs) await onRefreshDocs();
      if (onDocumentSelect) onDocumentSelect(data.id);
    } catch (err) {
      setUploadError(err.message);
      onLog?.("ERROR", "FastAPI", `Upload failure: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (e, docId, filename) => {
    e.stopPropagation();
    if (!confirm(`Delete document "${filename}"?`)) return;

    try {
      onLog?.("INFO", "FastAPI", `Dispatching DELETE /api/v1/documents/${docId}`);
      const res = await fetch(`${API_BASE}/api/v1/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        onLog?.("INFO", "PostgreSQL", `Cascaded record removal for document id=${docId}`);
        if (selectedDocId === docId && onDocumentSelect) {
          onDocumentSelect(null);
        }
        if (onRefreshDocs) onRefreshDocs();
      }
    } catch (err) {
      onLog?.("ERROR", "FastAPI", `Failed to delete doc ${docId}: ${err.message}`);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-slate-100 tracking-wide">
            Document Ingestion & Metadata
          </h2>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
          Tier 2 Service
        </span>
      </div>

      {/* Drag & Drop Upload Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-cyan-500 bg-cyan-950/20"
            : "border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-950/60"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.json,.csv,.log,.yaml,.yml"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          {isUploading ? (
            <>
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-sm text-slate-300 font-medium">
                Parsing & Ingesting Content...
              </p>
            </>
          ) : (
            <>
              <div className="p-3 bg-cyan-500/10 rounded-full text-cyan-400">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  <span className="text-cyan-400 underline decoration-cyan-500/40 underline-offset-2">
                    Click to browse
                  </span>{" "}
                  or drag and drop
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supported formats: PDF, TXT, MD, JSON, LOG, YAML (Max 20MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="mt-3 p-3 bg-red-950/40 border border-red-800 rounded-lg flex items-center space-x-2 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Uploaded Documents List */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
          <span>INGESTED REPOSITORY ({documents.length})</span>
          <span>SELECT FOR QUERY</span>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-6 border border-slate-800/60 rounded-lg bg-slate-950/30 text-slate-500 text-xs">
            No documents in repository yet. Ingest an architecture spec or log file above.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {documents.map((doc) => {
              const isSelected = selectedDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => onDocumentSelect(doc.id)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "bg-cyan-950/40 border-cyan-500/80 text-cyan-100 shadow-sm"
                      : "bg-slate-950/30 border-slate-800 text-slate-300 hover:bg-slate-800/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    {isSelected ? (
                      <FileCheck className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="font-medium truncate text-slate-200">
                        {doc.filename}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {(doc.file_size_bytes / 1024).toFixed(1)} KB • ID #{doc.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {isSelected && (
                      <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded text-[10px] font-mono border border-cyan-500/30">
                        ACTIVE
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, doc.id, doc.filename)}
                      className="p-1 hover:text-red-400 text-slate-500 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
