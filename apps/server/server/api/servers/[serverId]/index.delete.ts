import { db } from "../../../db";
import { servers } from "../../../db/schemas/business";
import { eq } from "drizzle-orm";
import { authenticateUser, checkServerMembership, ResponseError } from "../../../utils/auth";

export async function handleDeleteServer(req: Request, serverId: string) {
  const user = await authenticateUser(req);
  await checkServerMembership(user.id, serverId);

  const result = await db.delete(servers).where(eq(servers.id, serverId)).returning();

  if (result.length === 0) {
    throw new ResponseError(404, "Server not found");
  }

  return {
    success: true,
    message: "Server deleted successfully",
    id: serverId,
  };
}
