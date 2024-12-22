import type { Context } from "elysia";
import type { JWTPayloadSpec } from "@elysiajs/jwt";

interface AuthContext extends Context {
  jwt: {
    sign: (
      payload: Record<string, string | number> & JWTPayloadSpec
    ) => Promise<string>;
    verify: (jwt?: string) => Promise<boolean>;
  };
}

export const verifyAuth = async ({ headers, set, jwt }: AuthContext) => {
  const auth = headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    set.status = 401;
    throw new Error("Missing authorization token");
  }

  const token = auth.slice(7);
  const isValid = await jwt.verify(token);
  if (!isValid) {
    set.status = 401;
    throw new Error("Invalid token");
  }
};
