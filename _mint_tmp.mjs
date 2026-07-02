// ponytail: throwaway — mints a local session JWT for browser verification.
// Uses the app's own AUTH_SECRET + Auth.js encode, so it's a REAL session
// for the already-verified user row. Never leaves this machine. Delete after.
import { encode } from "next-auth/jwt";

const token = await encode({
  token: {
    sub: "42bed719-6796-4d6b-8499-69c9ce26ff28",
    name: "Nightshade",
    email: "andretanbusiness@gmail.com",
  },
  secret: process.env.AUTH_SECRET,
  salt: "authjs.session-token",
  maxAge: 60 * 60 * 4, // 4h — verification window only
});
console.log(token);
