import { db } from "../../../db";
import { machines } from "../../../db/schemas/business";
import { and, eq, isNull } from "drizzle-orm";
import { authenticateUser, ResponseError } from "../../../utils/auth";

export async function handleRevokeMachine(req: Request, machineId: string) {
  const user = await authenticateUser(req);

  if (!machineId) {
    throw new ResponseError(400, "Bad Request: machineId is required");
  }

  const [machine] = await db
    .select()
    .from(machines)
    .where(
      and(eq(machines.id, machineId), eq(machines.userId, user.id), isNull(machines.revokedAt)),
    )
    .limit(1);

  if (!machine) {
    throw new ResponseError(404, "Machine not found or already revoked");
  }

  await db.update(machines).set({ revokedAt: new Date() }).where(eq(machines.id, machineId));

  return {
    success: true,
    message: "Machine revoked successfully",
  };
}
