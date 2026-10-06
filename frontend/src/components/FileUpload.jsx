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

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of 20 MB.`);
    }

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
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
              Document Knowledge Base
            </h2>
            <p className="text-xs text-slate-500">
              Tier 2 Ingestion & S3 Object Storage
            </p>
          </div>
        </div>
        <span className="text-[11px] font-mono-code px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          {documents.length} {documents.length === 1 ? "Doc" : "Docs"} Stored
        </span>
      </div>

      {/* Modern Light Mode Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-indigo-500 bg-indigo-50/50 scale-[0.99]"
            : "border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"
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
              <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Processing & Streaming to S3...
                </p>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Extracting text tokens & calculating embeddings
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-full bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-xs">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">
                  <span className="text-indigo-600 font-semibold hover:underline">
                    Upload a file
                  </span>{" "}
                  or drag and drop
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PDF, TXT, MD, JSON, LOG, YAML (Up to 20 MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {uploadError && (
        <div className="mt-3.5 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start justify-between text-rose-700 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
            <span>{uploadError}</span>
          </div>
          <button 
            onClick={() => setUploadError(null)}
            className="text-rose-500 hover:text-rose-700 p-0.5 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Document Search & Repository List */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
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
                className="w-full pl-8 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-7 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-500 text-xs">
            <FileText className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
            <p className="font-medium text-slate-700">No documents in repository</p>
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
                      ? "bg-indigo-50/80 border-indigo-300 text-slate-900 shadow-xs"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-2">
                    {isSelected ? (
                      <div className="w-7 h-7 rounded-md bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 flex-shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="truncate">
                      <p className="font-medium truncate text-slate-900">
                        {doc.filename}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono-code mt-0.5">
                        {(doc.file_size_bytes / 1024).toFixed(1)} KB • {doc.char_count?.toLocaleString() || 0} chars • #{doc.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {isSelected && (
                      <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[10px] font-mono-code border border-indigo-200 font-medium">
                        SELECTED
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, doc.id, doc.filename)}
                      className="p-1.5 hover:text-rose-600 text-slate-400 hover:bg-rose-50 rounded transition-colors"
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
