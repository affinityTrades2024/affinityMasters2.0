"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BiBell } from "react-icons/bi";

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

async function fetchNotifications(): Promise<{ notifications: NotificationItem[]; unread: number }> {
  const res = await fetch("/api/notifications");
  if (!res.ok) throw new Error("Failed to fetch notifications");
  const data = await res.json();
  return {
    notifications: data.notifications ?? [],
    unread: data.unread ?? 0,
  };
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { notifications: list, unread: count } = await fetchNotifications();
      setNotifications(list);
      setUnread(count);
    } catch {
      setNotifications([]);
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadList = notifications.filter((n) => n.readAt == null);

  async function markRead(id: number) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } catch {
      await load();
    }
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readAll: true }),
      });
      await load();
      setOpen(false);
    } catch {
      await load();
    } finally {
      setLoading(false);
    }
  }

  function handleClick(id: number, link: string) {
    markRead(id);
    setOpen(false);
    router.push(link);
  }

  function formatTime(createdAt: string) {
    try {
      const d = new Date(createdAt);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  }

  function formatPayloadSubline(n: NotificationItem): string {
    if (n.body) return n.body;
    const p = n.payload;
    if (!p) return "";
    if (p.transactionId != null && p.amount != null) return `Tx #${p.transactionId} · $${Number(p.amount).toFixed(2)}`;
    if (p.transactionId != null) return `Tx #${p.transactionId}`;
    if (p.amount != null && p.date != null) return `$${Number(p.amount).toFixed(2)} · ${String(p.date)}`;
    if (p.amount != null) return `$${Number(p.amount).toFixed(2)}`;
    if (p.date != null) return String(p.date);
    return "";
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BiBell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 min-w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-medium text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 max-h-96 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unreadList.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={loading}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                Read All
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {unreadList.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">No new notifications</p>
            ) : (
              <ul className="py-1">
                {unreadList.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n.id, n.link)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      {formatPayloadSubline(n) ? (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{formatPayloadSubline(n)}</p>
                      ) : null}
                      <p className="text-xs text-gray-400 mt-1">{formatTime(n.createdAt)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
