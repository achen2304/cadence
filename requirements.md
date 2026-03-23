# Habit & Chore Tracker — Product Requirements Document

## Overview

A personal habit and chore tracking PWA built with **Next.js** and **MongoDB**, designed for single-user use. The app features GitHub-style activity grids, streak tracking, flexible scheduling, and Apple PWA support with native-style badge notifications.

---

## Tech Stack

| Layer              | Choice                     | Notes                                                 |
| ------------------ | -------------------------- | ----------------------------------------------------- |
| Framework          | Next.js (App Router)       | SSR + API routes in one project                       |
| Database           | MongoDB Atlas M0 (free)    | Single-user, 512MB — more than sufficient             |
| Hosting            | Vercel Free tier           | Personal scale, no cost                               |
| Styling            | Tailwind CSS               | Dark/light theming via CSS variables                  |
| PWA                | `next-pwa`                 | Service worker, manifest, iOS meta tags               |
| Push Notifications | Web Push API + VAPID keys  | iOS background push when app is closed                |
| Cron Jobs          | cron-job.org (free)        | Hits secured Vercel API route every minute            |
| Drag & Drop        | `@dnd-kit/core`            | Accessible, mobile-friendly reorder                   |
| Offline Storage    | `idb`                      | Lightweight IndexedDB wrapper for offline write queue |
| Date Handling      | `date-fns` + `date-fns-tz` | Local-time math for timezone-aware miss/streak logic  |

---

## Data Models

### Habit Document (`habits` collection)

```typescript
{
  _id: ObjectId,
  name: string,                        // Display name
  description: string,                 // Optional user note
  color: string,                       // Hex color (chosen from palette)
  icon: string,                        // Optional emoji or icon slug
  order: number,                       // For manual drag-to-reorder

  schedule: {
    type: "daily" | "every_other_day" | "days_of_week" | "days_of_month",
    anchorDate: string,                // "YYYY-MM-DD" — user-chosen first active day (every_other_day only)
    daysOfWeek: number[],              // 0=Sun–6=Sat (if type = days_of_week)
    daysOfMonth: number[],             // 1–31 (if type = days_of_month)
  },

  gridRange: number,                   // Days to show in activity grid (e.g. 90, 180, 365)

  notification: {
    enabled: boolean,
    time: string,                      // "HH:MM" in local time
  },

  archivedAt: Date | null,             // null = active, Date = archived

  createdAt: Date,
  updatedAt: Date,
}
```

### Settings Document (`settings` collection)

```typescript
{
  _id: ObjectId,                         // Single document (singleton)
  timezone: string,                      // e.g. "America/Chicago" — used for all date math
  theme: "light" | "dark" | "system",
  endOfDayReminder: {
    enabled: boolean,
    time: string,                        // "HH:MM" local time
  },
  createdAt: Date,
  updatedAt: Date,
}
```

### Entry Document (`entries` collection)

```typescript
{
  _id: ObjectId,
  habitId: ObjectId,                   // Ref → habits._id
  date: string,                        // "YYYY-MM-DD" (UTC date only)
  status: "completed" | "skipped" | "missed",
  isOverride: boolean,                 // True if logged via long-press past-day flow
  createdAt: Date,
  updatedAt: Date,
}
```

> **Miss logic:** A miss is not stored as an entry — it is inferred at read time. Any scheduled day with no `completed` or `skipped` entry that is in the past is treated as a miss. The `missed` status is only written if the user explicitly selects it via the override flow.

### Push Subscription Document (`push_subscriptions` collection)

```typescript
{
  _id: ObjectId,
  endpoint: string,
  keys: { p256dh: string, auth: string },
  userAgent: string,
  createdAt: Date,
}
```

---

## Scheduling Logic

| Type              | Behavior                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `daily`           | Scheduled every calendar day                                                                           |
| `every_other_day` | Alternates from a user-chosen `anchorDate`. Scheduled if `differenceInDays(day, anchorDate) % 2 === 0` |
| `days_of_week`    | Only active on selected weekdays (e.g. Mon, Wed, Fri)                                                  |
| `days_of_month`   | Only active on selected numeric dates (e.g. 1st, 15th)                                                 |

A habit is considered **"off"** on a day it is not scheduled.

### Every-Other-Day Edge Cases

**Anchor date:** Set by the user as the first active day when creating the habit. Stored as `schedule.anchorDate` (`"YYYY-MM-DD"`). Never inferred from `createdAt`.

**Is day X scheduled?**

```
diff = differenceInDays(X, anchorDate)
isScheduled = diff >= 0 && diff % 2 === 0
```

**Changing schedule type TO every-other-day:**

- A warning modal appears before saving: _"Every-other-day requires a start date. Past entries may appear misaligned."_
- User must pick an anchor date (defaults to today)
- Past entries are preserved untouched — visual misalignment on the grid is expected and acceptable

**Editing the anchor date directly:**

- Same warning modal shown
- Past entry data is never modified — only forward scheduling changes Off days are displayed as grayed-out in the week view and do not affect streaks in any way.

---

## Entry Statuses

| Status        | Grid Display                | Streak Effect       | Color Fill     | How to Log                                      |
| ------------- | --------------------------- | ------------------- | -------------- | ----------------------------------------------- |
| **Completed** | Full colored square         | ✅ Extends streak   | 100%           | Single tap                                      |
| **Skipped**   | Half-fill with `/` diagonal | ✅ Preserves streak | 50% (diagonal) | Single tap                                      |
| **Missed**    | Empty/blank square          | ❌ Breaks streak    | 0%             | Inferred automatically; can be set via override |
| **Off day**   | Grayed-out square           | No effect           | Dimmed neutral | N/A — automatic                                 |

### Tap Cycling (Today Only)

Tapping the status button on a **today** entry cycles through:
`No entry → Completed → Skipped → No entry`

A "Missed" state cannot be directly tapped into — it is either inferred or set through the override flow.

### Past Day Override (Long Press)

- **Long pressing** a past day's cell triggers a 600ms haptic hold animation
- After hold completes, a confirmation sheet appears: _"Override past entry — are you sure?"_
- User can then select: `Completed`, `Skipped`, or `Missed`
- All overrides are flagged with `isOverride: true` in the database
- Override entries are visually marked with a small dot indicator in the grid

---

## Streak Calculation

- A streak is the consecutive count of **scheduled days** that were either `completed` or `skipped`
- A single `missed` day (explicit or inferred) resets the streak to 0
- Off days are fully transparent to streak calculation
- Current streak is shown on each habit card

---

## Main Views

### 1. Dashboard (Primary View)

- Scrollable vertical list of active habit cards
- At the top: a **horizontal scrollable 7-day week strip** showing Mon–Sun with today highlighted
- Tapping a day in the week strip filters all cards to show status for that day
- Each habit card shows:
  - Name, color accent, current streak count
  - Today's status tap button (Completed / Skipped)
  - Abbreviated schedule label (e.g. "Daily", "Mon · Wed · Fri")
- Habits **not scheduled for the selected day** appear grayed out at the bottom of the list
- **Drag handle** on each card for manual reordering (long press to initiate drag)
- Archived habits are hidden from this view entirely

### 2. Habit Detail View

- Full GitHub-style activity grid (configurable range per habit: 30 / 90 / 180 / 365 days)
- Grid columns = weeks, rows = days of week (Sun–Sat), matching GitHub's layout
- Cell color intensity based on status:
  - `completed` → full habit color
  - `skipped` → habit color at 40% with `/` pattern
  - `missed` (inferred/explicit) → empty/light gray
  - `off day` → very dim neutral
- Tapping a cell shows a tooltip: date + status label
- Long pressing a past cell triggers the override flow
- Stats panel below the grid (see Stats section)
- Edit button to modify habit settings

### 3. Add / Edit Habit Sheet

Fields:

- **Name** (required, text input)
- **Description** (optional, multiline)
- **Color** (palette of 10 selectable colors)
- **Icon** (optional emoji picker)
- **Schedule type** (segmented control: Daily / Every Other Day / Days of Week / Days of Month)
  - Days of week: toggleable pill buttons (S M T W T F S)
  - Days of month: number grid 1–31
- **Grid range** (select: 30 / 90 / 180 / 365 days)
- **Notification** toggle + time picker (visible only when toggle is on)
- **Archive** button (edit mode only, with confirmation)

---

## Color Palette

Each habit has one user-selected color from a fixed palette of 10:

| Swatch    | Name   |
| --------- | ------ |
| `#EF4444` | Red    |
| `#F97316` | Orange |
| `#EAB308` | Yellow |
| `#22C55E` | Green  |
| `#14B8A6` | Teal   |
| `#3B82F6` | Blue   |
| `#8B5CF6` | Purple |
| `#EC4899` | Pink   |
| `#6B7280` | Gray   |
| `#F59E0B` | Amber  |

---

## Miss Inference & Streak Logic

### Timezone

All date comparisons use the user's **local timezone**, stored as a string (e.g. `"America/Chicago"`) in the Settings document. Every stats and streak query reads this value. The library `date-fns-tz` handles all local-time conversion on the server.

### Day Boundary

A day "closes" at **midnight local time**. Until midnight, today is considered "pending" — no entry = streak still intact. At midnight with no entry, today becomes a miss and the streak resets to 0.

### Miss Storage

Misses are **never proactively stored**. They are inferred at read time by comparing the habit's schedule against existing entries. A `missed` entry is only written explicitly when a user sets it via the past-day override flow (`isOverride: true`).

### Streak Algorithm

Walking backwards from today in local time:

```
for each day from today backwards:
  if off day            → skip entirely (no streak effect)
  if completed/skipped  → streak++, continue
  if no entry + past midnight local → streak broken, stop
  if no entry + today (before midnight) → streak intact, continue
```

### Streak Rules Summary

| Rule                      | Decision                                                           |
| ------------------------- | ------------------------------------------------------------------ |
| Day boundary              | Midnight local time                                                |
| Miss storage              | Inferred — never stored unless via override                        |
| Today at 11PM, no entry   | Streak still intact (pending)                                      |
| Midnight passes, no entry | Streak resets to 0                                                 |
| Skip in streak            | Counts fully — identical to complete                               |
| Skip in grid              | Displayed differently (diagonal `/` fill at 40% color)             |
| Skip in completion rate   | Counts as 1 in numerator                                           |
| Off days                  | Fully transparent — no effect on streak or rates                   |
| First day of habit        | Streak = 0, accrues from creation date                             |
| Best streak               | Live high watermark — updates the moment current streak exceeds it |

---

## Statistics

Shown on the Habit Detail View, below the activity grid.

| Stat                  | Definition                                                                   |
| --------------------- | ---------------------------------------------------------------------------- |
| **This Week**         | (Completed + Skipped) ÷ scheduled days this calendar week (Mon–today)        |
| **This Month**        | (Completed + Skipped) ÷ scheduled days this calendar month                   |
| **This Year**         | (Completed + Skipped) ÷ scheduled days this calendar year                    |
| **Current Streak**    | Consecutive scheduled days with `completed` or `skipped` entry, ending today |
| **Best Streak**       | All-time longest streak — live high watermark, updates in real time          |
| **Total Completions** | Lifetime `completed` entry count (skips not included here)                   |
| **Skip Rate**         | Skipped ÷ (Completed + Skipped) for all time                                 |

> All rates are displayed as percentages with a small mini bar or ring. Skipped days count toward the completion rate but are visually distinguished in the grid and broken out separately in the Skip Rate stat.

---

## Notifications & Badges

### Platform Target

iOS only (iPhone). Requires the app to be installed to the Home Screen via Safari. Notifications and badges require **iOS 16.4+**.

### Infrastructure: Zero-Cost Architecture

```
cron-job.org (free, fires every minute)
  → GET https://your-app.vercel.app/api/cron/check-notifications
      → validates CRON_SECRET header
      → queries habits due within the current 5-minute window (user's local time)
      → sends Web Push for any matching habit with no entry yet today
      → recalculates and pushes updated badge count
```

- **Vercel Free** hosts the Next.js app and API routes
- **MongoDB Atlas M0** (free) stores all data
- **cron-job.org free tier** triggers the cron route every minute
- The cron route is protected by a `CRON_SECRET` env variable checked via request header

### Per-Habit Notifications

- Each habit has an optional notification time (`"HH:MM"` local time)
- Notification fires **within a 5-minute window** of the set time — exact precision not required
- Only fires on **scheduled days** for that habit
- Only fires if the habit has **no completed or skipped entry** for today yet
- Message format: `"⏰ [Habit Name] — Don't forget to check in today!"`
- User can disable per-habit notifications individually in the edit sheet
- No end-of-day catch-all — per-habit times only

### Badge Count

- Badge count = number of **scheduled-today habits with no completed or skipped entry**
- Uses the Web Badging API: `navigator.setAppBadge(count)`
- Badge updates in three situations:
  1. Every time the cron fires (server-side push to service worker)
  2. On app open/focus (client-side recalculation via API call)
  3. After any entry is logged (client-side immediate update)
- Badge clears to 0 when all of today's habits are resolved

### iOS Add to Home Screen Guide

- On first launch, the app detects if it is running in mobile Safari (not standalone) on iOS
- A full **step-by-step modal** walks the user through: Share → Add to Home Screen
- Modal includes illustrated steps matching current iOS Safari UI
- Modal can be dismissed but reappears on next visit until the app is installed
- Once installed (detected via `window.navigator.standalone === true`), the modal never shows again
- Notification permission prompt is deferred until **after** Home Screen installation is confirmed

---

## PWA & Apple Support

### Manifest (`manifest.json`)

- `display: "standalone"`
- `theme_color` set to match current color mode
- Multiple icon sizes including 180×180 for Apple Touch Icon
- `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` meta tags in `<head>`

### iOS-Specific Considerations

- Splash screens for common iPhone sizes via `apple-touch-startup-image`
- Status bar style set to `"black-translucent"` for edge-to-edge feel
- Service worker registered for offline support
- Push notifications and badge count require iOS 16.4+ with app added to Home Screen
- Add to Home Screen guide shown automatically in mobile Safari (see Notifications section)

### Offline Behavior

**Level:** Full read + write. The app is fully functional offline — habits can be viewed and entries can be logged without a connection.

**Queue mechanism:** Offline writes are stored in **IndexedDB** (via the `idb` library — free, browser-native, no external service). The service worker flushes the queue to MongoDB when connectivity is restored.

```
User logs entry while offline
  → entry saved to IndexedDB immediately (UI updates optimistically)
  → service worker detects connection restored
  → flushes pending IndexedDB entries to /api/habits/[id]/entries
  → conflict resolution: last-write wins (safe — single user only)
```

**Offline indicator:** A subtle `"Offline — changes will sync"` banner appears at the top of the screen when the device has no connection.

**Sync indicator:** When connection is restored and the queue is flushing, a brief `"Syncing..."` indicator replaces the offline banner, then disappears automatically once complete.

**Cached data:** The service worker (via `next-pwa`) caches all app pages and the most recent API responses so the dashboard, habit list, and grid data are all readable offline.

---

## Theme & Appearance

- **User toggleable** light / dark mode via a toggle in settings
- System preference is respected on first launch
- Theme stored in `localStorage` and applied via a `data-theme` attribute on `<html>`
- Tailwind `dark:` classes used throughout
- Background, card surfaces, and text respect theme via CSS variables

---

## Settings Screen

| Setting                       | Type                                                 |
| ----------------------------- | ---------------------------------------------------- |
| Timezone                      | Auto-detected on first launch, manually overrideable |
| App Theme                     | Light / Dark / System toggle                         |
| Enable notifications (global) | Toggle + permission request                          |
| View archived habits          | Link to archived list                                |
| About / version               | Static info                                          |

---

## API Routes (Next.js)

| Method    | Route                           | Description                                    |
| --------- | ------------------------------- | ---------------------------------------------- |
| GET       | `/api/habits`                   | List all active habits (sorted by `order`)     |
| GET/PATCH | `/api/settings`                 | Read or update the singleton settings document |
| POST      | `/api/habits`                   | Create new habit                               |
| PATCH     | `/api/habits/[id]`              | Update habit (including archive)               |
| PATCH     | `/api/habits/reorder`           | Bulk update `order` field after drag           |
| GET       | `/api/habits/[id]/entries`      | Get entries for a habit (date range)           |
| POST      | `/api/habits/[id]/entries`      | Log or update an entry for a date              |
| GET       | `/api/habits/[id]/stats`        | Return computed stats for a habit              |
| POST      | `/api/push/subscribe`           | Save a push subscription                       |
| POST      | `/api/push/send`                | Trigger push (called by cron)                  |
| GET       | `/api/cron/daily-notifications` | Protected cron endpoint for scheduled pushes   |

---

## Key UX Rules Summary

1. **Tap** cycles today's status: none → completed → skipped → none
2. **Long press (600ms)** on any past cell unlocks the override confirmation sheet
3. Off-day habits appear **grayed out** in the week view, never hidden
4. Archived habits are fully hidden from dashboard but accessible from Settings
5. Miss is **never tapped into directly** — it is inferred or explicitly set via override only
6. The activity grid range is **set per habit**, not globally
7. Notifications are **per habit** with individual times and toggles
8. Badge count reflects **incomplete tasks for today only**

---

## Known Gotchas & Implementation Notes

### 🔴 High Priority — Will block you if ignored

**1. `next-pwa` is broken with Next.js App Router**
The original `next-pwa` package is not compatible with Next.js 13+ App Router. Use the community fork instead:

```
npm install @ducanh2912/next-pwa
```

It is actively maintained and App Router compatible. Using the original package produces cryptic build errors with no clear indication of the cause.

**2. Vercel serverless + MongoDB connection exhaustion**
Vercel creates a new serverless function instance per request. Without connection caching, MongoDB Atlas M0's connection limit (~500) will be exhausted quickly. Always use a global cached client pattern:

```typescript
// lib/mongodb.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;
let cached = (global as any).mongoose ?? { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
```

This must be called at the top of every API route.

**3. iOS Web Push silently fails outside strict standalone mode**
Apple's implementation is strict — push notifications and the Badging API will silently do nothing if:

- The app is not added to the Home Screen
- The manifest `display` field is not exactly `"standalone"`
- Notification permission was not granted _after_ installation to the Home Screen

No errors are thrown. Build and test the Add to Home Screen flow on a real iOS device early — do not leave it until the end.

---

### 🟡 Medium Priority — Annoying if hit mid-build

**4. Daylight Saving Time and midnight boundaries**
Never calculate "start of day" by adding or subtracting 24 hours. On DST transition days a day is 23 or 25 hours long, which will miscategorize entries. Always use `date-fns-tz` explicitly:

```typescript
import { startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const startOfLocalDay = startOfDay(toZonedTime(new Date(), userTimezone));
```

**5. Service worker stale cache breaks local development**
The service worker caches aggressively, making every code change require a manual SW clear in DevTools. Disable it in development:

```typescript
// next.config.ts
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});
```

**6. cron-job.org is not 100% reliable**
Occasional missed fires (1–2 per month) are normal on the free tier. This is acceptable for notifications, but the badge count must also recalculate on every app open as a fallback — already accounted for in the design. Never rely solely on the cron for badge correctness.

---

### 🟢 Low Priority — Worth knowing, not urgent

**7. `@dnd-kit` requires extra config for mobile touch**
The default setup works on desktop but conflicts with scroll gestures on mobile. Add a `TouchSensor` with an activation delay:

```typescript
import { useSensor, useSensors, PointerSensor, TouchSensor } from "@dnd-kit/core";

const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  })
);
```

**8. MongoDB Atlas M0 cold starts**
The free shared-tier cluster can take 1–3 seconds on the first query after a period of inactivity. This is not a problem for a personal app but explains occasional slow initial loads.

**9. VAPID keys must never be regenerated**
Generate once with:

```
npx web-push generate-vapid-keys
```

Store both keys as Vercel environment variables (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`). If they are ever regenerated, all existing push subscriptions become silently invalid and notifications will stop delivering until the device re-subscribes.
