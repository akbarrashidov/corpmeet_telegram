import { apiClient } from "./axios";
import type { Booking, BookingCreate, BookingUpdate } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export const bookingsApi = {
  getActive: async (): Promise<Booking[]> => {
    const res = await apiClient.get<Booking[]>("/api/v1/bookings/active");
    return res.data;
  },

  getByDate: async (date: string): Promise<Booking[]> => {
    const res = await apiClient.get<Booking[]>("/api/v1/bookings", {
      params: { date_from: date, date_to: date },
    });
    return res.data;
  },

  create: async (payload: BookingCreate): Promise<Booking[]> => {
    const res = await apiClient.post<Booking[]>("/api/v1/bookings", payload);
    return res.data;
  },

  update: async (id: number, payload: BookingUpdate): Promise<Booking> => {
    const res = await apiClient.patch<Booking>(`/api/v1/bookings/${id}`, payload);
    return res.data;
  },

  delete: async (id: number, deleteSeries = false): Promise<void> => {
    await apiClient.delete(`/api/v1/bookings/${id}`, {
      params: deleteSeries ? { delete_series: true } : {},
    });
  },

  exportHistory: async (): Promise<void> => {
    const res = await apiClient.get("/api/v1/bookings/export", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `corpmeet_${new Date().toISOString().slice(0, 10)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },

  getFeedUrl: (feedToken: string): string =>
    `${API_BASE}/api/v1/bookings/feed/${feedToken}`,

  adminListAll: async (): Promise<Booking[]> => {
    const res = await apiClient.get<Booking[]>("/api/v1/bookings/admin/all");
    return res.data;
  },
};
