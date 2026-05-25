declare module "@corpmeet/design/components" {
  import type { FC } from "react";

  export interface DateTimePickerProps {
    label: string;
    /** "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD" when dateOnly */
    value: string;
    onChange: (v: string) => void;
    dateOnly?: boolean;
  }

  export const DateTimePicker: FC<DateTimePickerProps>;
}

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
