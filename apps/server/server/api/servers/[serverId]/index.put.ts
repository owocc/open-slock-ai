import { db } from "../../../db";
import { servers } from "../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../utils/auth";
import { z } from "zod";

export const UpdateServerSchema = z.object({
  name: z.string().min(1).optional().describe("服务器显示名称"),
  slug: z.string().min(1).optional().describe("服务器唯一标识 Slug"),
});

export async function handlePutServer(
  req: Request,
  serverId: string,
  body: z.infer<typeof UpdateServerSchema>,
) {
  const user = await authenticateUser(req);
  await checkServerMembership(user.id, serverId);

  // 检查试图更新的字段是否有内容
  if (!body.name && !body.slug) {
    throw new ResponseError(400, "Bad Request: No fields to update");
  }

  const updateData: { name?: string; slug?: string } = {};
  if (body.name) updateData.name = body.name;
  if (body.slug) updateData.slug = body.slug;

  const result = await db
    .update(servers)
    .set(updateData)
    .where(eq(servers.id, serverId))
    .returning();

  if (result.length === 0) {
    throw new ResponseError(404, "Server not found");
  }

  return {
    id: result[0].id,
    name: result[0].name,
    slug: result[0].slug,
    isDefault: result[0].isDefault,
    createdAt: result[0].createdAt,
  };
}
