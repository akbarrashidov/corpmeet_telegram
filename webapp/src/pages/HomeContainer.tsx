import { useState } from "react";
import type { Booking } from "@corpmeet/design/complex";
import { HomePage } from "./HomePage";
import { CreateBookingPage } from "./CreateBookingPage";
import { BookingDetailPage } from "./BookingDetailPage";
import { ReschedulePage } from "./ReschedulePage";
import { ProfileScreen } from "./ProfileScreen";
import type { HomeTab } from "../components/HomeChips";
import { todayIso } from "../lib/datetime";

type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "profile" }
  | { kind: "detail"; booking: Booking }
  | {
      kind: "reschedule";
      booking: Booking;
      defaultStart: string;
      defaultEnd: string;
    };

export function HomeContainer() {
  const [view, setView] = useState<View>({ kind: "list" });
  const [tab, setTab] = useState<HomeTab>("today");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());

  if (view.kind === "list") {
    return (
      <HomePage
        tab={tab}
        onTabChange={setTab}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onCreate={() => setView({ kind: "create" })}
        onSelect={(b) => setView({ kind: "detail", booking: b })}
        onProfile={() => setView({ kind: "profile" })}
      />
    );
  }
  if (view.kind === "create") {
    return (
      <CreateBookingPage
        defaultDate={selectedDate}
        onBack={() => setView({ kind: "list" })}
        onCreated={() => setView({ kind: "list" })}
      />
    );
  }
  if (view.kind === "profile") {
    return (
      <ProfileScreen
        onBack={() => setView({ kind: "list" })}
        onSaved={() => setView({ kind: "list" })}
      />
    );
  }
  if (view.kind === "reschedule") {
    return (
      <ReschedulePage
        booking={view.booking}
        defaultStart={view.defaultStart}
        defaultEnd={view.defaultEnd}
        onBack={() => setView({ kind: "detail", booking: view.booking })}
        onSaved={() => setView({ kind: "list" })}
      />
    );
  }
  return (
    <BookingDetailPage
      booking={view.booking}
      onBack={() => setView({ kind: "list" })}
      onDeleted={() => setView({ kind: "list" })}
      onReschedule={(defaultStart, defaultEnd) =>
        setView({
          kind: "reschedule",
          booking: view.booking,
          defaultStart,
          defaultEnd,
        })
      }
    />
  );
}
