import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

interface AttachmentMeta {
  id: number;
}

/** Boolean: есть ли вложения у встречи. Для индикатора 📎 в карточке. */
export function useBookingAttachments(bookingId: number | null) {
  return useQuery<boolean>({
    queryKey: ["booking", "has-attachments", bookingId],
    enabled: bookingId !== null,
    queryFn: async () => {
      const res = await apiClient.get<AttachmentMeta[]>(
        `/api/v1/bookings/${bookingId}/attachments`,
      );
      return Array.isArray(res?.data) && res.data.length > 0;
    },
    staleTime: 30_000,
  });
}
