import { db } from "../../db";
import { agents } from "../../db/schemas/business";
import { and, eq } from "drizzle-orm";
import { authenticateMachine } from "../../utils/machine";
import { ResponseError } from "../../utils/auth";
import { z } from "zod";

export const RegisterAgentSchema = z.object({
  name: z.string().min(1).describe("智能体唯一命名标识"),
  displayName: z.string().min(1).describe("智能体在页面显示的客户端友好名字"),
  runtime: z.enum(["claude", "opencode"]).describe("使用的推理运行时类型"),
});

export async function handleRegisterAgent(req: Request, body: z.infer<typeof RegisterAgentSchema>) {
  const machine = await authenticateMachine(req);

  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.serverId, machine.serverId), eq(agents.name, body.name)))
    .limit(1);

  if (existingAgent) {
    if (existingAgent.machineId !== machine.id) {
      throw new ResponseError(
        409,
        `Conflict: Agent with name '${body.name}' already exists on this server`,
      );
    }

    await db
      .update(agents)
      .set({
        displayName: body.displayName,
        runtime: body.runtime,
      })
      .where(eq(agents.id, existingAgent.id));

    return {
      id: existingAgent.id,
      serverId: machine.serverId,
      machineId: machine.id,
      name: body.name,
      displayName: body.displayName,
      runtime: body.runtime,
      createdAt: existingAgent.createdAt,
    };
  }

  const agentId = crypto.randomUUID();
  await db.insert(agents).values({
    id: agentId,
    serverId: machine.serverId,
    machineId: machine.id,
    name: body.name,
    displayName: body.displayName,
    runtime: body.runtime,
  });

  return {
    id: agentId,
    serverId: machine.serverId,
    machineId: machine.id,
    name: body.name,
    displayName: body.displayName,
    runtime: body.runtime,
    createdAt: new Date().toISOString(),
  };
}
