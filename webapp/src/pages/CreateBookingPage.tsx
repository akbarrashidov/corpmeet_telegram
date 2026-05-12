import { FormEvent, useState } from "react";
import { useCreateBooking } from "@corpmeet/design/complex";
import { PageHeader } from "../components/PageHeader";
import { GuestPicker, type GuestEntry } from "../components/GuestPicker";
import { defaultStartLocal, defaultEndLocal, localInputToIso } from "../lib/datetime";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { useTranslation } from "../i18n";
import { DateTimePicker } from "../components/DateTimePicker";

interface Props {
  onBack: () => void;
  onCreated: () => void;
  defaultDate?: string;
}

export function CreateBookingPage({ onBack, onCreated, defaultDate }: Props) {
  const { t } = useTranslation();
  const createBooking = useCreateBooking();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStartLocal(defaultDate));
  const [end, setEnd] = useState(defaultEndLocal(defaultDate));
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inTg = !!getTelegram();

  useTgBackButton(onBack);

  async function submit() {
    if (!title.trim()) {
      hapticError();
      setError(t("create.error.title_required"));
      return;
    }
    if (start >= end) {
      hapticError();
      setError(t("create.error.end_after_start"));
      return;
    }
    setError(null);
    haptic();
    try {
      await createBooking.mutateAsync({
        title: title.trim(),
        start_time: localInputToIso(start),
        end_time: localInputToIso(end),
        guests: guests.map((g) => g.value),
      });
      hapticSuccess();
      onCreated();
    } catch {
      hapticError();
      setError(t("create.error.failed"));
    }
  }

  function handleHtmlSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  useTgMainButton({
    text: createBooking.isPending ? "..." : t("create.submit"),
    onClick: () => void submit(),
    disabled: createBooking.isPending,
  });

  const inputStyle = {
    background: "var(--input-bg)",
    border: "1px solid var(--input-border)",
    color: "var(--text)",
  };

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PageHeader title={t("create.title")} onBack={onBack} />

      <form onSubmit={handleHtmlSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm">{t("create.field.name")}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={createBooking.isPending}
            className="rounded-lg p-3 outline-none"
            style={inputStyle}
          />
        </label>

        <DateTimePicker
          label={t("create.field.start")}
          value={start}
          onChange={setStart}
        />

        <DateTimePicker
          label={t("create.field.end")}
          value={end}
          onChange={setEnd}
        />

        <GuestPicker
          value={guests}
          onChange={setGuests}
          disabled={createBooking.isPending}
        />

        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {!inTg && (
          <button
            type="submit"
            disabled={createBooking.isPending}
            className="mt-2 rounded-lg p-3 font-semibold"
            style={{
              background: "var(--primary)",
              color: "white",
              opacity: createBooking.isPending ? 0.5 : 1,
            }}
          >
            {createBooking.isPending ? "..." : t("create.submit")}
          </button>
        )}
      </form>
    </div>
  );
}
