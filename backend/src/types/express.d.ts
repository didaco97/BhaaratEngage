import type { RequestPrincipal } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: RequestPrincipal;
    }
  }
}

export {};
