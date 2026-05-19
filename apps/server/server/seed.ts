import { db } from "./db";
import { servers, channels } from "./db/schemas/business";
import { eq, and } from "drizzle-orm";

export async function seed() {
  try {
    console.log("[Seed] Checking/initializing default server and general channel...");

    // 1. 检查是否存在默认服务器
    const [existingServer] = await db
      .select()
      .from(servers)
      .where(eq(servers.isDefault, true))
      .limit(1);
    let serverId = existingServer?.id;

    if (!serverId) {
      serverId = crypto.randomUUID();
      await db.insert(servers).values({
        id: serverId,
        slug: "default",
        name: "Default Server",
        isDefault: true,
      });
      console.log(`[Seed] Default server created with ID: ${serverId}`);
    } else {
      console.log(`[Seed] Default server exists with ID: ${serverId}`);
    }

    // 2. 检查默认服务器下是否存在 general 默认频道
    const [existingChannel] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.serverId, serverId), eq(channels.name, "general")))
      .limit(1);

    if (!existingChannel) {
      const channelId = crypto.randomUUID();
      await db.insert(channels).values({
        id: channelId,
        serverId: serverId,
        name: "general",
      });
      console.log(`[Seed] General channel created with ID: ${channelId}`);
    } else {
      console.log("[Seed] General channel already exists.");
    }
  } catch (err) {
    console.error("[Seed] Failed to seed default database rows:", err);
  }
}
