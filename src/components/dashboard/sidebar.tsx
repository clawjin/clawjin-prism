"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radio,
  Users,
  TrendingUp,
  Plug,
  CreditCard,
  Settings,
} from "lucide-react";
import { LogoMark } from "@/components/ui";
import { LogoutButton } from "@/components/logout-button";
import { initials } from "@/lib/format";

export interface SidebarUser {
  name: string;
  companyName: string;
  plan: string;
  email: string;
}

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/briefing", label: "Briefing", icon: Radio },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/cohorts", label: "Cohorts", icon: TrendingUp },
  { href: "/dashboard/connections", label: "Data sources", icon: Plug },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const PLAN_TONE: Record<string, string> = {
  trial: "bg-white/10 text-zinc-200 ring-white/20",
  pro: "bg-white/15 text-white ring-white/30",
  enterprise: "bg-white/10 text-zinc-200 ring-white/20",
};

export function Sidebar({
  user,
  unread,
}: {
  user: SidebarUser;
  unread: number;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/5 bg-[#0b0b0d]/70 backdrop-blur-2xl lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-5">
          <LogoMark className="h-8 w-8" />
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Clawjin <span className="text-gradient">Prism</span>
          </span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white ring-1 ring-inset ring-white/15"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-[18px] w-[18px] ${active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"}`}
                />
                <span className="flex-1">{item.label}</span>
                {item.href === "/dashboard/briefing" && unread > 0 && (
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-black">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-prism text-xs font-bold text-black">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-zinc-500">
                {user.companyName || user.email}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${PLAN_TONE[user.plan] ?? PLAN_TONE.trial}`}
            >
              {user.plan}
            </span>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0b0b0d]/70 backdrop-blur-2xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold text-white">
              Clawjin <span className="text-gradient">Prism</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${PLAN_TONE[user.plan] ?? PLAN_TONE.trial}`}
            >
              {user.plan}
            </span>
            <LogoutButton className="!text-zinc-400" />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white/10 text-white ring-1 ring-inset ring-white/15"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
