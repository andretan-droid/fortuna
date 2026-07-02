import { signIn } from "@/auth";
import { ThemeToggle } from "@/components/shell/theme-toggle";

// Public editorial sign-in hero. Server-action Google sign-in (no client dep).
// Middleware sends already-authenticated visitors straight to /dashboard.
export default function Home() {
  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden">
      {/* Oversized ghost numeral — depth without an image. */}
      <span
        aria-hidden
        className="font-display pointer-events-none absolute -right-10 -top-24 select-none text-[42vw] leading-none text-foreground/[0.03] sm:text-[34vw]"
      >
        $
      </span>

      <header className="flex items-center justify-between px-6 py-6 lg:px-12">
        <span className="font-display text-xl">Fortuna</span>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-center px-6 lg:px-12">
        <div className="max-w-xl space-y-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Personal finance, elevated
          </p>
          <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">
            Your money,
            <br />
            in fine detail.
          </h1>
          <p className="max-w-md text-base text-muted-foreground">
            A boutique budget tracker — every transaction, budget, and holding in
            one calm ledger. Warm paper by day, deep space by night.
          </p>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="interactive inline-flex h-12 items-center gap-3 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[var(--shadow-paper)]"
            >
              <GoogleMark />
              Continue with Google
            </button>
          </form>

          <p className="text-xs text-muted-foreground/70">
            Multi-user from day one · RM (MYR) · your data stays yours.
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="currentColor"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
        opacity="0.9"
      />
      <path
        fill="currentColor"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3 0-5.6-2-6.6-4.8H1.4v3.1A12 12 0 0 0 12 24Z"
        opacity="0.6"
      />
      <path
        fill="currentColor"
        d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.4a12 12 0 0 0 0 11l4-3.1Z"
        opacity="0.45"
      />
      <path
        fill="currentColor"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.4 6.8 9 4.8 12 4.8Z"
        opacity="0.75"
      />
    </svg>
  );
}
