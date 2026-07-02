import "server-only";
import { auth } from "@/auth";

/** THE single multi-tenant scoping gate. Every query fn, server action, and
 *  API route opens with this; every WHERE clause includes the returned id.
 *  user_id NEVER comes from client input. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Unauthorized");
  return id;
}
