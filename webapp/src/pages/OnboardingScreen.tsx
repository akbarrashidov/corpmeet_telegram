import { useState } from "react";
import { apiClient, type Workspace } from "@corpmeet/design/complex";
import { useTranslation } from "../i18n";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { CreateWorkspaceForm } from "../components/CreateWorkspaceForm";
import { CreateRoomForm } from "../components/CreateRoomForm";
import { setCurrentWorkspaceId } from "../lib/currentWorkspace";
import { getTelegram } from "../lib/telegram";

type Mode = "menu" | "create" | "create_room" | "join" | "search" | "pending_sent";

interface JoinResponse {
  workspace_id: number;
  status: "active" | "pending";
}

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
  const [createdWs, setCreatedWs] = useState<Workspace | null>(null);
  const [pendingWsName, setPendingWsName] = useState<string | null>(null);

  function backToMenu() {
    haptic();
    setMode("menu");
    setCreatedWs(null);
    setPendingWsName(null);
  }

  // На шагах create_room и pending_sent — Назад не возвращает в меню.
  useTgBackButton(
    mode === "menu" || mode === "create_room" || mode === "pending_sent"
      ? null
      : backToMenu,
  );

  function handleResult(status: "active" | "pending", workspaceName: string | null) {
    if (status === "pending") {
      haptic();
      setPendingWsName(workspaceName);
      setMode("pending_sent");
    } else {
      hapticSuccess();
      onComplete();
    }
  }

  if (mode === "menu")
    return <Menu onPick={(m) => { haptic(); setMode(m as Exclude<Mode, "menu" | "create_room" | "pending_sent">); }} />;

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

  if (mode === "join") return <JoinForm onResult={handleResult} />;
  if (mode === "search") return <SearchForm onResult={handleResult} />;
  if (mode === "pending_sent")
    return <PendingSentScreen workspaceName={pendingWsName} />;
  return null;
}


// ────────────────────────────────────────────────────────────────────────────
// Menu
// ────────────────────────────────────────────────────────────────────────────

function Menu({ onPick }: { onPick: (m: Exclude<Mode, "menu" | "create_room" | "pending_sent">) => void }) {
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

function JoinForm({
  onResult,
}: {
  onResult: (status: "active" | "pending", workspaceName: string | null) => void;
}) {
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
      const res = await apiClient.post<JoinResponse>(
        "/api/v1/workspaces/join",
        { invite_code: code.trim() },
      );
      const status = res.data?.status ?? "active";
      let wsName: string | null = null;
      if (status === "pending" && res.data?.workspace_id) {
        // Подгрузим список workspace'ов юзера и найдём только что вступленный
        // по id — чтобы показать его имя на экране «Заявка отправлена».
        try {
          const wsRes = await apiClient.get<Workspace[]>("/api/v1/workspaces");
          wsName = wsRes.data.find((w) => w.id === res.data.workspace_id)?.name ?? null;
        } catch {
          // если /workspaces упал — покажем без имени, не блокируем флоу
        }
      }
      onResult(status, wsName);
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

function SearchForm({
  onResult,
}: {
  onResult: (status: "active" | "pending", workspaceName: string | null) => void;
}) {
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
      const res = await apiClient.post<JoinResponse>(
        "/api/v1/workspaces/join",
        { invite_code: workspace.invite_code },
      );
      const status = res.data?.status ?? "active";
      // У нас уже есть workspace.name из списка результатов поиска
      onResult(status, workspace.name);
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
// Pending sent — экран после успешного pending join'а
// ────────────────────────────────────────────────────────────────────────────

function PendingSentScreen({ workspaceName }: { workspaceName: string | null }) {
  const { t } = useTranslation();

  function handleClose() {
    haptic();
    const tg = getTelegram();
    if (tg) tg.close();
  }

  const body = workspaceName
    ? t("pending_sent.body_named", { name: workspaceName })
    : t("pending_sent.body");

  return (
    <div
      className="min-h-screen p-6 flex flex-col items-center justify-center gap-5"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="text-6xl" aria-hidden>⌛</div>
      <h1 className="font-heading text-2xl text-center">
        {t("pending_sent.title")}
      </h1>
      <p
        className="text-sm text-center max-w-sm"
        style={{ color: "var(--text-sec)" }}
      >
        {body}
      </p>
      <button
        type="button"
        onClick={handleClose}
        className="rounded-lg p-3 font-semibold w-full max-w-sm"
        style={{ background: "var(--primary)", color: "white" }}
      >
        {t("pending_sent.button")}
      </button>
    </div>
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
