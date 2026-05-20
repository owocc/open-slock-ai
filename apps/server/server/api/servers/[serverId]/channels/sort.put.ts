import { db } from "../../../../db";
import { channels } from "../../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../../utils/auth";
import { z } from "zod";

export const SortChannelsSchema = z.object({
  channels: z
    .array(
      z.object({
        id: z.string().min(1).describe("频道的唯一ID"),
        sortIndex: z.number().int().describe("新的排序索引值"),
        groupId: z.string().nullable().optional().describe("调换的分组ID（为空则移出分组）"),
      }),
    )
    .min(1)
    .describe("需要排序的频道列表"),
});

export async function handleBatchSortChannels(
  req: Request,
  serverId: string,
  body: z.infer<typeof SortChannelsSchema>,
) {
  const user = await authenticateUser(req);
  await checkServerMembership(user.id, serverId);

  // 校验所有需要排序的频道是否都属于该 server
  const channelIds = body.channels.map((c) => c.id);
  const dbChannels = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.serverId, serverId));

  const serverChannelIds = new Set(dbChannels.map((c) => c.id));
  const invalidChannels = channelIds.filter((id) => !serverChannelIds.has(id));
  if (invalidChannels.length > 0) {
    throw new ResponseError(
      400,
      `Bad Request: Some channels do not belong to this server: ${invalidChannels.join(", ")}`,
    );
  }

  // 批量进行排序权重和分组信息的可选修改
  await db.transaction(async (tx) => {
    for (const item of body.channels) {
      const updateData: { sortIndex: number; groupId?: string | null } = {
        sortIndex: item.sortIndex,
      };
      if (item.groupId !== undefined) {
        updateData.groupId = item.groupId;
      }
      await tx.update(channels).set(updateData).where(eq(channels.id, item.id));
    }
  });

  return {
    success: true,
    message: "Channels sorted successfully",
  };
}
