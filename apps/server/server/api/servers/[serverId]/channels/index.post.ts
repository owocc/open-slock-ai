import { db } from "../../../../db";
import { channels } from "../../../../db/schemas/business";
import { authenticateUser } from "../../../../utils/auth";
import { z } from "zod";

export const CreateChannelSchema = z.object({
  name: z.string().min(1).describe("频道的显示名字"),
});

export async function handlePostChannels(
  req: Request,
  serverId: string,
  body: z.infer<typeof CreateChannelSchema>,
) {
  await authenticateUser(req);

  const channelId = crypto.randomUUID();
  await db.insert(channels).values({
    id: channelId,
    serverId,
    name: body.name,
  });

  return {
    id: channelId,
    serverId,
    name: body.name,
    createdAt: new Date().toISOString(),
  };
}
