import { useState } from "react";
import { apiClient, type Workspace } from "@corpmeet/design/complex";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { CreateWorkspaceForm } from "../components/CreateWorkspaceForm";
import { CreateRoomForm } from "../components/CreateRoomForm";
import { setCurrentWorkspaceId } from "../lib/currentWorkspace";

type Mode = "menu" | "create" | "create_room" | "join" | "search";

interface Props {
  onComplete: () => void;
}

const inputStyle = {
  background: "var(--input-bg)",
  border: "1px solid var(--input-border)",
  color: "var(--text)",
};

export function OnboardingScreen({ onComplete }: Props) {
  const [mode, setMode] = useState<Mode>("menu");
  // workspace, созданный на шаге `create` — нужен для последующего create_room.
  const [createdWs, setCreatedWs] = useState<Workspace | null>(null);

  function backToMenu() {
    haptic();
    setMode("menu");
    setCreatedWs(null);
  }

  // На шаге create_room — Назад не возвращает в меню (workspace уже создан,
  // нельзя его отменить). Просто блокируем.
  useTgBackButton(
    mode === "menu" || mode === "create_room"
      ? null
      : backToMenu,
  );

  function handleJoined() {
    hapticSuccess();
    onComplete();
  }

  if (mode === "menu")
    return <Menu onPick={(m) => { haptic(); setMode(m as Exclude<Mode, "menu" | "create_room">); }} />;

  if (mode === "create") {
    return (
      <div
        className="min-h-screen p-6"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <CreateWorkspaceForm
          onCreated={(ws) => {
            setCreatedWs(ws);
            setCurrentWorkspaceId(ws.id);
            setMode("create_room");
          }}
        />
      </div>
    );
  }

  if (mode === "create_room" && createdWs !== null) {
    return (
      <div
        className="min-h-screen p-6"
        style={{ background: "var(--bg)", color: "var(--text)" }}
      >
        <CreateRoomForm
          workspaceId={createdWs.id}
          onCreated={() => onComplete()}
        />
      </div>
    );
  }

  if (mode === "join") return <JoinForm onJoined={handleJoined} />;
  if (mode === "search") return <SearchForm onJoined={handleJoined} />;
  return null;
}


// ────────────────────────────────────────────────────────────────────────────
// Menu
// ────────────────────────────────────────────────────────────────────────────

function Menu({ onPick }: { onPick: (m: Exclude<Mode, "menu" | "create_room">) => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="min-h-screen p-6 flex flex-col gap-5"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="mt-4">
        <h1 className="font-heading text-2xl">{t("onboarding.title")}</h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-sec)" }}>
          {t("onboarding.subtitle")}
        </p>
      </div>
      <div className="flex flex-col gap-3 mt-2">
        <OptionButton
          title={t("onboarding.create.title")}
          body={t("onboarding.create.body")}
          onClick={() => onPick("create")}
        />
        <OptionButton
          title={t("onboarding.join.title")}
          body={t("onboarding.join.body")}
          onClick={() => onPick("join")}
        />
        <OptionButton
          title={t("onboarding.search.title")}
          body={t("onboarding.search.body")}
          onClick={() => onPick("search")}
        />
      </div>
    </div>
  );
}

function OptionButton({
  title, body, onClick,
}: {
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-4 rounded-xl text-left flex flex-col gap-1"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="font-semibold">{title}</div>
      <div className="text-sm" style={{ color: "var(--text-sec)" }}>{body}</div>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Join by code
// ────────────────────────────────────────────────────────────────────────────

function JoinForm({ onJoined }: { onJoined: () => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!code.trim()) {
      hapticError();
      setError(t("join_ws.error.code_required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/workspaces/join", { invite_code: code.trim() });
      onJoined();
    } catch {
      hapticError();
      setError(t("join_ws.error.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell title={t("join_ws.title")}>
      <Label text={t("join_ws.code.label")}>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("join_ws.code.placeholder")}
          disabled={busy}
          className="w-full rounded-lg p-3 outline-none"
          style={inputStyle}
        />
      </Label>

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      <PrimaryButton onClick={handleSubmit} disabled={busy}>
        {busy ? "..." : t("join_ws.submit")}
      </PrimaryButton>
    </FormShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Search
// ────────────────────────────────────────────────────────────────────────────

function SearchForm({ onJoined }: { onJoined: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Workspace[]>([]);
  const [searching, setSearching] = useState(false);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function runSearch(q: string) {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    try {
      const res = await apiClient.get<Workspace[]>("/api/v1/workspaces/search", {
        params: { q: q.trim() },
      });
      setResults(res.data);
      setHasSearched(true);
    } catch {
      setResults([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleJoin(workspace: Workspace) {
    setJoiningId(workspace.id);
    setError(null);
    try {
      await apiClient.post("/api/v1/workspaces/join", {
        invite_code: workspace.invite_code,
      });
      onJoined();
    } catch {
      hapticError();
      setError(t("join_ws.error.failed"));
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <FormShell title={t("search_ws.title")}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          void runSearch(v);
        }}
        placeholder={t("search_ws.placeholder")}
        className="w-full rounded-lg p-3 outline-none"
        style={inputStyle}
      />

      {!hasSearched && !query.trim() && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("search_ws.empty_query")}
        </p>
      )}

      {hasSearched && results.length === 0 && !searching && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {t("search_ws.no_results")}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {results.map((w) => (
          <li
            key={w.id}
            className="p-3 rounded-lg flex items-center justify-between gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{w.name}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{w.slug}</div>
            </div>
            <button
              type="button"
              onClick={() => void handleJoin(w)}
              disabled={joiningId !== null}
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={{
                background: "var(--primary)",
                color: "white",
                opacity: joiningId !== null ? 0.5 : 1,
              }}
            >
              {joiningId === w.id ? "..." : t("search_ws.submit")}
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
    </FormShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────────────────────

function FormShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen p-6 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <h1 className="font-heading text-2xl mt-2">{title}</h1>
      {children}
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm">{text}</span>
      {children}
    </label>
  );
}

function PrimaryButton({
  onClick, disabled, children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-3 font-semibold mt-2"
      style={{
        background: "var(--primary)",
        color: "white",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
