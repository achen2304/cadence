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

## 2. Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create or select a project
3. Go to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://your-domain.com/api/auth/callback/google` (prod — must be `https://`)
7. Copy the **Client ID** and **Client Secret** into `.env.local`:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 3. AUTH_SECRET

Required by NextAuth v5 for signing JWTs. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

```
AUTH_SECRET=your-generated-secret
AUTH_TRUST_HOST=true
```

`AUTH_TRUST_HOST=true` is required for local production mode (`npm start`) and Vercel deployments.

---

## 4. VAPID Keys (optional — for push notifications)

Generate a one-time keypair:

```bash
npx web-push generate-vapid-keys
```

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLxxxxxxx...
VAPID_PRIVATE_KEY=xxxxxxx...
```

**Important:** Never regenerate these keys. If you do, all existing push subscriptions become invalid and notifications will silently stop working.

---

## 5. CRON_SECRET (optional — for push notifications)

A random string that protects the `/api/cron/check-notifications` endpoint:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
CRON_SECRET=your-generated-hex-string
```

---

## Vercel Deployment

Add all env vars in your Vercel project settings:

1. Go to your project on [vercel.com](https://vercel.com)
2. **Settings** > **Environment Variables**
3. Add each variable for **Production**, **Preview**, and **Development**

---

## Cron Job (optional — for push notifications)

Set up a free cron at [cron-job.org](https://cron-job.org):

1. Create an account
2. Add a new cron job:
   - **URL:** `https://your-domain.com/api/cron/check-notifications`
   - **Schedule:** Every 1 minute
   - **Headers:** Add `Authorization: Bearer YOUR_CRON_SECRET`
3. Enable the job

---

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test PWA features (service worker, install prompt), build and run in production mode:

```bash
npm run build
npm start
```
