"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-stone-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-[220px] min-h-screen">
        {/* Mobile header bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white border-b border-stone-200 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-500 hover:bg-stone-100 transition-colors"
          >
            <Menu size={17} />
          </button>
          <span
            className="text-[13px] font-semibold"
            style={{ letterSpacing: "-0.02em", color: "#415445" }}
          >
            IT Asset Desk
          </span>
        </div>

        {children}
      </main>
    </div>
  );
}
