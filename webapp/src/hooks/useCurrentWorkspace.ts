import { useEffect } from "react";
import type { Workspace } from "@corpmeet/design/complex";
import { useWorkspaces } from "./useWorkspaces";
import {
  setCurrentWorkspaceId,
  useCurrentWorkspaceId,
} from "../lib/currentWorkspace";

/**
 * Текущий выбранный workspace. Если в localStorage пусто или указанный
 * workspace больше не в списке моих — авто-фоллбэк на первый workspace.
 */
export function useCurrentWorkspace(): {
  current: Workspace | null;
  workspaces: Workspace[];
  selectWorkspace: (id: number) => void;
  isLoading: boolean;
} {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const currentId = useCurrentWorkspaceId();

  const current =
    workspaces.find((w) => w.id === currentId) ?? workspaces[0] ?? null;

  // Auto-correct stored id если он невалидный для текущего набора workspaces
  useEffect(() => {
    if (workspaces.length === 0) return;
    if (currentId === null || !workspaces.find((w) => w.id === currentId)) {
      setCurrentWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, currentId]);

  return {
    current,
    workspaces,
    selectWorkspace: setCurrentWorkspaceId,
    isLoading,
  };
}
