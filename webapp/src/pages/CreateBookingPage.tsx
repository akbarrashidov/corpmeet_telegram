import { FormEvent, useEffect, useRef, useState } from "react";
import { apiClient, useCreateBooking, type SlotResponse } from "@corpmeet/design/complex";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { GuestPicker, type GuestEntry } from "../components/GuestPicker";
import {
  defaultStartLocal,
  defaultEndLocal,
  isoToLocalInput,
  localInputToIso,
  todayIso,
} from "../lib/datetime";
import { findNextFreeSlot } from "../lib/findNextFreeSlot";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { useWorkspaceRooms } from "../hooks/useWorkspaceRooms";
import { useCurrentWorkspaceId } from "../lib/currentWorkspace";
import { getTelegram } from "../lib/telegram";
import { haptic, hapticError, hapticSuccess } from "../lib/haptic";
import { useTranslation } from "../i18n";
import { DateTimePicker } from "../components/DateTimePicker";

const ONE_HOUR_MS = 60 * 60 * 1000;

interface Props {
  onBack: () => void;
  onCreated: () => void;
  onOpenSettings: (workspaceId: number) => void;
  defaultDate?: string;
}

export function CreateBookingPage({
  onBack, onCreated, onOpenSettings, defaultDate,
}: Props) {
  const { t } = useTranslation();
  const createBooking = useCreateBooking();
  const currentWsId = useCurrentWorkspaceId();
  const { data: rooms, isLoading: roomsLoading } = useWorkspaceRooms();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(defaultStartLocal(defaultDate));
  const [end, setEnd] = useState(defaultEndLocal(defaultDate));
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inTg = !!getTelegram();
  // Если юзер сам поменял время — не подменяем дефолт когда подгрузятся slots.
  const userChangedTimeRef = useRef(false);

  useTgBackButton(onBack);

  // Подгружаем слоты для выбранной даты, чтобы дефолт времени = ближайший
  // свободный (а не статическое 09:00).
  const dateForSlots = defaultDate ?? todayIso();
  const { data: slots } = useQuery<SlotResponse[]>({
    queryKey: ["slots", dateForSlots],
    queryFn: async () => {
      const res = await apiClient.get<SlotResponse[]>("/api/v1/slots", {
        params: { date: dateForSlots },
      });
      return res.data;
    },
    staleTime: 30_000,
  });

  // Когда slots пришли и юзер ещё ничего не менял — берём ближайший свободный
  // слот в 1 час. Если свободного нет — оставляем фолбэк 09:00.
  useEffect(() => {
    if (!slots || userChangedTimeRef.current) return;
    // Якорим "now" на 00:00 выбранной даты для будущих дней; на реальный now
    // для сегодняшней — чтобы пропустить уже прошедшие слоты.
    const anchor = dateForSlots === todayIso()
      ? new Date()
      : new Date(dateForSlots + "T00:00:00");
    const plan = findNextFreeSlot(slots, ONE_HOUR_MS, anchor);
    if (plan === null) return;
    setStart(isoToLocalInput(plan.start));
    setEnd(isoToLocalInput(plan.end));
  }, [slots, dateForSlots]);

  // Авто-выбор первой комнаты как только подгрузился список.
  useEffect(() => {
    if (roomId !== null) return;
    if (!rooms || rooms.length === 0) return;
    setRoomId(rooms[0].room.id);
  }, [rooms, roomId]);

  const noRooms = !roomsLoading && (rooms?.length ?? 0) === 0;

  function handleStartChange(v: string) {
    userChangedTimeRef.current = true;
    setStart(v);
  }

  function handleEndChange(v: string) {
    userChangedTimeRef.current = true;
    setEnd(v);
  }

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
    if (currentWsId === null) {
      hapticError();
      setError(t("create.error.no_workspace"));
      return;
    }
    if (roomId === null) {
      hapticError();
      setError(t("create.error.room_required"));
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
        workspace_id: currentWsId,
        room_id: roomId,
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

  const submitDisabled = createBooking.isPending || noRooms;

  useTgMainButton({
    text: createBooking.isPending ? "..." : t("create.submit"),
    onClick: () => void submit(),
    disabled: submitDisabled,
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

        <label className="flex flex-col gap-2">
          <span className="text-sm">{t("create.room.label")}</span>
          {noRooms ? (
            <div
              className="p-3 rounded-lg flex flex-col gap-2"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-sec)" }}>
                {t("create.room.empty_body")}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (currentWsId !== null) onOpenSettings(currentWsId);
                }}
                className="rounded-lg p-2.5 font-semibold text-sm"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {t("create.room.empty_cta")}
              </button>
            </div>
          ) : (
            <select
              value={roomId ?? ""}
              onChange={(e) => setRoomId(parseInt(e.target.value, 10))}
              disabled={
                createBooking.isPending ||
                roomsLoading ||
                (rooms?.length ?? 0) <= 1
              }
              className="w-full rounded-lg p-3 outline-none"
              style={inputStyle}
            >
              {roomsLoading && <option value="">...</option>}
              {(rooms ?? []).map((wr) => (
                <option key={wr.room.id} value={wr.room.id}>
                  {wr.room.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <DateTimePicker
          label={t("create.field.start")}
          value={start}
          onChange={handleStartChange}
        />

        <DateTimePicker
          label={t("create.field.end")}
          value={end}
          onChange={handleEndChange}
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
            disabled={submitDisabled}
            className="mt-2 rounded-lg p-3 font-semibold"
            style={{
              background: "var(--primary)",
              color: "white",
              opacity: submitDisabled ? 0.5 : 1,
            }}
          >
            {createBooking.isPending ? "..." : t("create.submit")}
          </button>
        )}
      </form>
    </div>
  );
}
