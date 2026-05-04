# @corpmeet/design

Design system extracted from the Corpmeet meeting-room booking app. Designed to be dropped into other React services that share the same visual language.

## Layers

```
@corpmeet/design          → theme + animations + base UI (framework-agnostic)
@corpmeet/design/complex  → calendar / admin / booking modal (domain-coupled)
@corpmeet/design/styles   → CSS variables + base styles
@corpmeet/design/tailwind-preset → Tailwind preset (colors, fonts, animations)
```

## Install (local file dependency)

If your project lives in the same monorepo:

```bash
# from your-app/
npm install file:../packages/corpmeet-design
```

Or via git URL:

```bash
npm install git+https://github.com/your-org/corpmeet.git#path:web/packages/corpmeet-design
```

Peer dependencies (already in most React apps):

```json
{
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0",
  "framer-motion": ">=11",
  "tailwindcss": "^3"
}
```

## Setup — three steps

### 1. Import the styles

In your app entry (`main.tsx` / `index.tsx`):

```ts
import "@corpmeet/design/styles";
```

This imports all three: tokens (CSS variables), base (body/fonts/scrollbar), animations (keyframes). To pick individually:

```ts
import "@corpmeet/design/styles/tokens.css";
import "@corpmeet/design/styles/base.css";
import "@corpmeet/design/styles/animations.css";
```

Add fonts to your `<head>` (or self-host):

```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;700;800&display=swap" rel="stylesheet">
```

### 2. Extend Tailwind

```js
// tailwind.config.js
const corpmeet = require("@corpmeet/design/tailwind-preset");
module.exports = {
  presets: [corpmeet],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
};
```

### 3. Wrap the app in `ThemeProvider`

```tsx
import { ThemeProvider } from "@corpmeet/design/theme";

createRoot(rootEl).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
```

The provider toggles `data-theme="dark"` on `<html>`, which the CSS variables in `tokens.css` listen for. Dark/light is auto-detected via `prefers-color-scheme` and persisted to localStorage.

## What's exported

### Theme (`@corpmeet/design/theme`)

```ts
import { ThemeProvider, useTheme, ThemeToggle } from "@corpmeet/design/theme";
```

| Export | Purpose |
|---|---|
| `ThemeProvider` | Wraps app, manages light/dark, syncs to localStorage |
| `useTheme()` | Returns `{ theme, isDark, toggle, setTheme }` |
| `ThemeToggle` | Pre-built sun/moon button |

### Animations (`@corpmeet/design/animations`)

```ts
import {
  DotMatrixLogo, ParticleBackground, InteractiveStripe,
  SplashScreen, LoadingSpinner,
} from "@corpmeet/design/animations";
```

| Component | Notes |
|---|---|
| `DotMatrixLogo` | Canvas dot-matrix word logo. Configurable `word`, `accentColor`, `height` |
| `ParticleBackground` | Fullscreen rainbow cursor-reactive particles. Mount once near root |
| `InteractiveStripe` | Top/bottom-edge animated gradient stripe with click-pulse + drag handlers |
| `SplashScreen` | 5s logo + dot-matrix splash (replace SVG paths to rebrand) |
| `LoadingSpinner` | Rotating ring, fullscreen by default |

### Base components (`@corpmeet/design/components`)

```ts
import {
  ConfirmDialog, Skeleton, BookingCardSkeleton, MeetingListSkeleton, DateTimePicker,
} from "@corpmeet/design/components";
```

| Component | Notes |
|---|---|
| `ConfirmDialog` | Modal with backdrop, primary + danger variants |
| `Skeleton` | Pulse loading placeholder (className/style) |
| `DateTimePicker` | Portal-based picker. **`ru-RU` locale hardcoded** |

### Tokens (`@corpmeet/design`)

```ts
import { tokens } from "@corpmeet/design";
// tokens.colors, tokens.fonts, tokens.radius, tokens.shadows, tokens.motion, tokens.layout
```

JS values for runtime use (canvas, inline styles where CSS vars don't fit).

### Complex / domain (`@corpmeet/design/complex`)

The Calendar, AdminPanel, BookingModal etc. require React Query and a backend matching the Corpmeet REST contract. See [`src/complex/README.md`](./src/complex/README.md) for the full API contract and quick start.

```ts
import {
  Calendar, AdminPanel, BookingModal, NotificationCenter,
  useBookings, useAuth, useUpdateBooking,
  bookingsApi, usersApi,
  type Booking, type User,
} from "@corpmeet/design/complex";
```

## CSS variables

All available via `var(--name)` once styles are imported. Categories:

- **Surfaces**: `--bg`, `--surface`, `--elevated`, `--panel`, `--modal`, `--toolbar`
- **Text**: `--text`, `--text-sec`, `--text-muted`
- **Borders**: `--border`, `--border-light`
- **Calendar grid**: `--day-grid`, `--day-grid-today`, `--day-grid-weekend`, `--day-grid-past`, `--hour-line`, `--hour-dash`, `--day-header`, `--day-header-today`, `--time-axis`
- **Inputs**: `--input-bg`, `--input-border`
- **Brand**: `--primary`, `--primary-hover`, `--primary-light`, `--primary-border`, `--accent`, `--success`, `--danger`, `--warning`
- **Effects**: `--card-shadow`, `--panel-shadow`, `--scrollbar-track`, `--scrollbar-thumb`, `--skeleton`, `--glass-blur`

All redefine for `[data-theme="dark"]` automatically.

## Caveats

- TypeScript source is shipped as-is (no pre-built `dist/`). Most React tool-chains (Vite, Next, CRA) handle this fine.
- Some components have `ru-RU` locale hardcoded — fork to localize.
- Complex layer is opinionated about backend shape (see complex/README.md).
- Peer deps (`react`, `framer-motion`, `tailwindcss`) must be installed by the consumer.
