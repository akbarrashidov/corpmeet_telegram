import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { storage } from "../storage";
import type { User } from "../types";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["me"],
    queryFn: authApi.getMe,
    enabled: !!storage.getToken(),
    retry: false,
  });

  const setToken = async (token: string) => {
    storage.setToken(token);
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  const logout = () => {
    storage.removeToken();
    queryClient.clear();
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    setToken,
    logout,
  };
}
