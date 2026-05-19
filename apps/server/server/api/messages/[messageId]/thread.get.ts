import { db } from "../../../db";
import { messages } from "../../../db/schemas/business";
import { eq, asc } from "drizzle-orm";
import { authenticateEvent } from "../../../utils/auth-any";
import { ResponseError } from "../../../utils/auth";

export async function handleGetThread(req: Request, messageId: string) {
  await authenticateEvent(req);

  if (!messageId) {
    throw new ResponseError(400, "Bad Request: messageId is required");
  }

  const replies = await db
    .select()
    .from(messages)
    .where(eq(messages.parentId, messageId))
    .orderBy(asc(messages.createdAt));

  return replies;
}
