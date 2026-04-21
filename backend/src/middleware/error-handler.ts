import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError } from "../lib/http-errors.js";
import { logger } from "../lib/logger.js";

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return response.status(400).json({
      error: {
        code: "validation_error",
        message: "The request payload did not match the expected schema.",
        issues: error.flatten(),
      },
    });
  }

  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  logger.error({ error }, "Unhandled server error");

  return response.status(500).json({
    error: {
      code: "internal_server_error",
      message: "An unexpected error occurred.",
    },
  });
}
