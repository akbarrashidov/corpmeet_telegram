export type HomeTab = "today" | "mine" | "invited";

interface Props {
  active: HomeTab;
  onChange: (tab: HomeTab) => void;
}

const TABS: { id: HomeTab; label: string }[] = [
  { id: "today", label: "День" },
  { id: "mine", label: "Мои" },
  { id: "invited", label: "Приглашён" },
];

export function HomeChips({ active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition"
            style={{
              background: isActive ? "var(--primary)" : "var(--surface)",
              color: isActive ? "white" : "var(--text)",
              border: `1px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
