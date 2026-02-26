"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BiEnvelope, BiLock, BiShow, BiHide } from "react-icons/bi";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/images/square_logo.png"
            alt="Affinity Trades"
            className="h-16 w-16 mx-auto object-contain mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">Affinity Trades</h1>
          <p className="text-gray-500 mt-1">CRM</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
          <p className="text-center text-gray-600 mb-6">Sign in to start your session</p>
          {registered && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 mb-4">
              Registration successful. You can sign in now.
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-0"
                autoComplete="email"
              />
              <span className="flex items-center px-3 text-gray-400 bg-gray-50 border-l border-gray-200">
                <BiEnvelope className="h-5 w-5" />
              </span>
            </div>
            <div className="flex rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-0"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="flex items-center px-3 text-gray-400 hover:text-gray-600 bg-gray-50 border-l border-gray-200"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <BiHide className="h-5 w-5" /> : <BiShow className="h-5 w-5" />}
              </button>
            </div>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Remember Me
              </label>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </div>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            <a href="https://my.affinitytrades.com/en/auth/reset-password" className="text-blue-600 hover:underline">
              I forgot my password
            </a>
          </p>
          <p className="mt-2 text-center text-sm text-gray-500">
            <a href="/registration" className="text-blue-600 hover:underline">
              Register a new membership
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
