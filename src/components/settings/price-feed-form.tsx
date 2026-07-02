"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePriceFeed } from "@/server/actions/settings";
import type { SettingsProfile } from "@/server/queries/settings";
import { SettingsSection } from "./section";

export function PriceFeedForm({ profile }: { profile: SettingsProfile }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState(profile?.priceFeedUrl ?? "");
  const [token, setToken] = useState(profile?.priceFeedToken ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePriceFeed({ priceFeedUrl: url.trim(), priceFeedToken: token.trim() });
      if (res.ok) toast.success("Price feed saved");
      else toast.error(res.error);
    });
  }

  return (
    <SettingsSection
      title="Price feed"
      description="Endpoint + token used by the dashboard's Refresh Prices button."
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pff-url">Feed URL</Label>
          <Input
            id="pff-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pff-token">API token</Label>
          <Input
            id="pff-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save feed"}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
