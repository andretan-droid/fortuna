import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { authConfig } from "./auth.config";
import { getDb, hasDatabase } from "./db/client";
import { users, oauthAccounts, sessions, verificationTokens } from "./db/schema";

// Adapter only when a database exists — keeps `next build` green with no env
// (getDb() is never called, so it never throws). With DATABASE_URL set, the
// adapter persists users + linked Google accounts (JWT sessions, not DB rows).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: hasDatabase()
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: oauthAccounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
});
