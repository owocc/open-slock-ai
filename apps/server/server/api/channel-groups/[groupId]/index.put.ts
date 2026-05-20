import { db } from "../../../db";
import { channelGroups } from "../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../utils/auth";
import { z } from "zod";

export const UpdateChannelGroupSchema = z.object({
  name: z.string().min(1).optional().describe("分组显示名称"),
  sortIndex: z.number().int().optional().describe("排序索引"),
});

export async function handlePutChannelGroup(
  req: Request,
  groupId: string,
  body: z.infer<typeof UpdateChannelGroupSchema>,
) {
  const user = await authenticateUser(req);

  const group = await db.query.channelGroups.findFirst({
    where: eq(channelGroups.id, groupId),
  });

  if (!group) {
    throw new ResponseError(404, "Channel group not found");
  }

  await checkServerMembership(user.id, group.serverId);

  if (!body.name && body.sortIndex === undefined) {
    throw new ResponseError(400, "Bad Request: No fields to update");
  }

  const updateData: { name?: string; sortIndex?: number } = {};
  if (body.name) updateData.name = body.name;
  if (body.sortIndex !== undefined) updateData.sortIndex = body.sortIndex;

  const result = await db
    .update(channelGroups)
    .set(updateData)
    .where(eq(channelGroups.id, groupId))
    .returning();

  return result[0];
}
