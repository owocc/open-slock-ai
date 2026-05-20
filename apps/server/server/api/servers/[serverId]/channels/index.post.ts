import { db } from "../../../../db";
import { channels } from "../../../../db/schemas/business";
import { authenticateUser, checkServerMembership } from "../../../../utils/auth";
import { z } from "zod";

export const CreateChannelSchema = z.object({
  name: z.string().min(1).describe("频道的显示名字"),
  groupId: z.string().nullable().optional().describe("关联的分组唯一的ID"),
  sortIndex: z.number().int().optional().describe("频道的排序位置"),
});

export async function handlePostChannels(
  req: Request,
  serverId: string,
  body: z.infer<typeof CreateChannelSchema>,
) {
  const user = await authenticateUser(req);
  await checkServerMembership(user.id, serverId);

  const channelId = crypto.randomUUID();
  const sortIndex = body.sortIndex ?? 0;
  const groupId = body.groupId ?? null;

  const result = await db
    .insert(channels)
    .values({
      id: channelId,
      serverId,
      groupId,
      name: body.name,
      sortIndex,
      isArchived: false,
    })
    .returning();

  return result[0];
}
