"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { refreshPrices } from "@/server/actions/prices";

/** Fires the price-feed refresh; toasts the outcome. The action is fault-tolerant
 *  (missing feed / unreachable / bad shape → error result, never a throw). */
export function RefreshPricesButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await refreshPrices();
          if (res.ok) toast.success("Prices refreshed");
          else toast.error(res.error);
        })
      }
    >
      <RefreshCw className={cn("size-4", pending && "animate-spin")} />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
