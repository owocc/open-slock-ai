import { db } from "../../../../db";
import { channelGroups } from "../../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, checkServerMembership } from "../../../../utils/auth";

export async function handleGetChannelGroups(req: Request, serverId: string) {
  const user = await authenticateUser(req);
  await checkServerMembership(user.id, serverId);

  const groups = await db.query.channelGroups.findMany({
    where: eq(channelGroups.serverId, serverId),
    orderBy: (table, { asc }) => [asc(table.sortIndex)],
    with: {
      channels: {
        where: (table, { eq }) => eq(table.isArchived, false),
        orderBy: (table, { asc }) => [asc(table.sortIndex)],
      },
    },
  });

  return groups;
}
