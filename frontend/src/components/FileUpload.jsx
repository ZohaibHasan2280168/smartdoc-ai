"use client";

import React, { useState, useRef, useMemo } from "react";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Loader2, 
  Database,
  FileCheck,
  Search,
  FileType,
  X
} from "lucide-react";

// Security Allowlist of supported file extensions
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".json", ".csv", ".log", ".yaml", ".yml"];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export default function FileUpload({ 
  onDocumentSelect, 
  selectedDocId, 
  documents = [], 
  onRefreshDocs, 
  onLog 
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef(null);

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

  // Security: File sanitization and validation
  const validateFile = (file) => {
    if (!file) throw new Error("No file selected.");

    // 1. File size check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of 20 MB.`);
    }

    // 2. Extension check
    const extension = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new Error(`Unsupported file type "${extension}". Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}`);
    }

    return true;
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploadError(null);

    try {
      // Validate file before network dispatch
      validateFile(file);
      setIsUploading(true);

      onLog?.("INFO", "FastAPI", `Initiating secure ingestion for "${file.name}" (${(file.size / 1024).toFixed(1)} KB)...`);

      const formData = new FormData();
      formData.append("file", file);

      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/api/v1/upload`, {
        method: "POST",
        body: formData,
      });

      const latency = Math.round(performance.now() - t0);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Ingestion failed" }));
        throw new Error(errorData.detail || `Upload failed with HTTP status ${res.status}`);
      }

      const data = await res.json();
      onLog?.("INFO", "PostgreSQL", `Document metadata committed to RDS [id=${data.id}, size=${data.file_size_bytes}B, latency=${latency}ms]`);
      onLog?.("METRIC", "Prometheus", `POST /api/v1/upload 201 Created in ${latency}ms`);

      if (onRefreshDocs) await onRefreshDocs();
      if (onDocumentSelect) onDocumentSelect(data.id);
    } catch (err) {
      setUploadError(err.message);
      onLog?.("ERROR", "FastAPI", `Ingestion failure: ${err.message}`);
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
    if (!confirm(`Are you sure you want to delete "${filename}"? This will remove its embeddings and S3 object.`)) return;

    try {
      onLog?.("INFO", "FastAPI", `Dispatching DELETE /api/v1/documents/${docId}`);
      const res = await fetch(`${API_BASE}/api/v1/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        onLog?.("INFO", "PostgreSQL", `Cascaded deletion completed for document ID #${docId}`);
        if (selectedDocId === docId && onDocumentSelect) {
          onDocumentSelect(null);
        }
        if (onRefreshDocs) onRefreshDocs();
      } else {
        throw new Error(`Delete failed with HTTP ${res.status}`);
      }
    } catch (err) {
      onLog?.("ERROR", "FastAPI", `Failed to delete document #${docId}: ${err.message}`);
    }
  };

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    return documents.filter((doc) =>
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  return (
    <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-xl p-5 shadow-lg shadow-black/20 backdrop-blur-sm">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100 tracking-tight">
              Document Knowledge Base
            </h2>
            <p className="text-xs text-slate-400">
              Tier 2 Ingestion & S3 Object Storage
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/80">
          {documents.length} {documents.length === 1 ? "Doc" : "Docs"} Stored
        </span>
      </div>

      {/* Modern Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-indigo-400 bg-indigo-950/20 scale-[0.99]"
            : "border-slate-700/90 hover:border-slate-600 bg-slate-900/40 hover:bg-slate-900/70"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-2.5">
          {isUploading ? (
            <>
              <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-200">
                  Processing & Streaming to S3...
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  Extracting text tokens & calculating embeddings
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 shadow-sm">
                <UploadCloud className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  <span className="text-indigo-400 font-semibold hover:underline">
                    Upload a file
                  </span>{" "}
                  or drag and drop
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  PDF, TXT, MD, JSON, LOG, YAML (Up to 20 MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {uploadError && (
        <div className="mt-3.5 p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg flex items-start justify-between text-rose-300 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            <span>{uploadError}</span>
          </div>
          <button 
            onClick={() => setUploadError(null)}
            className="text-rose-400 hover:text-rose-200 p-0.5 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Document Search & Repository List */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Repository Documents
          </span>
          {documents.length > 3 && (
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter files..."
                className="w-full pl-8 pr-2 py-1 text-xs bg-slate-900/70 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-7 border border-slate-800/80 rounded-xl bg-slate-900/20 text-slate-400 text-xs">
            <FileText className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
            <p className="font-medium text-slate-300">No documents in repository</p>
            <p className="text-slate-500 text-[11px] mt-0.5">Upload a specification, log file, or document above to begin analysis.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filteredDocuments.map((doc) => {
              const isSelected = selectedDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => onDocumentSelect(doc.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? "bg-indigo-950/40 border-indigo-500/60 text-slate-100 shadow-sm"
                      : "bg-slate-900/40 border-slate-800/70 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    {isSelected ? (
                      <div className="w-7 h-7 rounded-md bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="truncate">
                      <p className="font-medium truncate text-slate-200">
                        {doc.filename}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono-code mt-0.5">
                        {(doc.file_size_bytes / 1024).toFixed(1)} KB • {doc.char_count?.toLocaleString() || 0} chars • #{doc.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {isSelected && (
                      <span className="bg-indigo-500/15 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-mono-code border border-indigo-500/30 font-medium">
                        SELECTED
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, doc.id, doc.filename)}
                      className="p-1.5 hover:text-rose-400 text-slate-400 hover:bg-rose-500/10 rounded transition-colors"
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
