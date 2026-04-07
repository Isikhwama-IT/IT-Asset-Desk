"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  Users,
  Boxes,
  ChevronRight,
  LogOut,
  Shield,
  Eye,
  X,
  Settings,
  Inbox,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/app/login/actions";

const nav = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard, adminOnly: false },
  { href: "/assets",    label: "Assets",      icon: Monitor,         adminOnly: false },
  { href: "/people",    label: "People",       icon: Users,           adminOnly: false },
  { href: "/requests",  label: "Requests",     icon: Inbox,           adminOnly: true  },
  { href: "/audit",     label: "Audit Log",    icon: ClipboardList,   adminOnly: true  },
  { href: "/settings",  label: "Settings",     icon: Settings,        adminOnly: true  },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { name, email, role, isAdmin } = useAuth();
  const initials = name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen w-[220px] flex flex-col z-40 transition-transform duration-200",
        "md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
      style={{ background: "#415445" }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid #354839" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#C04F28" }}>
            <Boxes size={15} className="text-white" />
          </div>
          <div>
            <p className="text-white leading-tight" style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.03em" }}>IT Asset Desk</p>
            <p className="leading-tight" style={{ fontSize: 10, color: "#859474" }}>by ISIBAG</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-colors md:hidden"
            style={{ color: "#859474" }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-2 mb-3" style={{ fontSize: 10, fontWeight: 500, color: "#859474", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Navigation
        </p>
        {nav.filter(({ adminOnly }) => !adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "nav-active flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group",
              )}
              style={{
                background: active ? "#C04F28" : "transparent",
                color: active ? "#ffffff" : "#C9D9A0",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "#354839"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Icon
                size={15}
                style={{ color: active ? "#ffffff" : "#859474", flexShrink: 0 }}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.5)" }} />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid #354839" }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#C04F28" }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate leading-tight" style={{ fontSize: 12, fontWeight: 500, color: "#C9D9A0" }} title={name}>
              {name}
            </p>
            <p className="truncate leading-tight" style={{ fontSize: 10, color: "#859474" }} title={email}>
              {email}
            </p>
          </div>
          <span
            className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
            style={{
              fontSize: 9, fontWeight: 600,
              background: role === "admin" ? "#C04F28" : "#354839",
              color: role === "admin" ? "#fff" : "#859474",
            }}
          >
            {role === "admin" ? <Shield size={8} /> : <Eye size={8} />}
            {role}
          </span>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors"
            style={{ fontSize: 12.5, color: "#859474" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#354839"; (e.currentTarget as HTMLElement).style.color = "#C9D9A0"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#859474"; }}
          >
            <LogOut size={13} />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
