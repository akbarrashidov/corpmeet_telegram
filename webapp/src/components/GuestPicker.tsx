import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@corpmeet/design/complex";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";
import { useWorkspaceDetail } from "../hooks/useWorkspaceDetail";
import { useTranslation, type TranslationKey } from "../i18n";

export interface GuestEntry {
  /** То, что показывается в chip-е (например, "Artem Iskra") */
  label: string;
  /** То, что отправляется на бекенд (username без @, либо fallback на label) */
  value: string;
}

interface Props {
  value: GuestEntry[];
  onChange: (next: GuestEntry[]) => void;
  disabled?: boolean;
}

/** Минимальная форма user'а для GuestPicker — то, что приходит в WorkspaceMember.user. */
type GuestUser = {
  id: number;
  display_name: string;
  username: string | null;
  position: string | null;
};

const POSITION_FILTERS: { labelKey: TranslationKey; apiValue: string }[] = [
  { labelKey: "create.position_filter.heads", apiValue: "Начальник департамента/отдела" },
  { labelKey: "create.position_filter.pm", apiValue: "PM" },
  { labelKey: "create.position_filter.analysts", apiValue: "Аналитик" },
  { labelKey: "create.position_filter.devs", apiValue: "Программист и др." },
  { labelKey: "create.position_filter.designers", apiValue: "Дизайнер" },
];

function entryFromUser(u: GuestUser): GuestEntry {
  return {
    label: u.display_name,
    value: u.username ?? u.display_name,
  };
}

/**
 * GuestPicker — выбор гостей встречи.
 *
 * Скоупит поиск **только участниками текущего workspace'а**: использует
 * `useWorkspaceDetail(currentWsId).members`, фильтрует на клиенте.
 * Free-text guests (например «все PM» не из workspace) всё ещё можно добавить
 * через manual-add (canAddManual).
 */
export function GuestPicker({ value, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wsId = useCurrentWorkspaceId();
  const { data: wsDetail, isLoading } = useWorkspaceDetail(wsId);
  const { user: currentUser } = useAuth();

  // Активные участники с реальным user-аккаунтом (без pending invites).
  // Исключаем самого организатора — он и так в встрече, нельзя его в гости.
  const allUsers = useMemo<GuestUser[]>(
    () => (wsDetail?.members ?? [])
      .filter((m) => m.status === "active" && m.user !== null)
      .filter((m) => m.user!.id !== currentUser?.id)
      .map((m) => m.user!),
    [wsDetail, currentUser?.id],
  );

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const valueValues = new Set(value.map((g) => g.value));
  const valueLabels = new Set(value.map((g) => g.label));

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const matchedByQuery = trimmed === ""
    ? allUsers
    : allUsers.filter((u) => {
        if (u.display_name.toLowerCase().includes(lower)) return true;
        if (u.username && u.username.toLowerCase().includes(lower)) return true;
        return false;
      });
  const available = matchedByQuery.filter(
    (u) => !valueValues.has(u.username ?? u.display_name),
  );

  const canAddManual =
    trimmed.length > 0 &&
    !valueLabels.has(trimmed) &&
    !available.some((u) => u.display_name.toLowerCase() === lower);

  function addEntry(entry: GuestEntry) {
    if (!entry.value || valueValues.has(entry.value)) return;
    onChange([...value, entry]);
    setQuery("");
    inputRef.current?.focus();
  }

  function addUser(u: GuestUser) {
    addEntry(entryFromUser(u));
  }

  function addManual(text: string) {
    const clean = text.trim();
    if (!clean) return;
    addEntry({ label: clean, value: clean });
  }

  function addAllByPosition(apiValue: string) {
    const toAdd = allUsers
      .filter((u) => u.position === apiValue)
      .map(entryFromUser)
      .filter((entry) => !valueValues.has(entry.value));
    if (toAdd.length === 0) return;
    onChange([...value, ...toAdd]);
  }

  function remove(entry: GuestEntry) {
    onChange(value.filter((g) => g.value !== entry.value));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canAddManual) addManual(trimmed);
      else if (available.length === 1) addUser(available[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  }

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-2 relative">
      <span className="text-sm">{t("create.guests")}</span>

      <div className="flex flex-wrap gap-2">
        {POSITION_FILTERS.map((f) => (
          <button
            key={f.apiValue}
            type="button"
            onClick={() => addAllByPosition(f.apiValue)}
            disabled={disabled}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition"
            style={{
              background: "var(--input-bg)",
              color: "var(--text)",
              border: "1px solid var(--input-border)",
            }}
          >
            + {t(f.labelKey)}
          </button>
        ))}
      </div>

      <div
        className="rounded-lg p-2 flex flex-wrap gap-2 min-h-[3rem] cursor-text"
        style={inputStyle}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {value.map((entry) => (
          <span
            key={entry.value}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
            style={{ background: "var(--primary)", color: "white" }}
          >
            {entry.label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(entry);
              }}
              disabled={disabled}
              aria-label={`${t("common.remove")} ${entry.label}`}
              className="ml-1 leading-none"
            >
              ✕
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={value.length === 0 ? t("create.guests.placeholder") : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none p-1"
        />
      </div>

      {open && (
        <ul
          className="absolute top-full left-0 right-0 mt-1 z-20 max-h-60 overflow-y-auto rounded-lg shadow-lg"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--input-border)",
          }}
        >
          {isLoading && (
            <li className="p-3 text-sm opacity-70">{t("create.guests.loading")}</li>
          )}

          {!isLoading &&
            available.map((u) => (
              <li
                key={u.id}
                className="p-3 cursor-pointer hover:opacity-70"
                onClick={() => addUser(u)}
              >
                {u.display_name}
              </li>
            ))}

          {!isLoading && canAddManual && (
            <li
              className="p-3 cursor-pointer hover:opacity-70 text-sm"
              style={{ color: "var(--primary)" }}
              onClick={() => addManual(trimmed)}
            >
              {t("create.guests.add_manual", { value: trimmed })}
            </li>
          )}

          {!isLoading && available.length === 0 && !canAddManual && (
            <li className="p-3 text-sm opacity-70">{t("create.guests.no_users")}</li>
          )}
        </ul>
      )}
    </div>
  );
}
