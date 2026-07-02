"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/lib/utils";

/** Mobile bottom navigation (<1024px). Frosted glass over the grain. Short
 *  labels keep all six tabs legible at 375px. */
export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-stretch pb-[env(safe-area-inset-bottom)] lg:hidden">
      {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-200",
              active ? "text-brand" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2 : 1.75} />
            <span className="text-[10px] tracking-tight">{short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
