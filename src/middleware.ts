import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge middleware runs the `authorized` callback to guard (app) routes.
// Uses the adapter-free config → no Neon on the edge.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Everything except API routes, Next internals, and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
