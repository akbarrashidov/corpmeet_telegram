import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@corpmeet/design/complex";

export type RsvpInput = "accepted" | "declined";

/** Гость отвечает на приглашение: PATCH /bookings/{id}/guests/me {status}. */
export function useGuestRsvp(bookingId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: RsvpInput) => {
      if (bookingId === null) throw new Error("No booking");
      await apiClient.patch(
        `/api/v1/bookings/${bookingId}/guests/me`,
        { status },
      );
      return status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", "guests", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["bookings", "active"] });
    },
  });
}
