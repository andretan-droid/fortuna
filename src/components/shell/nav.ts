import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  LineChart,
  Upload,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  /** Full label — sidebar. */
  label: string;
  /** Short label — mobile bottom bar (fits 6 tabs at 375px). */
  short: string;
  icon: LucideIcon;
};

/** The single source of nav truth — consumed by both the desktop sidebar and
 *  the mobile bottom bar so the two can never drift. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Overview", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", short: "Ledger", icon: ArrowLeftRight },
  { href: "/categories", label: "Categories", short: "Budgets", icon: Tags },
  { href: "/analytics", label: "Analytics", short: "Charts", icon: LineChart },
  { href: "/import", label: "Import", short: "Import", icon: Upload },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];
