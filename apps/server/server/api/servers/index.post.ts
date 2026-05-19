import { db } from "../../db";
import { servers, serverMembers } from "../../db/schemas/business";
import { authenticateUser } from "../../utils/auth";
import { z } from "zod";

export const CreateServerSchema = z.object({
  name: z.string().min(1).describe("服务器的显示名"),
  slug: z.string().optional().describe("服务器唯一别名标识（Slug）"),
});

export async function handlePostServers(req: Request, body: z.infer<typeof CreateServerSchema>) {
  const user = await authenticateUser(req);

  const serverId = crypto.randomUUID();
  const slug = body.slug || `server-${serverId.slice(0, 8)}`;

  await db.transaction(async (tx) => {
    await tx.insert(servers).values({
      id: serverId,
      name: body.name,
      slug,
      isDefault: false,
    });

    await tx.insert(serverMembers).values({
      serverId,
      userId: user.id,
    });
  });

  return {
    id: serverId,
    name: body.name,
    slug,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };
}
