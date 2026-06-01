import { useTranslation, type TranslationKey } from "../i18n";
import { haptic } from "../lib/haptic";

export type SettingsTabId =
  | "general"
  | "rooms"
  | "positions"
  | "invitations"
  | "members";

const LABEL_KEY: Record<SettingsTabId, TranslationKey> = {
  general: "ws_settings.section.general",
  rooms: "ws_settings.section.rooms",
  positions: "ws_settings.section.positions",
  invitations: "ws_settings.section.invitations",
  members: "ws_settings.section.members",
};

interface Props {
  tabs: SettingsTabId[];
  current: SettingsTabId;
  onChange: (id: SettingsTabId) => void;
  /** Бейджи с числом на табах (например, count pending заявок). */
  badges?: Partial<Record<SettingsTabId, number>>;
}

/** Горизонтальный таб-свитч для WorkspaceSettingsScreen. */
export function SettingsTabs({ tabs, current, onChange, badges }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex gap-1 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--border)" }}
      role="tablist"
    >
      {tabs.map((id) => {
        const active = id === current;
        const badge = badges?.[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) {
                haptic();
                onChange(id);
              }
            }}
            className="px-3 py-2.5 text-sm font-medium whitespace-nowrap inline-flex items-center"
            style={{
              color: active ? "var(--primary)" : "var(--text-sec)",
              borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
              marginBottom: "-1px",
            }}
          >
            {t(LABEL_KEY[id])}
            {badge !== undefined && badge > 0 && (
              <span
                aria-hidden
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
