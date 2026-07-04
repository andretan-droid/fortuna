import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/** Route prefixes that require a session. */
const PROTECTED = [
  "/dashboard",
  "/transactions",
  "/categories",
  "/analytics",
  "/debts",
  "/import",
  "/settings",
];

/** Edge-safe base config — NO adapter, NO db import — so middleware stays on the
 *  edge with zero Neon cold-start. The full config (with the Drizzle adapter for
 *  user/account persistence) lives in auth.ts for the Node runtime. */
export const authConfig = {
  providers: [Google],
  pages: { signIn: "/" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      // Before Phase 5a there is no database, so sign-in is impossible; let
      // requests through and let the (app) layout render its SetupNotice
      // instead of bouncing every route to the sign-in hero.
      if (!process.env.DATABASE_URL) return true;

      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
      if (isProtected) return isLoggedIn; // → redirect to signIn page if not
      if (isLoggedIn && pathname === "/") {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }
      return true;
    },
    // JWT strategy: token.sub is the user id; surface it on the session.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
