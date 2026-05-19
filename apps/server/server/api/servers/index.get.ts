import { db } from "../../db";
import { servers, serverMembers } from "../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser } from "../../utils/auth";

export async function handleGetServers(req: Request) {
  const user = await authenticateUser(req);

  const userServers = await db
    .select({
      id: servers.id,
      slug: servers.slug,
      name: servers.name,
      isDefault: servers.isDefault,
      createdAt: servers.createdAt,
    })
    .from(servers)
    .innerJoin(serverMembers, eq(servers.id, serverMembers.serverId))
    .where(eq(serverMembers.userId, user.id));

  return userServers;
}
