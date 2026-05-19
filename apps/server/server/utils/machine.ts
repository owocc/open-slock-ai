import { db } from "../db";
import { machines } from "../db/schemas/business";
import { eq, and, isNull } from "drizzle-orm";
import { ResponseError } from "./auth";

export async function hashMachineKey(text: string) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticateMachine(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ResponseError(401, "Unauthorized: Missing or invalid Machine Key");
  }

  const machineKey = authHeader.substring(7).trim();
  if (!machineKey.startsWith("sk_slock_")) {
    throw new ResponseError(401, "Unauthorized: Invalid key prefix");
  }

  const keyHash = await hashMachineKey(machineKey);

  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.keyHash, keyHash), isNull(machines.revokedAt)))
    .limit(1);

  if (!machine) {
    throw new ResponseError(401, "Unauthorized: Machine revoked or key invalid");
  }

  // 更新设备的最后在线时间
  await db.update(machines).set({ lastSeenAt: new Date() }).where(eq(machines.id, machine.id));

  return machine;
}
