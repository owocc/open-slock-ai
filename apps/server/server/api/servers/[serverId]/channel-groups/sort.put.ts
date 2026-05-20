import { db } from "../../../../db";
import { channelGroups } from "../../../../db/schemas/business";
import { eq, and } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../../utils/auth";
import { z } from "zod";

export const SortChannelGroupsSchema = z.object({
  groups: z
    .array(
      z.object({
        id: z.string().min(1).describe("分组唯一ID"),
        sortIndex: z.number().int().describe("新的排序索引值"),
      }),
    )
    .min(1)
    .describe("需要排序的分组列表和排序权重"),
});

export async function handleBatchSortChannelGroups(
  req: Request,
  serverId: string,
  body: z.infer<typeof SortChannelGroupsSchema>,
) {
  const user = await authenticateUser(req);
  await checkServerMembership(user.id, serverId);

  // 校验所有要排序的分组是否都属于该 server
  const groupIds = body.groups.map((g) => g.id);
  const dbGroups = await db
    .select({ id: channelGroups.id })
    .from(channelGroups)
    .where(and(eq(channelGroups.serverId, serverId)));

  const serverGroupIds = new Set(dbGroups.map((g) => g.id));
  const invalidGroups = groupIds.filter((id) => !serverGroupIds.has(id));
  if (invalidGroups.length > 0) {
    throw new ResponseError(
      400,
      `Bad Request: Some groups do not belong to this server: ${invalidGroups.join(", ")}`,
    );
  }

  // 运行数据库事务，进行批量更新
  await db.transaction(async (tx) => {
    for (const item of body.groups) {
      await tx
        .update(channelGroups)
        .set({ sortIndex: item.sortIndex })
        .where(eq(channelGroups.id, item.id));
    }
  });

  return {
    success: true,
    message: "Channel groups sorted successfully",
  };
}
