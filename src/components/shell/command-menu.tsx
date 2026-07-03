"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Moon, Sun, PlusCircle, RefreshCw } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "./nav";
import { COMMAND_EVENT } from "@/lib/command";
import { useThemeMode } from "./theme-mode";

/** ⌘K / Ctrl+K palette, mounted once in AppShell. Navigation is live; the two
 *  action items route to searchParams the owning phases (6/9) will act on. */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { setMode } = useThemeMode();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_EVENT, onOpen);
    };
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Navigate Fortuna or run an action"
    >
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <CommandItem
              key={href}
              value={label}
              onSelect={() => run(() => router.push(href))}
            >
              <Icon />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="Log expense"
            onSelect={() => run(() => router.push("/transactions?log=1"))}
          >
            <PlusCircle />
            Log expense
          </CommandItem>
          <CommandItem
            value="Refresh prices"
            onSelect={() => run(() => router.push("/dashboard?refresh=prices"))}
          >
            <RefreshCw />
            Refresh prices
          </CommandItem>
          <CommandItem
            value="Toggle theme"
            onSelect={() =>
              run(() => setMode(resolvedTheme === "dark" ? "light" : "dark"))
            }
          >
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            Toggle theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
