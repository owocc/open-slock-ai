import { db } from "../../../db";
import { channelGroups } from "../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../utils/auth";

export async function handleDeleteChannelGroup(req: Request, groupId: string) {
  const user = await authenticateUser(req);

  const group = await db.query.channelGroups.findFirst({
    where: eq(channelGroups.id, groupId),
  });

  if (!group) {
    throw new ResponseError(404, "Channel group not found");
  }

  await checkServerMembership(user.id, group.serverId);

  await db.delete(channelGroups).where(eq(channelGroups.id, groupId)).returning();

  return {
    success: true,
    message: "Channel group deleted successfully",
    id: groupId,
  };
}
