import Link from "next/link";
import { Calculator, Car, FileText, Settings, UserPlus, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";

const QUICKLINKS = [
  { label: "New deal", href: "/desk/deals/new", icon: Zap },
  { label: "Add a vehicle", href: "/inventory", icon: Car },
  { label: "New lead", href: "/leads", icon: UserPlus },
  { label: "Out-of-state calculator", href: "/out-of-state-calculator", icon: Calculator },
  { label: "Schedule appointment", href: "/desk/appointments", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

export function HomeQuicklinks() {
  return (
    <Card>
      <div className="mb-3 text-[13.5px] font-semibold text-[var(--color-text)]">Quicklinks</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUICKLINKS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-[var(--radius-panel)] px-3 py-2.5 text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-fill-subtle)]"
          >
            <Icon size={16} className="flex-none text-[var(--color-primary)]" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
