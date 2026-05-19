import { db } from "../../../../db";
import { channels } from "../../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, ResponseError } from "../../../../utils/auth";

export async function handleGetChannels(req: Request, serverId: string) {
  await authenticateUser(req);

  if (!serverId) {
    throw new ResponseError(400, "Bad Request: serverId is required");
  }

  const serverChannels = await db.select().from(channels).where(eq(channels.serverId, serverId));

  return serverChannels;
}
