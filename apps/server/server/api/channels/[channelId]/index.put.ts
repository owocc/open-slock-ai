import { db } from "../../../db";
import { channels } from "../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../utils/auth";
import { z } from "zod";

export const UpdateChannelSchema = z.object({
  name: z.string().min(1).optional().describe("频道的显示名字"),
  groupId: z.string().nullable().optional().describe("频道分组的唯一ID（为空表示移出分组）"),
  sortIndex: z.number().int().optional().describe("频道的排序索引值"),
  isArchived: z.boolean().optional().describe("是否归档（假删除）频道"),
});

export async function handlePutChannel(
  req: Request,
  channelId: string,
  body: z.infer<typeof UpdateChannelSchema>,
) {
  const user = await authenticateUser(req);

  // 1. 获取现有频道，判断其 serverId
  const channel = await db.query.channels.findFirst({
    where: eq(channels.id, channelId),
  });

  if (!channel) {
    throw new ResponseError(404, "Channel not found");
  }

  // 2. 校验用户在该 serverId 的成员权限
  await checkServerMembership(user.id, channel.serverId);

  if (
    !body.name &&
    body.groupId === undefined &&
    body.sortIndex === undefined &&
    body.isArchived === undefined
  ) {
    throw new ResponseError(400, "Bad Request: No fields to update");
  }

  const updateData: {
    name?: string;
    groupId?: string | null;
    sortIndex?: number;
    isArchived?: boolean;
  } = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.groupId !== undefined) updateData.groupId = body.groupId;
  if (body.sortIndex !== undefined) updateData.sortIndex = body.sortIndex;
  if (body.isArchived !== undefined) updateData.isArchived = body.isArchived;

  // 3. 执行更新
  const result = await db
    .update(channels)
    .set(updateData)
    .where(eq(channels.id, channelId))
    .returning();

  return result[0];
}
