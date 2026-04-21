import type { Role } from "@/lib/api-contracts";

const rolePriority: Record<Role, number> = {
  viewer: 0,
  operator: 1,
  reviewer: 2,
  campaign_manager: 3,
  workspace_admin: 4,
};

export function hasRoleAtLeast(role: Role | null | undefined, requiredRole: Role) {
  if (!role) {
    return false;
  }

  return rolePriority[role] >= rolePriority[requiredRole];
}

export function describeRoleRequirement(requiredRole: Role) {
  switch (requiredRole) {
    case "workspace_admin":
      return "workspace admin access";
    case "campaign_manager":
      return "campaign manager access";
    case "reviewer":
      return "reviewer access";
    case "operator":
      return "operator access";
    default:
      return "viewer access";
  }
}
