import { db } from "../../../../db";
import { channelGroups } from "../../../../db/schemas/business";
import { authenticateUser, checkServerMembership } from "../../../../utils/auth";
import { z } from "zod";

export const CreateChannelGroupSchema = z.object({
  name: z.string().min(1).describe("分组显示名称"),
  sortIndex: z.number().int().optional().describe("排序索引"),
});

export async function handlePostChannelGroups(
  req: Request,
  serverId: string,
  body: z.infer<typeof CreateChannelGroupSchema>,
) {
  const user = await authenticateUser(req);
  await checkServerMembership(user.id, serverId);

  const groupId = crypto.randomUUID();
  const sortIndex = body.sortIndex ?? 0;

  const result = await db
    .insert(channelGroups)
    .values({
      id: groupId,
      serverId,
      name: body.name,
      sortIndex,
    })
    .returning();

  return result[0];
}
