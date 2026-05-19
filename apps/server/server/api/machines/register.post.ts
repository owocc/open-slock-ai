import { db } from "../../db";
import { machines } from "../../db/schemas/business";
import { authenticateUser } from "../../utils/auth";
import { hashMachineKey } from "../../utils/machine";
import { z } from "zod";

export const RegisterMachineSchema = z.object({
  serverId: z.string().uuid().describe("机台所绑定的服务器 UUID 标识"),
  label: z.string().min(1).describe("描述这台物理机或环境的标签"),
});

function generateMachineKey() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "sk_slock_";
  for (let i = 0; i < 23; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function handleRegisterMachine(
  req: Request,
  body: z.infer<typeof RegisterMachineSchema>,
) {
  const user = await authenticateUser(req);

  const machineId = crypto.randomUUID();
  const machineKey = generateMachineKey();
  const keyHash = await hashMachineKey(machineKey);
  const keyPrefix = machineKey.substring(0, 12);

  const now = new Date();
  await db.insert(machines).values({
    id: machineId,
    userId: user.id,
    serverId: body.serverId,
    label: body.label,
    keyHash,
    keyPrefix,
  });

  return {
    id: machineId,
    label: body.label,
    keyPrefix,
    machineKey,
    createdAt: now.toISOString(),
  };
}
