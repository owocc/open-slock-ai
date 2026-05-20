import { auth } from "../lib/auth";
import { db } from "../db";
import { serverMembers } from "../db/schemas/business";
import { and, eq } from "drizzle-orm";

export class ResponseError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ResponseError";
  }
}

export async function authenticateUser(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  if (!session) {
    throw new ResponseError(401, "Unauthorized: Missing or invalid User Session");
  }
  return session.user;
}

export async function checkServerMembership(userId: string, serverId: string) {
  const membership = await db
    .select()
    .from(serverMembers)
    .where(and(eq(serverMembers.serverId, serverId), eq(serverMembers.userId, userId)))
    .limit(1);

  if (membership.length === 0) {
    throw new ResponseError(403, "Forbidden: User is not a member of this server");
  }
}
