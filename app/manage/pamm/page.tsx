import { supabase } from "@/lib/supabase/server";
import PammMasterClient from "./pamm-master-client";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";

export default async function ManagePammPage() {
  const { data: rows } = await supabase
    .from("pamm_master")
    .select("*")
    .order("id");
  return (
    <div>
      <AdminPageHeader
        title="Investment accounts"
        description="Manage investment account records (one per client). Click a cell to edit, or add a new row."
      />
      <AdminCard>
        <PammMasterClient initialRows={rows || []} />
      </AdminCard>
    </div>
  );
}
