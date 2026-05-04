# Complex layer

This directory holds domain-coupled components: Calendar, BookingModal, AdminPanel, NotificationCenter, plus the React Query hooks and axios API clients they depend on.

## Why a separate layer

The "design" core (`tokens`, `theme`, `animations`, `components`) is framework-agnostic and works for any React app. The complex layer is **opinionated** — it assumes:

- React Query is set up (`<QueryClientProvider>`)
- Your backend implements the Corpmeet REST contract (see [API contract](#api-contract))
- You're OK with the booking domain model (`Booking`, `SlotResponse`, recurrence rules)

If those assumptions don't hold, copy individual files into your project and adapt — the design tokens and base components keep working.

## Quick start

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@corpmeet/design/theme";
import { Calendar } from "@corpmeet/design/complex";

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <Calendar
          currentUser={user}
          onSlotClick={(start, end) => openCreateModal({ start, end })}
          onCardClick={(booking) => openEditModal(booking)}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

## Configuring the API base URL

`api/axios.ts` reads `import.meta.env.VITE_API_URL` and falls back to the same origin (relative paths). To point at a different backend, set:

```env
VITE_API_URL=https://your-backend.example.com
```

For more control, fork `api/axios.ts` and replace the `apiClient` instance with your own.

## API contract

The backend must expose these endpoints under the configured base URL:

### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Telegram Mini App registration |
| POST | `/api/v1/auth/login` | Telegram Mini App login |
| POST | `/api/v1/auth/web-register` | Web-only registration |
| GET  | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/browser/session` | Issue browser session token |
| GET  | `/api/v1/auth/session/{token}` | Exchange session token for access token |
| POST | `/api/v1/auth/qr-session` | QR-based pairing session |
| POST | `/api/v1/auth/dev-login` | Dev-only login (gated) |

Token format is opaque to the frontend (originally JWT, now PASETO). The frontend just sends it in `Authorization: Bearer <token>`.

### Bookings
| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/v1/bookings?date_from=&date_to=` | List by date range |
| GET    | `/api/v1/bookings/active` | Active + upcoming (30 days) |
| POST   | `/api/v1/bookings` | Create (supports recurrence) |
| PATCH  | `/api/v1/bookings/{id}` | Update |
| DELETE | `/api/v1/bookings/{id}?delete_series=` | Soft-delete |
| GET    | `/api/v1/bookings/admin/all` | Admin list (last 200) |
| GET    | `/api/v1/bookings/export` | iCal of own bookings |
| GET    | `/api/v1/bookings/feed/{feed_token}` | Public iCal feed |

### Users
| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/v1/users/me` | Current user |
| GET    | `/api/v1/users/search?q=` | Search by name/@username |
| POST   | `/api/v1/users/feed-token` | Get/issue iCal feed token |
| GET    | `/api/v1/users/admin/users` | Admin list |
| POST   | `/api/v1/users/admin/users` | Admin create |
| PATCH  | `/api/v1/users/admin/users/{id}/role` | Set role (superadmin only) |
| DELETE | `/api/v1/users/admin/users/{id}` | Soft-delete user |
| GET    | `/api/v1/users/admin/stats` | Aggregate stats |

### Slots
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/slots?date=` | Free/booked time slots for a day |

## Roles

The frontend recognizes three roles: `"user"`, `"admin"`, `"superadmin"`. `<AdminPanel>` is gated by role check — render conditionally:

```tsx
{(user?.role === "admin" || user?.role === "superadmin") && (
  <AdminPanel isOpen={open} onClose={() => setOpen(false)} />
)}
```

## Things you'll likely want to fork

- **Localization** — `Calendar`, `DateTimePicker`, `BookingModal` have hardcoded `ru-RU` labels
- **Recurrence rules** — daily/weekly/custom-weekday only; for monthly/yearly fork `BookingModal` and the create payload
- **Color palettes** — `BookingCard.tsx` has light/dark palettes hashed by `user_id`; replace with your own brand colors

## Files

```
complex/
├── README.md                  ← this file
├── index.ts                   ← public exports
├── types.ts                   ← Booking, User, BookingCreate, BookingUpdate, ...
├── storage.ts                 ← localStorage wrapper for access_token
├── api/
│   ├── axios.ts               ← shared apiClient with auth interceptor
│   ├── auth.ts                ← register/login/me/session
│   ├── bookings.ts            ← CRUD + admin + iCal export
│   ├── users.ts               ← me/search/admin
│   └── slots.ts               ← free-slot lookup
├── hooks/
│   ├── useBookings.ts         ← 10 hooks (queries + optimistic mutations)
│   └── useAuth.ts             ← user, isAuthenticated, setToken, logout
├── contexts/
│   └── CalendarDragContext.tsx ← drag state for booking reschedule
├── Calendar/
│   ├── index.tsx              ← week+month view with drag-to-navigate
│   ├── DayColumn.tsx          ← single day grid + drop target
│   └── BookingCard.tsx        ← card with hover/drag, color-by-user
├── AdminPanel.tsx             ← stats/bookings/users tabs
├── BookingModal.tsx           ← create/edit/delete with constellation bg
└── NotificationCenter.tsx     ← reminder list + settings
```
