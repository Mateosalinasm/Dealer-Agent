"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Calculator, Car, ClipboardList, Gavel, Home, Kanban, Landmark, Megaphone, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  items: NavItem[];
}

// One rail icon per section — click opens a flyout with that section's
// links, like DealerCenter's sidebar. Kept flat (no third nesting level):
// every group here already has few enough items that a flyout list reads
// fine without its own sub-groups.
const NAV: NavGroup[] = [
  {
    label: "Deals",
    icon: Kanban,
    items: [
      { label: "Working", href: "/desk/deals?tab=working" },
      { label: "In funding", href: "/desk/deals?tab=funding" },
      { label: "Booked", href: "/desk/deals?tab=booked" },
      { label: "Funded", href: "/desk/deals?tab=funded" },
      { label: "Archived", href: "/desk/deals?tab=archived" },
    ],
  },
  {
    label: "Inventory",
    icon: Car,
    items: [{ label: "Inventory", href: "/inventory" }],
  },
  {
    label: "Sourcing",
    icon: Gavel,
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
    icon: ClipboardList,
    items: [
      { label: "Priority queue", href: "/desk/priority-queue" },
      { label: "Tasks", href: "/desk/tasks" },
      { label: "Messages", href: "/messages" },
      { label: "Analytics", href: "/desk/analytics" },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    items: [
      { label: "Marketing", href: "/marketing" },
      { label: "Leads", href: "/leads" },
    ],
  },
  {
    label: "Tools",
    icon: Calculator,
    items: [
      { label: "PTI calculator", href: "/pti-calculator" },
      { label: "Out-of-state calculator", href: "/out-of-state-calculator" },
    ],
  },
  {
    label: "Lenders",
    icon: Landmark,
    items: [
      { label: "All lenders", href: "/lenders" },
      { label: "Warranty & F&I products", href: "/warranty" },
    ],
  },
];

function navLinkClasses(active: boolean) {
  return cn(
    "rounded-[var(--radius-panel)] px-2.5 py-1.5 text-[13.5px] font-medium text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]",
    active && "bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
  );
}

function railButtonClasses(active: boolean) {
  return cn(
    "relative flex h-11 w-11 flex-none items-center justify-center rounded-[var(--radius-panel)] text-[var(--color-text-muted)] transition-colors after:absolute after:-inset-1 after:content-['']",
    active ? "bg-[var(--color-info-bg)] text-[var(--color-info-text)]" : "hover:bg-[var(--color-fill-subtle)] hover:text-[var(--color-text)]",
  );
}

// Reads the query string to highlight the active Deals tab, so it needs a
// Suspense boundary — this renders inside the root layout on every route,
// and without one Next.js can't statically prerender any page (e.g. 404).
function RailNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const activeGroupLabel = NAV.find((g) => g.items.some((i) => i.href.split("?")[0] === pathname))?.label ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  // Close the flyout on outside click / Escape — same dismissal pattern as
  // the app's dialogs, just without Radix since this isn't a modal.
  useEffect(() => {
    if (!openGroup) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    function onPointerDown(e: PointerEvent) {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openGroup]);

  return (
    <div ref={railRef} className="flex flex-col items-center gap-1 pt-1">
      {NAV.map((group) => {
        const Icon = group.icon;
        const isActiveGroup = group.label === activeGroupLabel;
        const isOpen = group.label === openGroup;
        return (
          // Each button gets its own positioning context so its flyout opens
          // right next to IT — previously the flyout was absolutely
          // positioned against the whole rail's wrapper (top:0 of the
          // stack), so it always appeared level with the first icon
          // (Deals) no matter which button was actually clicked.
          <div key={group.label} className="relative">
            <button
              type="button"
              title={group.label}
              aria-expanded={isOpen}
              onClick={() => setOpenGroup((prev) => (prev === group.label ? null : group.label))}
              className={railButtonClasses(isActiveGroup || isOpen)}
            >
              <Icon size={19} />
            </button>

            {isOpen && (
              <div className="absolute left-full top-0 z-30 ml-2 w-60 rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-card)] [animation:dialog-content-in_150ms_cubic-bezier(0.16,1,0.3,1)]">
                <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setOpenGroup(null)} className={navLinkClasses(currentPath === item.href)}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RailNavFallback() {
  return (
    <div className="flex flex-col items-center gap-1 pt-1">
      {NAV.map((group) => {
        const Icon = group.icon;
        return (
          <div key={group.label} title={group.label} className={railButtonClasses(false)}>
            <Icon size={19} />
          </div>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // "New deal" belongs to the board you create deals from, not every
  // screen in the app.
  const showNewDeal = pathname === "/desk/deals";

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-16 flex-none flex-col items-center border-r border-[var(--color-hairline)] bg-[var(--color-surface)] py-3">
        <Link
          href="/"
          title="Home"
          className={railButtonClasses(pathname === "/")}
        >
          <Home size={20} />
        </Link>

        <div className="my-2 h-px w-6 flex-none bg-[var(--color-hairline)]" />

        <nav className="min-h-0 flex-1 overflow-visible">
          <Suspense fallback={<RailNavFallback />}>
            <RailNav />
          </Suspense>
        </nav>

        <div className="my-2 h-px w-6 flex-none bg-[var(--color-hairline)]" />

        <Link href="/settings" title="Settings" className={railButtonClasses(pathname === "/settings")}>
          <Settings size={20} />
        </Link>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-header-rule)] bg-[var(--color-surface)] px-5 py-3">
          <span className="text-[13.5px] font-semibold tracking-tight">Dealer Agent</span>
          {showNewDeal && (
            <Link href="/desk/deals/new" className="ml-auto">
              <Button type="button">New deal</Button>
            </Link>
          )}
        </header>
        <main className="flex-1 bg-[var(--color-fill-subtle)] px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
