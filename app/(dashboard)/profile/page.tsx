import { getSession } from "@/lib/auth";
import { getProfileByEmail } from "@/lib/profile";
import { redirect } from "next/navigation";
import ProfileUpdateForm from "./profile-update-form";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  const profile = await getProfileByEmail(session.email);
  if (!profile) redirect("/auth/login");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-md">
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
        <section>
          <h2 className="text-sm font-medium text-gray-500 mb-2">Verification</h2>
          <p className="text-sm text-gray-600">Verification and document upload are being upgraded.</p>
        </section>
      </div>
    </div>
  );
}
