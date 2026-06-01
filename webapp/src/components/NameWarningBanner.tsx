import { useAuth } from "@corpmeet/design/complex";
import { useTranslation } from "../i18n";
import { haptic } from "../lib/haptic";

interface Props {
  onOpenProfile: () => void;
}

/**
 * Жёлтое предупреждение «Не заполнено имя или фамилия» с CTA «Указать».
 *
 * Условия отображения:
 *  - есть авторизованный user
 *  - first_name ИЛИ last_name пустые/null
 *
 * Источник истины — БД (через useAuth().user, который держит /auth/me).
 * Не зависит от Telegram-полей: юзер мог в Mini App ввести имя/фамилию
 * отличные от TG-настроек.
 */
export function NameWarningBanner({ onOpenProfile }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) return null;

  const first = (user.first_name ?? "").trim();
  const last = (user.last_name ?? "").trim();
  if (first && last) return null;

  function handleClick() {
    haptic();
    onOpenProfile();
  }

  return (
    <div
      role="alert"
      className="p-3 rounded-lg flex items-center justify-between gap-3"
      style={{
        background: "rgba(234, 179, 8, 0.12)",
        border: "1px solid rgba(234, 179, 8, 0.4)",
        color: "var(--text)",
      }}
    >
      <span className="text-sm flex-1">
        ⚠️ {t("name_warning.message")}
      </span>
      <button
        type="button"
        onClick={handleClick}
        className="rounded-lg px-3 py-1.5 text-sm font-medium flex-shrink-0"
        style={{
          background: "rgb(234, 179, 8)",
          color: "white",
        }}
      >
        {t("name_warning.button")}
      </button>
    </div>
  );
}
