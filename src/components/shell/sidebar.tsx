"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

/** Fixed desktop sidebar (≥1024px). Ivory: hairline rule on cream. Obsidian:
 *  deepest layer via --color-sidebar. Hidden below lg — mobile uses BottomTabs. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <Link href="/dashboard" className="flex h-20 items-center gap-3 px-7">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Wallet className="size-5" strokeWidth={1.75} />
        </span>
        <span className="font-display text-2xl leading-none">Fortuna</span>
      </Link>

      <nav className="flex-1 space-y-0.5 px-4 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors duration-200",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand" />
              )}
              <Icon className="size-[18px]" strokeWidth={active ? 2 : 1.75} />
              <span className={cn(active && "font-medium")}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-7 py-6">
        <p className="text-xs tracking-wide text-muted-foreground">
          RM · Ivory ↔ Obsidian
        </p>
      </div>
    </aside>
  );
}
