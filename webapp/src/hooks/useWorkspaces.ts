import { useQuery } from "@tanstack/react-query";
import { apiClient, type Workspace } from "@corpmeet/design/complex";

/**
 * Список workspace'ов текущего пользователя (где он active member).
 * Returns с полем my_role: owner | admin | member | null.
 */
export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: ["workspaces", "mine"],
    queryFn: async () => {
      const res = await apiClient.get<Workspace[]>("/api/v1/workspaces");
      return res.data;
    },
    staleTime: 60_000,
  });
}
