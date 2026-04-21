import type { Request, Response } from "express";

export function notFoundHandler(request: Request, response: Response) {
  return response.status(404).json({
    error: {
      code: "not_found",
      message: `No route matched ${request.method} ${request.originalUrl}.`,
    },
  });
}
