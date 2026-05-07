import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { useUsers, type User } from "@corpmeet/design/complex";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

const POSITION_FILTERS: { label: string; apiValue: string }[] = [
  { label: "Начальники", apiValue: "Начальник департамента/отдела" },
  { label: "PM", apiValue: "PM" },
  { label: "Аналитики", apiValue: "Аналитик" },
  { label: "Программисты и др.", apiValue: "Программист и др." },
  { label: "Дизайнеры", apiValue: "Дизайнер" },
];

export function GuestPicker({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: users = [], isLoading } = useUsers(query);
  // Полный список (≤50) — для фильтра по должности; кешируется отдельно.
  const { data: allUsers = [] } = useUsers("");

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const available = users.filter((u) => !value.includes(u.display_name));
  const trimmed = query.trim();
  const canAddManual =
    trimmed.length > 0 &&
    !value.includes(trimmed) &&
    !available.some((u) => u.display_name.toLowerCase() === trimmed.toLowerCase());

  function add(name: string) {
    const clean = name.trim();
    if (!clean || value.includes(clean)) return;
    onChange([...value, clean]);
    setQuery("");
    inputRef.current?.focus();
  }

  function addAllByPosition(apiValue: string) {
    const namesToAdd = allUsers
      .filter((u) => u.position === apiValue)
      .map((u) => u.display_name)
      .filter((name) => !value.includes(name));
    if (namesToAdd.length === 0) return;
    onChange([...value, ...namesToAdd]);
  }

  function remove(name: string) {
    onChange(value.filter((g) => g !== name));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canAddManual) add(trimmed);
      else if (available.length === 1) add(available[0].display_name);
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
      <span className="text-sm">Гости</span>

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
            + {f.label}
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
        {value.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
            style={{ background: "var(--primary)", color: "white" }}
          >
            {name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(name);
              }}
              disabled={disabled}
              aria-label={`Удалить ${name}`}
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
          placeholder={value.length === 0 ? "Добавь гостя" : ""}
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
            <li className="p-3 text-sm opacity-70">Загрузка...</li>
          )}

          {!isLoading &&
            available.map((u: User) => (
              <li
                key={u.id}
                className="p-3 cursor-pointer hover:opacity-70"
                onClick={() => add(u.display_name)}
              >
                {u.display_name}
              </li>
            ))}

          {!isLoading && canAddManual && (
            <li
              className="p-3 cursor-pointer hover:opacity-70 text-sm"
              style={{ color: "var(--primary)" }}
              onClick={() => add(trimmed)}
            >
              + добавить «{trimmed}»
            </li>
          )}

          {!isLoading && available.length === 0 && !canAddManual && (
            <li className="p-3 text-sm opacity-70">Нет пользователей</li>
          )}
        </ul>
      )}
    </div>
  );
}
