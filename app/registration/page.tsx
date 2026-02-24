import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import RegistrationFormClient from "./registration-form-client";

export default async function RegistrationPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return <RegistrationFormClient />;
}
