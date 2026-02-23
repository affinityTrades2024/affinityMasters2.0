"use client";

import { useState } from "react";

export default function ProfileUpdateForm({
  currentNickname,
  clientId,
}: {
  currentNickname: string;
  clientId: number;
}) {
  const [nickname, setNickname] = useState(currentNickname);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile/update-nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, nickname: nickname.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Update failed" });
        return;
      }
      setMessage({ type: "success", text: "Nickname updated." });
    } catch {
      setMessage({ type: "error", text: "Update failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-gray-500 mb-2">Update nickname</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="nickname" className="sr-only">
            Nickname
          </label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {message && (
        <p
          className={
            message.type === "success"
              ? "mt-2 text-sm text-green-600"
              : "mt-2 text-sm text-red-600"
          }
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
