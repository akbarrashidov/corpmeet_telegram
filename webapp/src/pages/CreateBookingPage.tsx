import { FormEvent, useState } from "react";
import { useCreateBooking } from "@corpmeet/design/complex";
import { PageHeader } from "../components/PageHeader";
import { GuestPicker } from "../components/GuestPicker";
import { defaultStartLocal, defaultEndLocal, localInputToIso } from "../lib/datetime";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";

interface Props {
  onBack: () => void;
  onCreated: () => void;
}

export function CreateBookingPage({ onBack, onCreated }: Props) {
  const createBooking = useCreateBooking();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStartLocal());
  const [end, setEnd] = useState(defaultEndLocal());
  const [guests, setGuests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inTg = !!getTelegram();

  useTgBackButton(onBack);

  async function submit() {
    if (!title.trim()) {
      hapticError();
      setError("Назови встречу.");
      return;
    }
    if (start >= end) {
      hapticError();
      setError("Конец должен быть позже начала.");
      return;
    }
    setError(null);
    haptic();
    try {
      await createBooking.mutateAsync({
        title: title.trim(),
        start_time: localInputToIso(start),
        end_time: localInputToIso(end),
        guests,
      });
      hapticSuccess();
      onCreated();
    } catch {
      hapticError();
      setError("Не удалось создать встречу. Попробуй ещё.");
    }
  }

  function handleHtmlSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  useTgMainButton({
    text: createBooking.isPending ? "..." : "Создать",
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
      <PageHeader title="Новая встреча" onBack={onBack} />

      <form onSubmit={handleHtmlSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm">Название</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={createBooking.isPending}
            className="rounded-lg p-3 outline-none"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm">Начало</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            disabled={createBooking.isPending}
            className="rounded-lg p-3 outline-none"
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm">Конец</span>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={createBooking.isPending}
            className="rounded-lg p-3 outline-none"
            style={inputStyle}
          />
        </label>

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
            {createBooking.isPending ? "..." : "Создать"}
          </button>
        )}
      </form>
    </div>
  );
}
