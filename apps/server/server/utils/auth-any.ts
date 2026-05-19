import { authenticateUser, ResponseError } from "./auth";
import { authenticateMachine } from "./machine";

export async function authenticateEvent(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer sk_slock_")) {
    const machine = await authenticateMachine(req);
    return { type: "machine" as const, value: machine };
  }

  try {
    const user = await authenticateUser(req);
    return { type: "user" as const, value: user };
  } catch {
    throw new ResponseError(401, "Unauthorized: Invalid session or machine key");
  }
}
