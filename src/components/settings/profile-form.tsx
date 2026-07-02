"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toCents, formatAmount } from "@/lib/money";
import { saveProfile, type ProfileInput } from "@/server/actions/settings";
import type { PaymentMethodRow, SettingsProfile } from "@/server/queries/settings";
import { SettingsSection } from "./section";

/** Salary figures + savings target + default payment method. All money in
 *  RM decimal at the UI, integer cents at the wire (toCents). */
export function ProfileForm({
  profile,
  paymentMethods,
}: {
  profile: SettingsProfile;
  paymentMethods: PaymentMethodRow[];
}) {
  const [pending, startTransition] = useTransition();
  const money = (c: number | null | undefined) => (c != null ? formatAmount(c) : "");

  const [currency, setCurrency] = useState(profile?.currency ?? "RM");
  const [gross, setGross] = useState(money(profile?.grossSalaryCents));
  const [statutory, setStatutory] = useState(money(profile?.statutoryCents));
  const [net, setNet] = useState(money(profile?.netSalaryCents));
  const [targetPct, setTargetPct] = useState(
    profile?.targetSavingsRate != null
      ? String(parseFloat(profile.targetSavingsRate) * 100)
      : "",
  );
  const [defaultPm, setDefaultPm] = useState(profile?.defaultPaymentMethodId ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // empty = "not set" (null); anything else must parse
    const parse = (v: string, label: string): number | null | undefined => {
      if (v.trim() === "") return null;
      const c = toCents(v);
      if (c == null || c < 0) {
        toast.error(`Enter a valid ${label}`);
        return undefined;
      }
      return c;
    };
    const grossC = parse(gross, "gross salary");
    const statC = parse(statutory, "statutory deduction");
    const netC = parse(net, "net salary");
    if (grossC === undefined || statC === undefined || netC === undefined) return;

    let rate: number | null = null;
    if (targetPct.trim() !== "") {
      const p = Number(targetPct);
      if (!Number.isFinite(p) || p < 0 || p > 100)
        return void toast.error("Savings target must be 0–100%");
      rate = p / 100;
    }

    const input: ProfileInput = {
      currency: currency.trim() || "RM",
      grossSalaryCents: grossC,
      statutoryCents: statC,
      netSalaryCents: netC,
      targetSavingsRate: rate,
      defaultPaymentMethodId: defaultPm || null,
    };
    startTransition(async () => {
      const res = await saveProfile(input);
      if (res.ok) toast.success("Profile saved");
      else toast.error(res.error);
    });
  }

  return (
    <SettingsSection
      title="Profile"
      description="Salary figures drive the dashboard's savings-rate ring."
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pf-currency">Currency</Label>
          <Input
            id="pf-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-default-pm">Default payment method</Label>
          <select
            id="pf-default-pm"
            value={defaultPm}
            onChange={(e) => setDefaultPm(e.target.value)}
            className="border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none"
          >
            <option value="">None</option>
            {paymentMethods
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-gross">Gross salary (RM/mo)</Label>
          <Input id="pf-gross" value={gross} onChange={(e) => setGross(e.target.value)} inputMode="decimal" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-statutory">Statutory deductions (RM/mo)</Label>
          <Input id="pf-statutory" value={statutory} onChange={(e) => setStatutory(e.target.value)} inputMode="decimal" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-net">Net salary (RM/mo)</Label>
          <Input id="pf-net" value={net} onChange={(e) => setNet(e.target.value)} inputMode="decimal" autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-target">Target savings rate (%)</Label>
          <Input id="pf-target" value={targetPct} onChange={(e) => setTargetPct(e.target.value)} inputMode="decimal" placeholder="e.g. 30" autoComplete="off" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
