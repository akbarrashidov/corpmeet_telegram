import { useAuth, useBookings, useActiveBookings, type Booking } from "@corpmeet/design/complex";
import { HomeChips, type HomeTab } from "../components/HomeChips";
import { DateStrip } from "../components/DateStrip";
import { BookingsList } from "../components/BookingsList";
import { useInvitedBookings } from "../hooks/useInvitedBookings";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { todayIso } from "../lib/datetime";
import { sortByStart } from "../lib/booking-filter";
import { getTelegram } from "../lib/telegram";
import { haptic } from "../lib/haptic";

interface Props {
  tab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onCreate: () => void;
  onSelect: (booking: Booking) => void;
  onProfile: () => void;
}

export function HomePage({
  tab,
  onTabChange,
  selectedDate,
  onDateChange,
  onCreate,
  onSelect,
  onProfile,
}: Props) {
  const { user } = useAuth();
  const today = todayIso();
  const inTg = !!getTelegram();

  const dayQuery = useBookings(selectedDate);
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

  const handleProfile = () => {
    haptic();
    onProfile();
  };

  const dayEmptyMessage =
    selectedDate === today
      ? "Сегодня встреч не запланировано."
      : "На этот день встреч нет.";

  const renderList = () => {
    switch (tab) {
      case "today":
        return (
          <BookingsList
            bookings={dayQuery.data ? sortByStart(dayQuery.data) : undefined}
            isLoading={dayQuery.isLoading}
            emptyMessage={dayEmptyMessage}
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
      <header className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">CorpMeet</h1>
        <button
          type="button"
          onClick={handleProfile}
          aria-label="Редактировать профиль"
          className="text-2xl leading-none px-2"
        >
          👤
        </button>
      </header>

      <DateStrip selectedDate={selectedDate} onChange={onDateChange} />

      <HomeChips active={tab} onChange={onTabChange} />

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
