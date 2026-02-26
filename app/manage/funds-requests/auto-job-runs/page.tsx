import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCard from "@/components/admin/AdminCard";
import AutoJobRunsClient from "./auto-job-runs-client";

export default function AutoJobRunsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Auto Job Runs"
        description="History of cron job executions (daily interest and auto withdrawal). Shows success, failed, and skipped counts."
      />
      <AdminCard>
        <AutoJobRunsClient />
      </AdminCard>
    </div>
  );
}
