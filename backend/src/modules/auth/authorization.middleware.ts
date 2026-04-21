import type { RequestHandler } from "express";

import type { Role } from "../../domain/enums.js";
import { AppError } from "../../lib/http-errors.js";

const rolePriority: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  reviewer: 2,
  campaign_manager: 3,
  workspace_admin: 4,
};

export function requireRoleAtLeast(requiredRole: Role): RequestHandler {
  return (request, _response, next) => {
    const principal = request.auth;

    if (!principal) {
      return next(new AppError(401, "authorization_required", "An authenticated user is required for this API."));
    }

    if (rolePriority[principal.role] < rolePriority[requiredRole]) {
      return next(
        new AppError(403, "insufficient_role", `This endpoint requires ${requiredRole} access or higher.`, {
          requiredRole,
          currentRole: principal.role,
        }),
      );
    }

    return next();
  };
}
