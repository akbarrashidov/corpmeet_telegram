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
}

/** Горизонтальный таб-свитч для WorkspaceSettingsScreen.
 *
 * Какие табы рендерить — решает parent через RBAC.
 * Активный таб — primary underline.
 */
export function SettingsTabs({ tabs, current, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="flex gap-1 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--border)" }}
      role="tablist"
    >
      {tabs.map((id) => {
        const active = id === current;
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
            className="px-3 py-2.5 text-sm font-medium whitespace-nowrap"
            style={{
              color: active ? "var(--primary)" : "var(--text-sec)",
              borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
              marginBottom: "-1px",
            }}
          >
            {t(LABEL_KEY[id])}
          </button>
        );
      })}
    </div>
  );
}
