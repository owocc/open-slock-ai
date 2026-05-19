import { db } from "../../../../db";
import { agents } from "../../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, ResponseError } from "../../../../utils/auth";

export async function handleGetAgents(req: Request, serverId: string) {
  await authenticateUser(req);

  if (!serverId) {
    throw new ResponseError(400, "Bad Request: serverId is required");
  }

  const serverAgents = await db.select().from(agents).where(eq(agents.serverId, serverId));

  return serverAgents;
}
