const subscribers = new Map<string, Set<any>>();
const wsRooms = new Map<any, Set<string>>();

export function subscribe(ws: any, channelId: string) {
  if (!subscribers.has(channelId)) {
    subscribers.set(channelId, new Set());
  }
  subscribers.get(channelId)!.add(ws);

  if (!wsRooms.has(ws)) {
    wsRooms.set(ws, new Set());
  }
  wsRooms.get(ws)!.add(channelId);
}

export function unsubscribe(ws: any, channelId: string) {
  const channel = subscribers.get(channelId);
  if (channel) {
    channel.delete(ws);
    if (channel.size === 0) subscribers.delete(channelId);
  }
  const rooms = wsRooms.get(ws);
  if (rooms) {
    rooms.delete(channelId);
    if (rooms.size === 0) wsRooms.delete(ws);
  }
}

export function unsubscribeAll(ws: any) {
  const rooms = wsRooms.get(ws);
  if (rooms) {
    for (const channelId of [...rooms]) {
      unsubscribe(ws, channelId);
    }
  }
}

export function broadcastToChannel(channelId: string, message: string) {
  const channel = subscribers.get(channelId);
  if (!channel) return;
  for (const ws of channel) {
    try {
      ws.send(message);
    } catch (err) {
      console.error(`[WS] Broadcast error to channel ${channelId}:`, err);
    }
  }
}
