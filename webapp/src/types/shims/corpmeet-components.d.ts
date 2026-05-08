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
