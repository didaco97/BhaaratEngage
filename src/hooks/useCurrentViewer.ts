import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useCurrentViewer() {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.getDashboardSnapshot,
    staleTime: 30_000,
  });

  return {
    ...dashboardQuery,
    viewer: dashboardQuery.data?.viewer,
    workspace: dashboardQuery.data?.workspace,
  };
}
