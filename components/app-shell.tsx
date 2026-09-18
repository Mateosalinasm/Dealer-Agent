"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Inventory",
    items: [{ label: "Inventory", href: "/inventory" }],
  },
  {
    label: "Sourcing",
    items: [
      { label: "Auction watch-list", href: "/sourcing/watch-list" },
      { label: "Run list", href: "/sourcing/run-list" },
      { label: "What to buy", href: "/sourcing/what-to-buy" },
      { label: "Buy scorecard", href: "/sourcing/buy-scorecard" },
      { label: "Auction day", href: "/sourcing/auction-day" },
      { label: "Sale ledger", href: "/sourcing/sale-ledger" },
    ],
  },
  {
    label: "Desk",
    items: [
      { label: "Priority queue", href: "/desk/priority-queue" },
      { label: "Appointments", href: "/desk/appointments" },
      { label: "Analytics", href: "/desk/analytics" },
    ],
  },
  {
    label: "Marketing & leads",
    items: [
      { label: "Marketing", href: "/marketing" },
      { label: "Leads", href: "/leads" },
    ],
  },
  {
    label: "Lenders",
    items: [{ label: "Lenders", href: "/lenders" }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-black/20"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 -translate-x-full border-r border-[var(--color-hairline)] bg-[var(--color-surface)] transition-transform duration-200 ease-out",
          open && "translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[13.5px] font-semibold tracking-tight text-[var(--color-text)]">
            Deal Desk
          </span>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="rounded-full p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-fill-subtle)]"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex flex-col gap-5 overflow-y-auto px-3 pb-6">
          {NAV.map((group) => (
            <div key={group.label}>
              <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-[var(--radius-panel)] px-2.5 py-1.5 text-[13.5px] font-medium text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]",
                        active && "bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-header-rule)] bg-[var(--color-surface)] px-5 py-3">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-full p-1.5 text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]"
          >
            <Menu size={20} />
          </button>
          <span className="text-[13.5px] font-semibold tracking-tight">Deal Desk</span>
        </header>
        <main className="flex-1 bg-[var(--color-fill-subtle)] px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
