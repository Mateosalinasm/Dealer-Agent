"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Six top-level sections, each collapsed to its subcategories until opened
// — fewer things on screen at once than a flat, always-expanded list.
const NAV: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { label: "Working", href: "/desk/deals?tab=working" },
      { label: "In funding", href: "/desk/deals?tab=funding" },
      { label: "Booked", href: "/desk/deals?tab=booked" },
      { label: "Funded", href: "/desk/deals?tab=funded" },
      { label: "All this month", href: "/desk/deals?tab=all" },
      { label: "Archived", href: "/desk/deals?tab=archived" },
    ],
  },
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
      { label: "Tasks", href: "/desk/tasks" },
      { label: "Messages", href: "/messages" },
      { label: "Analytics", href: "/desk/analytics" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Marketing", href: "/marketing" },
      { label: "Leads", href: "/leads" },
    ],
  },
  {
    label: "Tools",
    items: [{ label: "Out-of-state calculator", href: "/out-of-state-calculator" }],
  },
  {
    label: "Lenders",
    items: [
      { label: "All lenders", href: "/lenders" },
      { label: "Warranty & F&I products", href: "/warranty" },
    ],
  },
];

// Not part of the six main sections — always visible, one line, no toggle.
const UTILITY_ITEMS: NavItem[] = [{ label: "Integrations", href: "/settings" }];

function navLinkClasses(active: boolean) {
  return cn(
    "rounded-[var(--radius-panel)] px-2.5 py-1.5 text-[13.5px] font-medium text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]",
    active && "bg-[var(--color-info-bg)] text-[var(--color-info-text)]",
  );
}

// Reads the query string to highlight the active Deals tab, so it needs a
// Suspense boundary — this renders inside the root layout on every route,
// and without one Next.js can't statically prerender any page (e.g. 404).
function NavLinks({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const activeGroup = NAV.find((g) => g.items.some((i) => i.href.split("?")[0] === pathname))?.label ?? NAV[0].label;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set([activeGroup]));

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <>
      {NAV.map((group) => {
        const isOpen = openGroups.has(group.label);
        return (
          <div key={group.label}>
            <button
              type="button"
              onClick={() => toggleGroup(group.label)}
              className="flex w-full items-center justify-between rounded-[var(--radius-panel)] px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)] hover:bg-[var(--color-fill-subtle)] hover:text-[var(--color-text-muted)]"
              aria-expanded={isOpen}
            >
              {group.label}
              <ChevronDown size={13} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
            </button>
            <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
              <div className="overflow-hidden">
                <div className="flex flex-col gap-0.5 pb-1">
                  {group.items.map((item) => (
                    <Link key={item.href} href={item.href} onClick={onNavigate} className={navLinkClasses(currentPath === item.href)}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="mt-1 flex flex-col gap-0.5 border-t border-[var(--color-hairline)] pt-2">
        {UTILITY_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} onClick={onNavigate} className={navLinkClasses(currentPath === item.href)}>
            {item.label}
          </Link>
        ))}
      </div>
    </>
  );
}

function NavLinksFallback() {
  return (
    <>
      {NAV.map((group) => (
        <div key={group.label}>
          <div className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.05em] text-[var(--color-text-placeholder)]">
            {group.label}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className={navLinkClasses(false)}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
      <div className="mt-1 flex flex-col gap-0.5 border-t border-[var(--color-hairline)] pt-2">
        {UTILITY_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={navLinkClasses(false)}>
            {item.label}
          </Link>
        ))}
      </div>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // "New deal" belongs to the board you create deals from, not every
  // screen in the app.
  const showNewDeal = pathname === "/desk/deals";

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
          "fixed inset-y-0 left-0 z-30 flex w-64 -translate-x-full flex-col border-r border-[var(--color-hairline)] bg-[var(--color-surface)] transition-transform duration-200 ease-out",
          open && "translate-x-0",
        )}
      >
        <div className="flex flex-none items-center justify-between px-5 py-4">
          <span className="text-[13.5px] font-semibold tracking-tight text-[var(--color-text)]">
            Deal Desk
          </span>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="relative rounded-full p-1.5 text-[var(--color-text-muted)] transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-[var(--color-fill-subtle)] active:bg-[var(--color-fill-subtle)] active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
        {/* min-h-0 lets this shrink below its content size inside the flex
            column above, which is what makes overflow-y-auto actually
            scroll instead of letting content run past the aside's bottom
            edge uncontrolled. */}
        <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-6">
          <Suspense fallback={<NavLinksFallback />}>
            <NavLinks onNavigate={() => setOpen(false)} />
          </Suspense>
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--color-header-rule)] bg-[var(--color-surface)] px-5 py-3">
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="relative rounded-full p-1.5 text-[var(--color-text)] transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-[var(--color-fill-subtle)] active:bg-[var(--color-fill-subtle)] active:scale-90"
          >
            <Menu size={20} />
          </button>
          <span className="text-[13.5px] font-semibold tracking-tight">Deal Desk</span>
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
