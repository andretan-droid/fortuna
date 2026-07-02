import { Database, KeyRound } from "lucide-react";

/** Shown inside the shell when DATABASE_URL is absent (before Phase 5a). Turns
 *  the "no backend yet" state into clear, on-brand setup guidance. */
export function SetupNotice() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Almost there
        </p>
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          Connect Fortuna to its database
        </h1>
        <p className="text-sm text-muted-foreground">
          The interface is live, but there is no database wired up yet. Two short
          steps bring it online — you only do these once.
        </p>
      </div>

      <ol className="space-y-4">
        {[
          {
            icon: Database,
            title: "Neon Postgres",
            body: "Create a free Neon project, copy the pooled connection string, and paste it into .env.local as DATABASE_URL.",
          },
          {
            icon: KeyRound,
            title: "Google sign-in",
            body: "Create a Google OAuth client, then set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET and run npx auth secret.",
          },
        ].map(({ icon: Icon, title, body }, i) => (
          <li
            key={title}
            className="flex gap-4 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-paper)]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-brand">
              <Icon className="size-5" strokeWidth={1.75} />
            </span>
            <div className="space-y-1">
              <p className="font-medium">
                <span className="text-muted-foreground">Step {i + 1} · </span>
                {title}
              </p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground/70">
        Restart the dev server after editing .env.local so the new values load.
      </p>
    </div>
  );
}
