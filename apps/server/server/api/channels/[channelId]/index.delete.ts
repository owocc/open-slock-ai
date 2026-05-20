import { db } from "../../../db";
import { channels } from "../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../utils/auth";

export async function handleDeleteChannel(req: Request, channelId: string) {
  const user = await authenticateUser(req);

  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) {
    throw new ResponseError(404, "Channel not found");
  }

  await checkServerMembership(user.id, channel.serverId);

  await db.delete(channels).where(eq(channels.id, channelId)).returning();

  return {
    success: true,
    message: "Channel deleted successfully",
    id: channelId,
  };
}
