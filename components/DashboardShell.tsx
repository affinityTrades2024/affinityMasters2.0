"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";

interface DashboardShellProps {
  children: React.ReactNode;
  profileName: string;
  profileEmail: string;
  isAdmin: boolean;
}

export default function DashboardShell({
  children,
  profileName,
  profileEmail,
  isAdmin,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleCloseSidebar = () => setSidebarOpen(false);
  const handleToggleSidebar = () => setSidebarOpen((open) => !open);

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar isAdmin={isAdmin} open={sidebarOpen} onClose={handleCloseSidebar} />
      <div className="pl-0 lg:pl-64">
        <AppHeader
          profileName={profileName}
          profileEmail={profileEmail}
          onMenuToggle={handleToggleSidebar}
        />
        <main className="min-h-[calc(100vh-4rem)] p-4 md:p-6">
          {children}
        </main>
        <footer className="border-t border-gray-200 bg-white px-6 py-3 text-center text-sm text-gray-500">
          <strong>Copyright &copy; 2014-2025 Affinity Trades.</strong> All rights reserved.
        </footer>
      </div>
    </div>
  );
}

