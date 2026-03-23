# Cadence — Environment Setup Guide

Copy `.env.example` to `.env.local`, then fill in each value below.

```bash
cp .env.example .env.local
```

---

## 1. MONGODB_URI

Your MongoDB Atlas connection string.

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and sign in
2. If you don't have a cluster, create a free **M0** cluster
3. Click **Connect** on your cluster
4. Choose **Drivers** (Node.js)
5. Copy the connection string — it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` and `<password>` with your database user credentials
7. Add the database name `cadence` before the `?`:
   ```
   mongodb+srv://myuser:mypass@cluster0.xxxxx.mongodb.net/cadence?retryWrites=true&w=majority
   ```
8. Under **Network Access**, make sure `0.0.0.0/0` is allowed (required for Vercel)

---

## 2. VAPID Keys (for push notifications)

Generate a one-time keypair:

```bash
npx web-push generate-vapid-keys
```

This outputs two values:

```
Public Key:  BLxxxxxxx...
Private Key: xxxxxxx...
```

Set them in `.env.local`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxxxxxx...
VAPID_PRIVATE_KEY=xxxxxxx...
```

**Important:** Never regenerate these keys. If you do, all existing push subscriptions become invalid and notifications will silently stop working.

---

## 3. CRON_SECRET

A random string that protects the `/api/cron/check-notifications` endpoint. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set it in `.env.local`:

```
CRON_SECRET=your-generated-hex-string
```

---

## Vercel Deployment

Add all four env vars in your Vercel project settings:

1. Go to your project on [vercel.com](https://vercel.com)
2. **Settings** > **Environment Variables**
3. Add each variable for **Production**, **Preview**, and **Development**

---

## Cron Job (for push notifications)

Set up a free cron at [cron-job.org](https://cron-job.org):

1. Create an account
2. Add a new cron job:
   - **URL:** `https://cadence.czchen.dev/api/cron/check-notifications`
   - **Schedule:** Every 1 minute
   - **Headers:** Add `Authorization: Bearer YOUR_CRON_SECRET`
3. Enable the job

---

## Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
