import { PageHeader } from "@/components/shell/page-header";
import { AccountsManager } from "@/components/settings/accounts-manager";
import { DangerZone } from "@/components/settings/danger-zone";
import { PaymentMethods } from "@/components/settings/payment-methods";
import { PriceFeedForm } from "@/components/settings/price-feed-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { RecurringManager } from "@/components/settings/recurring-manager";
import { SinkingManager } from "@/components/settings/sinking-manager";
import { requireUserId } from "@/server/auth-helpers";
import { getCategoryOptions } from "@/server/queries/transactions";
import { getSettingsBundle } from "@/server/queries/settings";
import { getRecurringStatus } from "@/server/queries/recurring";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [bundle, categoryOptions, recurringStatus] = await Promise.all([
    getSettingsBundle(userId),
    getCategoryOptions(userId),
    getRecurringStatus(userId),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Profile, price feed, payment methods, accounts, and danger zone."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ProfileForm profile={bundle.profile} paymentMethods={bundle.paymentMethods} />
        <PriceFeedForm profile={bundle.profile} />
        <PaymentMethods rows={bundle.paymentMethods} />
        <AccountsManager rows={bundle.accounts} />
        <SinkingManager rows={bundle.sinkingFunds} categories={categoryOptions} />
        <RecurringManager
          rows={bundle.recurringRules}
          categories={categoryOptions}
          paymentMethods={bundle.paymentMethods
            .filter((m) => m.active)
            .map((m) => ({ id: m.id, name: m.name }))}
          statuses={recurringStatus}
        />
      </div>
      <DangerZone />
    </div>
  );
}
