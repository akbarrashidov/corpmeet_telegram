import { useState } from "react";
import type { Workspace } from "@corpmeet/design/complex";
import { useCurrentWorkspace } from "../hooks/useCurrentWorkspace";
import { useTranslation } from "../i18n";
import { haptic } from "../lib/haptic";
import { CreateWorkspaceForm } from "./CreateWorkspaceForm";
import { CreateRoomForm } from "./CreateRoomForm";

type Mode = "list" | "creating_ws" | "creating_room";

interface Props {
  onOpenSettings: (workspaceId: number) => void;
}

export function WorkspaceSelector({ onOpenSettings }: Props) {
  const { t } = useTranslation();
  const { current, workspaces, selectWorkspace } = useCurrentWorkspace();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  // Workspace, созданный в `creating_ws` — нужен для следующего шага.
  const [createdWs, setCreatedWs] = useState<Workspace | null>(null);

  if (current === null) return null;

  function openModal() {
    haptic();
    setMode("list");
    setCreatedWs(null);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setMode("list");
    setCreatedWs(null);
  }

  function pick(id: number) {
    haptic();
    selectWorkspace(id);
    closeModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="font-heading text-2xl flex items-center gap-1.5 min-w-0"
        aria-label={t("ws_selector.open")}
      >
        <span className="truncate">{current.name}</span>
        <span className="text-sm opacity-70">▾</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 flex items-end sm:items-center justify-center p-4 z-50"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl p-4 w-full max-w-sm flex flex-col gap-2"
            style={{
              background: "var(--modal)",
              color: "var(--text)",
              border: "1px solid var(--border)",
            }}
          >
            {mode === "list" && (
              <>
                <h2 className="font-semibold text-lg mb-1">
                  {t("ws_selector.title")}
                </h2>
                <ul className="flex flex-col gap-1">
                {workspaces.map((w) => {
                  const isSelected = w.id === current.id;
                  return (
                    <li key={w.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => pick(w.id)}
                        className="flex-1 text-left p-3 rounded-lg flex items-center justify-between gap-2 min-w-0"
                        style={{
                          background: isSelected
                            ? "var(--primary-light)"
                            : "var(--surface)",
                          border: `1px solid ${
                            isSelected ? "var(--primary)" : "var(--border)"
                          }`,
                        }}
                      >
                        <span className="truncate">{w.name}</span>
                        {isSelected && <span>✓</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          haptic();
                          selectWorkspace(w.id);
                          setOpen(false);
                          onOpenSettings(w.id);
                        }}
                        aria-label={t("ws_selector.settings_aria", { name: w.name })}
                        className="p-3 rounded-lg flex-shrink-0"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                        }}
                      >
                        ⚙️
                      </button>
                    </li>
                  );
                })}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    haptic();
                    setMode("creating_ws");
                  }}
                  className="rounded-lg p-3 font-semibold mt-1"
                  style={{
                    background: "var(--primary)",
                    color: "white",
                  }}
                >
                  + {t("ws_selector.create_new")}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-2.5 font-medium"
                  style={{
                    background: "var(--surface)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {t("common.cancel")}
                </button>
              </>
            )}

            {mode === "creating_ws" && (
              <>
                <CreateWorkspaceForm
                  onCreated={(ws) => {
                    setCreatedWs(ws);
                    selectWorkspace(ws.id);
                    setMode("creating_room");
                  }}
                />
                <button
                  type="button"
                  onClick={() => setMode("list")}
                  className="rounded-lg p-2.5 font-medium"
                  style={{
                    background: "var(--surface)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {t("common.back")}
                </button>
              </>
            )}

            {mode === "creating_room" && createdWs !== null && (
              <CreateRoomForm
                workspaceId={createdWs.id}
                onCreated={closeModal}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
