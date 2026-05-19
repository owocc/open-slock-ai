import { db } from "../../../../db";
import { messages, agents } from "../../../../db/schemas/business";
import { and, eq } from "drizzle-orm";
import { authenticateEvent } from "../../../../utils/auth-any";
import { ResponseError } from "../../../../utils/auth";
import { z } from "zod";

export const PostMessageSchema = z.object({
  content: z.string().min(1).describe("消息内容"),
  parentId: z.string().uuid().nullable().optional().describe("父级消息（线程）ID"),
  replyTo: z.string().uuid().nullable().optional().describe("被回复的消息ID"),
  senderId: z.string().optional().describe("发送者ID，对于 Machine 鉴权是必需的"),
  senderType: z.enum(["human", "agent", "system"]).optional().describe("发送者类型"),
  mentions: z.array(z.string()).optional().describe("Mentions 列表"),
});

export async function handlePostMessages(
  req: Request,
  channelId: string,
  body: z.infer<typeof PostMessageSchema>,
) {
  const authContext = await authenticateEvent(req);

  const parentId = body.parentId || null;
  const replyTo = body.replyTo || null;

  let senderId: string;
  let senderType: "human" | "agent" | "system";

  if (authContext.type === "user") {
    senderId = authContext.value.id;
    senderType = "human";
  } else {
    senderId = body.senderId || "";
    senderType = body.senderType || "agent";

    if (!senderId) {
      throw new ResponseError(
        400,
        "Bad Request: senderId is required for Machine-Key authentication",
      );
    }

    if (senderType === "agent") {
      const [agent] = await db
        .select()
        .from(agents)
        .where(and(eq(agents.id, senderId), eq(agents.machineId, authContext.value.id)))
        .limit(1);

      if (!agent) {
        throw new ResponseError(403, "Forbidden: Agent is not associated with this Machine Key");
      }
    }
  }

  let triggerChainId: string | null = null;
  let chainDepth = 0;
  const messageId = crypto.randomUUID();

  if (senderType === "human") {
    triggerChainId = messageId;
    chainDepth = 0;
  } else {
    const triggerMessageId = body.replyTo || body.parentId;
    if (!triggerMessageId) {
      throw new ResponseError(
        400,
        "Bad Request: replyTo or parentId is required for Agent/System senders to prevent infinite loops",
      );
    }

    const [triggerMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, triggerMessageId))
      .limit(1);

    if (!triggerMessage) {
      throw new ResponseError(404, "Trigger source message not found");
    }

    if (triggerMessage.chainDepth >= 4) {
      throw new ResponseError(
        400,
        "Loop Prevention: Conversation chain depth limit (4) reached. Message rejected.",
      );
    }

    triggerChainId = triggerMessage.triggerChainId || triggerMessage.id;
    chainDepth = triggerMessage.chainDepth + 1;
  }

  const mentions = body.mentions || [];

  await db.insert(messages).values({
    id: messageId,
    channelId,
    parentId,
    senderId,
    senderType,
    content: body.content,
    mentions,
    replyTo,
    triggerChainId,
    chainDepth,
  });

  return {
    id: messageId,
    channelId,
    parentId,
    senderId,
    senderType,
    content: body.content,
    mentions,
    replyTo,
    triggerChainId,
    chainDepth,
    createdAt: new Date().toISOString(),
  };
}
