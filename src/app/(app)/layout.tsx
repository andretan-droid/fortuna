import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasDatabase } from "@/db/client";
import { AppShell } from "@/components/shell/app-shell";
import { SetupNotice } from "@/components/setup-notice";

// Calling auth() makes every (app) route dynamic → `next build` executes zero
// queries. Before Phase 5a (no DATABASE_URL) we can't authenticate, so show the
// setup guidance inside the shell instead of gating.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasDatabase()) {
    return (
      <AppShell>
        <SetupNotice />
      </AppShell>
    );
  }

  const session = await auth();
  if (!session?.user) redirect("/");

  return <AppShell>{children}</AppShell>;
}
