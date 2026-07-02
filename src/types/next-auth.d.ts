import type { DefaultSession } from "next-auth";

// Surface the user id on the session (set in auth.config.ts session callback).
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
