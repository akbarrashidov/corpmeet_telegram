export interface User {
  id: number;
  telegram_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: "user" | "admin" | "superadmin";
  display_name: string;
  position: string | null;
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

export interface UpdateMePayload {
  first_name?: string;
  last_name?: string | null;
  position?: string | null;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
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

export const authApi: {
  register(initData: string, first_name: string, last_name: string): Promise<TokenResponse>;
  login(initData: string): Promise<TokenResponse>;
  getMe(): Promise<User>;
  createBrowserSession(): Promise<BrowserSessionResponse>;
  webRegister(first_name: string, last_name: string): Promise<TokenResponse>;
};

export const bookingsApi: {
  getActive(): Promise<Booking[]>;
  getByDate(date: string): Promise<Booking[]>;
};

export const apiClient: {
  get<T>(url: string, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>;
  post<T>(url: string, body?: unknown, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>;
  patch<T>(url: string, body?: unknown, config?: { params?: Record<string, unknown> }): Promise<{ data: T }>;
};

export const storage: {
  getToken(): string | null;
  setToken(token: string): void;
  removeToken(): void;
};

export function useAuth(): {
  user: User | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  setToken: (token: string) => Promise<void>;
  logout: () => void;
};

export function useBookings(date: string | undefined): {
  data: Booking[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
};

export function useActiveBookings(): {
  data: Booking[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
};

export function useCreateBooking(): {
  mutateAsync: (payload: BookingCreate) => Promise<Booking[]>;
  isPending: boolean;
  error: unknown;
};

export function useDeleteBooking(): {
  mutateAsync: (input: { id: number; deleteSeries?: boolean }) => Promise<void>;
  isPending: boolean;
  error: unknown;
};

export const usersApi: {
  search(q: string): Promise<User[]>;
};

export function useUsers(query?: string): {
  data: User[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
};

export type WorkspaceMemberRole = "owner" | "admin" | "member";

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  invite_code: string;
  timezone: string;
  telegram_chat_id: number | null;
  created_at: string;
  my_role: WorkspaceMemberRole | null;
}

