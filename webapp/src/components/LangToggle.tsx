import { useTranslation, type Lang } from "../i18n";

const FLAGS: { lang: Lang; emoji: string; label: string }[] = [
  { lang: "uz", emoji: "🇺🇿", label: "O'zbek" },
  { lang: "ru", emoji: "🇷🇺", label: "Русский" },
];

export function LangToggle() {
  const { lang, setLang } = useTranslation();
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {FLAGS.map((f) => {
        const selected = lang === f.lang;
        return (
          <button
            key={f.lang}
            type="button"
            onClick={() => setLang(f.lang)}
            aria-label={f.label}
            aria-pressed={selected}
            className="w-8 h-8 rounded-full flex items-center justify-center text-base transition"
            style={{
              border: `1px solid ${selected ? "var(--primary)" : "var(--input-border)"}`,
              opacity: selected ? 1 : 0.5,
              background: "var(--surface)",
            }}
          >
            {f.emoji}
          </button>
        );
      })}
    </div>
  );
}
