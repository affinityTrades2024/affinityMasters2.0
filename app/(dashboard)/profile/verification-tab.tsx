"use client";

import { useState, useEffect } from "react";

const DESCRIPTION_OPTIONS = [
  "PAN Card",
  "Aadhar Card",
  "Aadhar Card Front",
  "Aadhar Card Back",
  "Other",
] as const;

interface VerificationDoc {
  id: number;
  description: string;
  file_path: string;
  file_size_bytes: number;
  mime_type: string | null;
  created_at: string;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500";
const btnPrimary =
  "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50";

export default function VerificationTab() {
  const [documents, setDocuments] = useState<VerificationDoc[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [descriptionOption, setDescriptionOption] = useState<(typeof DESCRIPTION_OPTIONS)[number]>("PAN Card");
  const [descriptionOther, setDescriptionOther] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchDocuments() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/verification");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load documents");
        setDocuments([]);
        setTotalBytes(0);
        return;
      }
      setDocuments(data.documents || []);
      setTotalBytes(data.totalBytes ?? 0);
    } catch {
      setError("Failed to load documents");
      setDocuments([]);
      setTotalBytes(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  const description =
    descriptionOption === "Other" ? descriptionOther.trim() : descriptionOption;
  const usedMb = (totalBytes / 1024 / 1024).toFixed(2);
  const maxMb = (MAX_BYTES / 1024 / 1024).toFixed(0);
  const canUpload = totalBytes < MAX_BYTES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!description) {
      setMessage({
        type: "error",
        text: descriptionOption === "Other" ? "Enter a description for Other." : "Select a description.",
      });
      return;
    }
    if (!file || file.size === 0) {
      setMessage({ type: "error", text: "Choose a file." });
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/jpg", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setMessage({ type: "error", text: "Only PNG, JPG, and PDF are allowed." });
      return;
    }
    if (totalBytes + file.size > MAX_BYTES) {
      setMessage({
        type: "error",
        text: `Total size would exceed ${maxMb}MB limit.`,
      });
      return;
    }
    if (documents.some((d) => d.description === description)) {
      setMessage({ type: "error", text: "A document with this description already exists." });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("description", description);
      const res = await fetch("/api/profile/verification", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Upload failed." });
        return;
      }
      setMessage({ type: "success", text: "Document uploaded." });
      setFile(null);
      setDescriptionOption("PAN Card");
      setDescriptionOther("");
      fetchDocuments();
    } catch {
      setMessage({ type: "error", text: "Upload failed." });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this document?")) return;
    try {
      const res = await fetch(`/api/profile/verification/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error || "Failed to remove." });
        return;
      }
      setMessage({ type: "success", text: "Document removed." });
      fetchDocuments();
    } catch {
      setMessage({ type: "error", text: "Failed to remove." });
    }
  }

  function downloadUrl(id: number): string {
    return `/api/profile/verification/${id}/download`;
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Verification</h2>
        <p className="text-sm text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-medium text-gray-500">Verification documents</h2>
      <p className="text-sm text-gray-600">
        Upload PAN Card and Aadhar Card (and other documents if needed). Allowed: PNG, JPG, PDF. Total size per user: max {maxMb}MB.
      </p>

      <p className="text-sm font-medium text-slate-700">
        Storage: {usedMb} MB / {maxMb} MB
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <select
            value={descriptionOption}
            onChange={(e) => setDescriptionOption(e.target.value as (typeof DESCRIPTION_OPTIONS)[number])}
            className={inputClass}
          >
            {DESCRIPTION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {descriptionOption === "Other" && (
            <input
              type="text"
              value={descriptionOther}
              onChange={(e) => setDescriptionOther(e.target.value)}
              className={inputClass + " mt-2"}
              placeholder="Enter description"
            />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,image/jpg,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded file:border-0 file:bg-amber-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-amber-800 hover:file:bg-amber-100"
          />
        </div>
        {message && (
          <p
            className={
              message.type === "success"
                ? "text-sm text-green-600"
                : "text-sm text-red-600"
            }
          >
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !canUpload || !file}
          className={btnPrimary}
        >
          {submitting ? "Uploading…" : "Upload"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {documents.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-2">Uploaded documents</h3>
          <ul className="space-y-3">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <span className="font-medium text-slate-900">{doc.description}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  <span className="text-slate-600">
                    {(doc.file_size_bytes / 1024).toFixed(1)} KB
                  </span>
                  {doc.mime_type && (
                    <span className="ml-2 text-slate-500 text-xs">{doc.mime_type}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={downloadUrl(doc.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(doc.id)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">
        You must have at least one PAN Card and one Aadhar-related document (Aadhar Card, Front, or Back) for verification.
      </p>
    </div>
  );
}
