import { db } from "../../../../db";
import { messages } from "../../../../db/schemas/business";
import { and, eq, isNull, lt, desc } from "drizzle-orm";
import { authenticateEvent } from "../../../../utils/auth-any";
import { ResponseError } from "../../../../utils/auth";

export async function handleGetMessages(req: Request, channelId: string) {
  await authenticateEvent(req);

  if (!channelId) {
    throw new ResponseError(400, "Bad Request: channelId is required");
  }

  const query = Object.fromEntries(new URL(req.url).searchParams);
  const limit = Math.min(parseInt(query.limit as string) || 50, 100);
  const cursor = query.cursor ? parseInt(query.cursor as string) : null;

  const conditions = [eq(messages.channelId, channelId), isNull(messages.parentId)];

  if (cursor !== null && !isNaN(cursor)) {
    conditions.push(lt(messages.seq, cursor));
  }

  const channelMessages = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.seq))
    .limit(limit);

  return channelMessages;
}
