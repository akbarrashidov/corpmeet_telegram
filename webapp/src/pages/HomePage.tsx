import { useState } from "react";
import { useAuth, useBookings, useActiveBookings, type Booking } from "@corpmeet/design/complex";
import { HomeChips, type HomeTab } from "../components/HomeChips";
import { BookingsList } from "../components/BookingsList";
import { useInvitedBookings } from "../hooks/useInvitedBookings";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { todayIso, formatDayMonth } from "../lib/datetime";
import { sortByStart } from "../lib/booking-filter";
import { getTelegram } from "../lib/telegram";
import { haptic } from "../lib/haptic";

interface Props {
  onCreate: () => void;
  onSelect: (booking: Booking) => void;
}

export function HomePage({ onCreate, onSelect }: Props) {
  const [tab, setTab] = useState<HomeTab>("today");
  const { user } = useAuth();
  const today = todayIso();
  const inTg = !!getTelegram();

  const todayQuery = useBookings(today);
  const mineQuery = useActiveBookings();
  const invitedQuery = useInvitedBookings(user);

  // На Home — back ничего не делает (это корневой экран)
  useTgBackButton(null);

  const handleCreate = () => {
    haptic();
    onCreate();
  };

  useTgMainButton({ text: "Забронировать", onClick: handleCreate });

  const handleSelect = (b: Booking) => {
    haptic();
    onSelect(b);
  };

  const renderList = () => {
    switch (tab) {
      case "today":
        return (
          <BookingsList
            bookings={todayQuery.data ? sortByStart(todayQuery.data) : undefined}
            isLoading={todayQuery.isLoading}
            emptyMessage="Сегодня встреч не запланировано."
            onSelect={handleSelect}
          />
        );
      case "mine":
        return (
          <BookingsList
            bookings={mineQuery.data ? sortByStart(mineQuery.data) : undefined}
            isLoading={mineQuery.isLoading}
            emptyMessage="У тебя нет ближайших встреч."
            onSelect={handleSelect}
          />
        );
      case "invited":
        return (
          <BookingsList
            bookings={invitedQuery.data}
            isLoading={invitedQuery.isLoading}
            emptyMessage="Тебя пока никуда не зовут."
            invitedBadge
            onSelect={handleSelect}
          />
        );
    }
  };

  return (
    <div
      className="min-h-screen p-4 flex flex-col gap-4 relative"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl">CorpMeet</h1>
        <p className="text-sm" style={{ color: "var(--text-sec)" }}>
          Сегодня · {formatDayMonth(today)}
        </p>
      </header>

      <HomeChips active={tab} onChange={setTab} />

      <div className="flex-1">{renderList()}</div>

      {!inTg && (
        <button
          type="button"
          onClick={handleCreate}
          aria-label="Забронировать"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-2xl font-bold shadow-lg"
          style={{ background: "var(--primary)", color: "white" }}
        >
          +
        </button>
      )}
    </div>
  );
}
