export interface User {
  id: number;
  telegram_id: number | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: "user" | "admin" | "superadmin";
  display_name: string;
}

export interface Booking {
  id: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  user_id: number;
  user: User;
  created_at: string;
  guests: string[];
  recurrence: "none" | "daily" | "weekly" | "custom";
  recurrence_until: string | null;
  recurrence_group_id: number | null;
  recurrence_days: number[];
}

export interface BookingCreate {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  guests?: string[];
  recurrence?: "none" | "daily" | "weekly" | "custom";
  recurrence_until?: string;
  recurrence_days?: number[];
}

export interface BookingUpdate {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  guests?: string[];
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface BrowserSessionResponse {
  session_token: string;
  browser_url: string;
}

export interface SlotResponse {
  start: string;
  end: string;
  available: boolean;
}

export interface AdminStats {
  total_users: number;
  total_bookings: number;
  active_bookings: number;
}

export interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  time: number;
  bookingId: number;
  reminderMinutes: number;
}
