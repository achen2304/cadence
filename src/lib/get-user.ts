import { auth } from "./auth";

/**
 * Get the current authenticated user's ID from the session.
 * Returns null if not authenticated.
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Get the current authenticated user's ID, throwing if not authenticated.
 * Use this in API routes that require authentication.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}
