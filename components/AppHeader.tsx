"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { BiFullscreen, BiChevronDown, BiCog, BiLogOut } from "react-icons/bi";
import NotificationBell from "@/components/NotificationBell";

interface AppHeaderProps {
  profileName: string;
  profileEmail: string;
  onMenuToggle?: () => void;
}

export default function AppHeader({
  profileName,
  profileEmail,
  onMenuToggle,
}: AppHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm">
      <button
        type="button"
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <NotificationBell />
        <button
          type="button"
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Fullscreen"
        >
          <BiFullscreen className="h-5 w-5" />
        </button>
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-white">
              {profileName.slice(0, 2).toUpperCase()}
            </div>
            <span className="hidden text-sm font-medium text-gray-700 md:inline">
              {profileName}
            </span>
            <BiChevronDown className="h-4 w-4 text-gray-500" />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 bg-slate-700 px-4 py-3">
                <p className="truncate text-sm font-medium text-white">{profileEmail}</p>
              </div>
              <div className="border-b border-gray-100 px-2 py-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded px-2 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setDropdownOpen(false)}
                >
                  <BiCog className="h-4 w-4" />
                  Settings
                </Link>
              </div>
              <div className="p-2">
                <Link
                  href="/api/auth/logout"
                  className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setDropdownOpen(false)}
                >
                  <BiLogOut className="h-4 w-4" />
                  Sign out
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
