import { useAuth, type Booking } from "@corpmeet/design/complex";
import { HomeChips, type HomeTab } from "../components/HomeChips";
import { DateStrip } from "../components/DateStrip";
import { BookingsList } from "../components/BookingsList";
import { useInvitedBookings } from "../hooks/useInvitedBookings";
import { useMyBookings } from "../hooks/useMyBookings";
import { useDayBookings } from "../hooks/useDayBookings";
import { useTgMainButton } from "../hooks/useTgMainButton";
import { useTgBackButton } from "../hooks/useTgBackButton";
import { todayIso } from "../lib/datetime";
import { sortByStart } from "../lib/booking-filter";
import { getTelegram } from "../lib/telegram";
import { haptic } from "../lib/haptic";
import { useTranslation, type TranslationKey } from "../i18n";
import { LangToggle } from "../components/LangToggle";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { useDatesWithBookings } from "../hooks/useDatesWithBookings";
import { addDaysIso } from "../lib/datetime";

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
  const { t } = useTranslation();
  const today = todayIso();
  const stripFrom = addDaysIso(today, -3);
  const stripTo = addDaysIso(today, 30);
  const { data: markedDates } = useDatesWithBookings(stripFrom, stripTo);
  const inTg = !!getTelegram();
  const monthKeys: TranslationKey[] = [
    "month.january", "month.february", "month.march", "month.april",
    "month.may", "month.june", "month.july", "month.august",
    "month.september", "month.october", "month.november", "month.december",
  ];
  const monthIndex = parseInt(selectedDate.slice(5, 7), 10) - 1;
  const monthLabel = t(monthKeys[monthIndex]);
  const dayQuery = useDayBookings(selectedDate);
  const mineQuery = useMyBookings(user);
  const invitedQuery = useInvitedBookings(user);

  useTgBackButton(null);

  const handleCreate = () => {
    haptic();
    onCreate();
  };

  useTgMainButton({ text: t("home.fab.book"), onClick: handleCreate });

  const handleSelect = (b: Booking) => {
    haptic();
    onSelect(b);
  };

  const handleProfile = () => {
    haptic();
    onProfile();
  };

  const dayEmptyMessage =
    selectedDate === today ? t("home.empty.today") : t("home.empty.day");

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
            emptyMessage={t("home.empty.mine")}
            showDate
            onSelect={handleSelect}
          />
        );
      case "invited":
        return (
          <BookingsList
            bookings={invitedQuery.data}
            isLoading={invitedQuery.isLoading}
            emptyMessage={t("home.empty.invited")}
            invitedBadge
            showDate
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
      <header className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <WorkspaceSelector />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <LangToggle />
          <button
            type="button"
            onClick={handleProfile}
            aria-label={t("home.profile_button")}
            className="text-2xl leading-none px-2"
          >
            👤
          </button>
        </div>
      </header>

      <div>
        <p className="text-sm mb-1" style={{ color: "var(--text-sec)" }}>
          {monthLabel}
        </p>
        <DateStrip
        selectedDate={selectedDate}
        onChange={onDateChange}
        markedDates={markedDates}
      />
      </div>

      <HomeChips active={tab} onChange={onTabChange} />

      <div className="flex-1">{renderList()}</div>

      {!inTg && (
        <button
          type="button"
          onClick={handleCreate}
          aria-label={t("home.fab.book")}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-2xl font-bold shadow-lg"
          style={{ background: "var(--primary)", color: "white" }}
        >
          +
        </button>
      )}
    </div>
  );
}
