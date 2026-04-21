import type { ReactNode } from "react";

import PageStateCard from "@/components/PageStateCard";
import { useCurrentViewer } from "@/hooks/useCurrentViewer";
import { describeRoleRequirement, hasRoleAtLeast } from "@/lib/access-control";
import type { Role } from "@/lib/api-contracts";

interface RequireRoleProps {
  readonly minimumRole: Role;
  readonly children: ReactNode;
}

export default function RequireRole({ minimumRole, children }: RequireRoleProps) {
  const viewerQuery = useCurrentViewer();

  if (viewerQuery.isPending && !viewerQuery.viewer) {
    return <PageStateCard title="Checking access" description="Resolving your workspace role before opening this surface." />;
  }

  if (viewerQuery.error) {
    return (
      <PageStateCard
        title="Access check unavailable"
        description={viewerQuery.error instanceof Error ? viewerQuery.error.message : "Your workspace role could not be loaded."}
      />
    );
  }

  if (!hasRoleAtLeast(viewerQuery.viewer?.role, minimumRole)) {
    return (
      <PageStateCard
        title="Access restricted"
        description={`This surface requires ${describeRoleRequirement(minimumRole)} or higher.`}
      />
    );
  }

  return <>{children}</>;
}
