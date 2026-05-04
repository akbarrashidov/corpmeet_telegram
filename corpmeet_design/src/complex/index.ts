/**
 * Complex (domain) layer.
 *
 * These components/hooks/api are templates that match the Corpmeet backend contract
 * (REST endpoints under /api/v1/{bookings,users,slots,auth}).
 *
 * Consumer requirements:
 *   1. Wrap your app in <QueryClientProvider> (@tanstack/react-query)
 *   2. Set the API base URL via env var VITE_API_URL or by replacing apiClient setup in api/axios.ts
 *   3. Provide a backend implementing the same REST contract — or fork these files to match yours
 *
 * Types and hooks are exported individually so you can compose your own UI.
 */

export type {
  Booking, BookingCreate, BookingUpdate,
  User, TokenResponse, BrowserSessionResponse,
  SlotResponse, AdminStats, NotificationRecord,
} from "./types";

export { storage } from "./storage";
export { apiClient } from "./api/axios";
export { authApi } from "./api/auth";
export { bookingsApi } from "./api/bookings";
export { usersApi } from "./api/users";
export { slotsApi } from "./api/slots";

export {
  useBookings, useActiveBookings, useUsers, useSlots,
  useCreateBooking, useUpdateBooking, useDeleteBooking,
  useAdminBookings, useAdminUsers, useAdminStats,
} from "./hooks/useBookings";
export { useAuth } from "./hooks/useAuth";

export { CalendarDragProvider, useCalendarDrag, activeDragRef } from "./contexts/CalendarDragContext";
export type { DragPayload } from "./contexts/CalendarDragContext";

export {
  Calendar,
  HOUR_HEIGHT_PX, DAY_START_HOUR, DAY_END_HOUR, TOTAL_HOURS, HOURS,
} from "./Calendar";
export { BookingCard } from "./Calendar/BookingCard";
export { DayColumn } from "./Calendar/DayColumn";

export { AdminPanel } from "./AdminPanel";
export { BookingModal } from "./BookingModal";
export { NotificationCenter, addNotification, getReminderMinutes } from "./NotificationCenter";
