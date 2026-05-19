import { auth } from "../lib/auth";

export class ResponseError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ResponseError";
  }
}

export async function authenticateUser(req: Request) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  if (!session) {
    throw new ResponseError(401, "Unauthorized: Missing or invalid User Session");
  }
  return session.user;
}
