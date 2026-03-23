# Cadence

A personal habit and chore tracking PWA with GitHub-style activity grids, streak tracking, flexible scheduling, and iOS push notifications.

## Tech Stack

- **Next.js** (App Router) — framework
- **MongoDB Atlas** — database
- **Tailwind CSS** + **shadcn/ui** — styling & components
- **Web Push API** — native iOS notifications
- **@dnd-kit** — drag-to-reorder habits
- **IndexedDB** — offline write queue

## Features

- GitHub-style activity grid per habit
- Streak tracking with skip support
- Flexible scheduling (daily, every other day, days of week, days of month)
- Tap to cycle status, long-press to override past days
- Drag-to-reorder habit cards
- Dark/light/system theme
- Full offline support with background sync
- iOS PWA with push notifications and badge count

## Setup

```bash
npm install
cp .env.example .env.local
```

See [SETUP.md](./SETUP.md) for detailed instructions on configuring environment variables, MongoDB, VAPID keys, and cron jobs.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

Hosted on [Vercel](https://vercel.com). Push to main to deploy.

Live at [cadence.czchen.dev](https://cadence.czchen.dev).
