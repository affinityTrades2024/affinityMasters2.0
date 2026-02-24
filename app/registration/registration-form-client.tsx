"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BiEnvelope,
  BiLock,
  BiShow,
  BiHide,
  BiUser,
  BiPhone,
  BiCalendar,
  BiGlobe,
} from "react-icons/bi";

const inputClass =
  "min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-gray-900 placeholder-gray-400 focus:ring-0";
const inputWrapClass =
  "flex rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500";
const iconClass = "flex items-center px-3 text-gray-400 bg-gray-50 border-l border-gray-200";

const COUNTRY_CODES = [
  { code: "+91", name: "India" },
  { code: "+1", name: "United States" },
  { code: "+44", name: "United Kingdom" },
  { code: "+61", name: "Australia" },
  { code: "+81", name: "Japan" },
  { code: "+49", name: "Germany" },
  { code: "+33", name: "France" },
  { code: "+971", name: "UAE" },
  { code: "+65", name: "Singapore" },
  { code: "+86", name: "China" },
  { code: "+55", name: "Brazil" },
  { code: "+27", name: "South Africa" },
  { code: "+31", name: "Netherlands" },
  { code: "+34", name: "Spain" },
  { code: "+39", name: "Italy" },
  { code: "+82", name: "South Korea" },
  { code: "+60", name: "Malaysia" },
  { code: "+64", name: "New Zealand" },
  { code: "+353", name: "Ireland" },
  { code: "+358", name: "Finland" },
];

const COUNTRIES = [
  "India", "United States", "United Kingdom", "Australia", "Canada", "Germany", "France",
  "UAE", "Singapore", "Japan", "China", "Brazil", "South Africa", "Netherlands", "Spain",
  "Italy", "South Korea", "Malaysia", "New Zealand", "Ireland", "Finland", "Sweden",
  "Switzerland", "Hong Kong", "Saudi Arabia", "Other",
];

const PASSWORD_SPECIAL_HINT = "1 special character: !@#$%^&*()-_}{.+|/\\";

function suggestNicknameFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 64);
}

export default function RegistrationFormClient() {
  const router = useRouter();
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [birthday, setBirthday] = useState("");
  const [country, setCountry] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fullName = [givenName, familyName].filter(Boolean).join(" ");

  const checkNickname = useCallback(async (name: string, nick: string) => {
    const toCheck = nick.trim() || suggestNicknameFromName(name);
    if (!toCheck) {
      setNicknameAvailable(null);
      return;
    }
    setNicknameChecking(true);
    setNicknameAvailable(null);
    try {
      const params = new URLSearchParams({ name, nickname: toCheck });
      const res = await fetch(`/api/registration/check-nickname?${params}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.suggested !== undefined) {
        setNicknameAvailable(data.available === true);
      }
    } finally {
      setNicknameChecking(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      checkNickname(fullName, nickname);
    }, 400);
    return () => clearTimeout(t);
  }, [fullName, nickname, checkNickname]);

  useEffect(() => {
    if (!nickname.trim() && fullName) {
      const suggested = suggestNicknameFromName(fullName);
      if (suggested) setNickname(suggested);
    }
  }, [fullName]);

  const has8Chars = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = new RegExp("[!@#$%^&*()\\-_}{.+|/\\\\]").test(password);
  const passwordsMatch = password && password === confirmPassword;
  const passwordValid = has8Chars && hasUpper && hasLower && hasNumber && hasSpecial;

  const canSubmit =
    givenName.trim() &&
    email.trim() &&
    passwordValid &&
    passwordsMatch &&
    nickname.trim() &&
    nicknameAvailable === true &&
    birthday &&
    country.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const phone = phoneNumber.trim()
        ? `${phoneCountryCode.replace(/\s/g, "")}${phoneNumber.trim()}`
        : "";
      const res = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          givenName: givenName.trim(),
          familyName: familyName.trim(),
          phone,
          country: country.trim(),
          birthday: birthday || null,
          nickname: nickname.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }
      router.push("/auth/login?registered=1");
      router.refresh();
    } catch {
      setError("Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="text-gray-500 mt-1">Create your account</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
          <p className="text-center text-gray-600 mb-6">Enter your details below</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className={inputWrapClass}>
                <input
                  type="text"
                  value={givenName}
                  onChange={(e) => setGivenName(e.target.value)}
                  required
                  placeholder="First name"
                  className={inputClass}
                  autoComplete="given-name"
                />
                <span className={iconClass}>
                  <BiUser className="h-5 w-5" />
                </span>
              </div>
              <div className={inputWrapClass}>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="Last name"
                  className={inputClass}
                  autoComplete="family-name"
                />
                <span className={iconClass}>
                  <BiUser className="h-5 w-5" />
                </span>
              </div>
            </div>

            <div className={inputWrapClass}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email"
                className={inputClass}
                autoComplete="email"
              />
              <span className={iconClass}>
                <BiEnvelope className="h-5 w-5" />
              </span>
            </div>

            <div className={inputWrapClass}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Password"
                className={inputClass}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className={`${iconClass} hover:bg-gray-100`}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <BiHide className="h-5 w-5" /> : <BiLock className="h-5 w-5" />}
              </button>
            </div>
            <ul className="text-xs text-gray-500 space-y-0.5 ml-1">
              <li className={has8Chars ? "text-green-600" : ""}>8 characters</li>
              <li className={hasUpper ? "text-green-600" : ""}>1 upper-case letter</li>
              <li className={hasLower ? "text-green-600" : ""}>1 lower-case letter</li>
              <li className={hasNumber ? "text-green-600" : ""}>1 number</li>
              <li className={hasSpecial ? "text-green-600" : ""}>{PASSWORD_SPECIAL_HINT}</li>
            </ul>

            <div className={inputWrapClass}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm password"
                className={inputClass}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((p) => !p)}
                className={`${iconClass} hover:bg-gray-100`}
                aria-label={showConfirmPassword ? "Hide" : "Show"}
              >
                {showConfirmPassword ? <BiHide className="h-5 w-5" /> : <BiShow className="h-5 w-5" />}
              </button>
            </div>
            {confirmPassword && !passwordsMatch && (
              <p className="text-sm text-red-600">Passwords do not match</p>
            )}

            <div className="flex gap-2">
              <select
                value={phoneCountryCode}
                onChange={(e) => setPhoneCountryCode(e.target.value)}
                className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-32"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.name}
                  </option>
                ))}
              </select>
              <div className={`flex-1 ${inputWrapClass}`}>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                  placeholder="Mobile number"
                  className={inputClass}
                  autoComplete="tel-national"
                />
                <span className={iconClass}>
                  <BiPhone className="h-5 w-5" />
                </span>
              </div>
            </div>

            <div className={inputWrapClass}>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                required
                placeholder="Date of birth"
                className={inputClass}
                autoComplete="bday"
              />
              <span className={iconClass}>
                <BiCalendar className="h-5 w-5" />
              </span>
            </div>

            <div>
              <label htmlFor="country" className="sr-only">Country</label>
              <select
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="flex items-center gap-1 mt-1 text-gray-400">
                <BiGlobe className="h-4 w-4" />
                <span className="text-sm">Country of residence</span>
              </span>
            </div>

            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                Nickname (unique; you can change it later)
              </label>
              <div className={inputWrapClass}>
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  placeholder="e.g. john_doe"
                  className={inputClass}
                  autoComplete="username"
                />
                <span className="flex items-center px-3 text-gray-400 bg-gray-50 border-l border-gray-200">
                  {nicknameChecking ? (
                    <span className="text-xs text-gray-500">Checking…</span>
                  ) : nicknameAvailable === true ? (
                    <span className="text-xs text-green-600">Available</span>
                  ) : nickname.trim() && nicknameAvailable === false ? (
                    <span className="text-xs text-red-600">Taken</span>
                  ) : null}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Creating account…" : "Register"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
