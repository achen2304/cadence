# Cadence

Personal habit & chore tracking PWA. Mobile-first, single-page feel with bottom sheets.

## Tech Stack

- **Next.js 16** (App Router) with TypeScript (strict)
- **MongoDB Atlas** via Mongoose
- **NextAuth v5** (beta) with Google OAuth + JWT sessions + MongoDB adapter
- **Tailwind CSS v4** + **shadcn/ui** (base-ui backed)
- **@dnd-kit** for drag-to-reorder
- **@ducanh2912/next-pwa** for service worker (NOT the original `next-pwa`)
- **date-fns** + **date-fns-tz** for timezone-aware date math

## Build & Dev

```bash
npm run dev        # Turbopack (fast, no PWA)
npm run build      # Webpack (generates sw.js for PWA)
npm start          # Production server
```

Build uses `--webpack` flag because the PWA plugin requires webpack. Dev uses `--turbopack` for speed.

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard (renders Dashboard component)
│   ├── layout.tsx                  # Root layout (SessionProvider, ThemeProvider, SettingsFab)
│   ├── icon.tsx                    # Generated 512x512 PNG favicon
│   ├── apple-icon.tsx              # Generated 180x180 Apple touch icon
│   ├── icon-192/route.tsx          # Generated 192x192 PNG for manifest
│   ├── auth/signin/page.tsx        # Google sign-in page
│   ├── settings/page.tsx           # Settings (timezone, theme, sign out)
│   ├── habit/[id]/page.tsx         # Habit detail (fallback, primary UX is via sheet)
│   ├── heatmap/page.tsx            # Heatmap (fallback, primary UX is via sheet)
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth handlers
│       ├── habits/                 # GET (list), POST (create)
│       ├── habits/[id]/            # GET, PATCH, DELETE
│       ├── habits/[id]/entries/    # GET, POST, DELETE
│       ├── habits/[id]/stats/      # GET (cached, 5min TTL)
│       ├── habits/entries/         # GET batch entries (all habits, date range)
│       ├── habits/stats/           # GET batch stats (all habits)
│       ├── habits/reorder/         # POST bulk order update
│       ├── settings/               # GET, PATCH (per-user singleton)
│       ├── push/subscribe/         # POST save push subscription
│       ├── push/send/              # POST send web push
│       └── cron/check-notifications/ # GET (CRON_SECRET auth, not user auth)
├── components/
│   ├── dashboard/Dashboard.tsx     # Main grid: habits × dates, stats, sections
│   ├── habits/HabitDetailSheet.tsx  # Bottom sheet: 14×28 grid + stats
│   ├── habits/HeatmapSheet.tsx      # Bottom sheet: all-habit heatmap
│   ├── habits/HabitForm.tsx         # Add/edit habit form (in sheet)
│   ├── SettingsFab.tsx              # Floating settings gear (bottom-left, all pages)
│   ├── ThemeProvider.tsx            # Light/dark/system theme
│   ├── SessionProvider.tsx          # NextAuth session wrapper
│   └── ui/                          # shadcn components
├── models/                          # Mongoose schemas (Habit, Entry, Settings, PushSubscription)
├── lib/
│   ├── auth.ts                      # NextAuth config
│   ├── auth-client.ts               # MongoDB native client for auth adapter
│   ├── mongodb.ts                   # Mongoose connection (cached)
│   ├── get-user.ts                  # requireUserId() helper for API routes
│   ├── schedule.ts                  # isScheduledDay() logic
│   ├── streaks.ts                   # calculateStreaks() walking backwards
│   ├── recompute-stats.ts           # Recomputes & caches stats on habit doc
│   ├── constants.ts                 # Colors, schedule types, entry statuses
│   └── types.ts                     # Client-side type definitions
├── hooks/
│   └── useOnlineStatus.ts           # Online/offline detection + queue flush
└── middleware.ts                     # Auth middleware (JWT check, excludes PWA/auth/cron routes)
```

## Key Architecture Decisions

- **All data scoped by userId** — every model has a `userId` field, every API route calls `requireUserId()`
- **Stats are cached on the Habit document** (`cachedStats` field, 5min TTL) and recomputed on entry write (fire-and-forget)
- **Batch endpoints** — `/api/habits/entries` and `/api/habits/stats` return data for all habits in one call (dashboard loads in 3 API calls total)
- **Misses are inferred, not stored** — a scheduled day with no entry in the past = missed
- **Primary UX is bottom sheets** — habit detail and heatmap open as sheets from the dashboard, not separate page navigations
- **PWA disabled in dev** to avoid service worker caching issues

## Middleware Auth Exclusions

The matcher in `middleware.ts` excludes: `api/auth`, `api/cron`, `auth/*`, static assets, `sw.js`, `workbox-*`, `manifest.json`, icons, and favicon. If you add new public routes, update the matcher.

## Cron Route

`/api/cron/check-notifications` uses `CRON_SECRET` bearer token auth (not user auth). It iterates all users' habits to send push notifications.

## Environment Variables

See `.env.example`. Required: `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `AUTH_TRUST_HOST=true`. Optional: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`.
