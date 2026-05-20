import { db } from "../../../../db";
import { channels } from "../../../../db/schemas/business";
import { eq, and } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../../utils/auth";

export async function handleGetChannels(req: Request, serverId: string) {
  const user = await authenticateUser(req);

  if (!serverId) {
    throw new ResponseError(400, "Bad Request: serverId is required");
  }

  await checkServerMembership(user.id, serverId);

  // 解析 URL 查询参数
  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const archivedOnly = url.searchParams.get("archivedOnly") === "true";

  const conditions = [eq(channels.serverId, serverId)];

  if (archivedOnly) {
    conditions.push(eq(channels.isArchived, true));
  } else if (!includeArchived) {
    conditions.push(eq(channels.isArchived, false));
  }

  const serverChannels = await db
    .select()
    .from(channels)
    .where(and(...conditions))
    .orderBy(channels.sortIndex, channels.createdAt);

  return serverChannels;
}
