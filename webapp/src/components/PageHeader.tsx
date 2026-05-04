import { getTelegram } from "../lib/telegram";

interface Props {
  title: string;
  onBack?: () => void;
}

export function PageHeader({ title, onBack }: Props) {
  const inTg = !!getTelegram();
  const showHtmlBack = onBack && !inTg;

  return (
    <header className="flex items-center gap-3 -mx-4 px-4 pb-2">
      {showHtmlBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="text-2xl leading-none"
          style={{ color: "var(--text)" }}
        >
          ←
        </button>
      )}
      <h1 className="font-heading text-xl">{title}</h1>
    </header>
  );
}
