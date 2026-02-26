"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Profile } from "@/lib/profile";
import ProfileUpdateForm from "./profile-update-form";
import BankAccountsTab from "./bank-accounts-tab";
import VerificationTab from "./verification-tab";
import SecurityTab from "./security-tab";

const TABS = [
  { id: "info", label: "Info" },
  { id: "bank", label: "Bank Accounts" },
  { id: "verification", label: "Verification" },
  { id: "security", label: "Security" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function isValidTab(t: string): t is TabId {
  return TABS.some((tab) => tab.id === t);
}

export default function ProfileTabs({ profile }: { profile: Profile }) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const currentTab: TabId = isValidTab(tab || "") ? tab as TabId : "info";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <nav className="border-b border-gray-200 overflow-x-auto">
        <ul className="flex flex-nowrap gap-4 min-w-max px-1">
          {TABS.map(({ id, label }) => (
            <li key={id}>
              <Link
                href={`/profile?tab=${id}`}
                className={`inline-block border-b-2 px-1 py-3 text-sm font-medium ${
                  currentTab === id
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-md">
        {currentTab === "info" && (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-medium text-gray-500 mb-2">Profile info</h2>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium text-gray-900">{profile.email}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium text-gray-900">
                    {[profile.info.givenName, profile.info.familyName].filter(Boolean).join(" ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="font-medium text-gray-900">{profile.nickname || "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium text-gray-900">{profile.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Country</dt>
                  <dd className="font-medium text-gray-900">{profile.country_code || "—"}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Birthday</dt>
                  <dd className="font-medium text-gray-900">{profile.info.birthday || "—"}</dd>
                </div>
              </dl>
            </section>
            <ProfileUpdateForm
              currentNickname={profile.nickname || ""}
              clientId={profile.id}
            />
          </div>
        )}
        {currentTab === "bank" && <BankAccountsTab />}
        {currentTab === "verification" && <VerificationTab />}
        {currentTab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}
