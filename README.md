# Freshers'26 Organizer System

Includes:
- `index.html` — public registration + payment page (Razorpay Checkout)
- `organizer.html` — organizer login screen
- `admin.html` — organizer dashboard (Overview, Registrations, Check-in, Expenses, Fees)
- `api/create-order.js` — Vercel serverless function: creates a Razorpay order (amount always read from Supabase, never trusted from the browser)
- `api/verify-payment.js` — Vercel serverless function: verifies the Razorpay checkout signature and issues the ticket
- `api/webhook.js` — Vercel serverless function: Razorpay webhook, the real source of truth for payment status
- `migration_razorpay.sql` — run once in the Supabase SQL editor before deploying

DEMO LOGIN (organizer)
Set up your own organizer account in Supabase Auth + `profiles` table (approved = true). There is no hardcoded demo password anymore.

## One-time setup

### 1. Supabase
Run `migration_razorpay.sql` in the SQL editor. This adds `razorpay_order_id` and `razorpay_payment_id` columns to `registrations`.

Double-check your RLS policies on `registrations`:
- `anon` role should be allowed to **INSERT** only.
- `anon` role should **NOT** be allowed to UPDATE `payment_status`, `ticket_status`, or `ticket_id`. Only the service role key (used exclusively by the serverless functions) should be able to change those.

### 2. Razorpay
1. Create an account at razorpay.com (Individual account works for a student club — needs PAN + Aadhaar + a bank account).
2. Complete KYC.
3. Dashboard -> Settings -> API Keys -> generate Key ID + Key Secret (start in Test Mode).
4. Dashboard -> Settings -> Webhooks -> add `https://<your-vercel-domain>/api/webhook`, subscribe to `payment.captured` and `payment.failed`, generate a Webhook Secret.

### 3. Vercel environment variables
Add these in your Vercel project settings (Production and Preview):

| Variable | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings -> API (service_role, secret, never expose client-side) |
| `RAZORPAY_KEY_ID` | Razorpay Dashboard -> API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay Dashboard -> API Keys (secret) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard -> Webhooks |

Run `npm install` (or let Vercel do it automatically) so `razorpay` and `@supabase/supabase-js` are available to the serverless functions.

### 4. Go live
- Test the full flow end-to-end in Razorpay Test Mode first (use Razorpay's test card/UPI credentials).
- Switch to Live Mode keys only once testing passes, and re-add the webhook under Live Mode too (test and live webhooks are separate).

## Notes
- This replaces the old manual UPI + UTR flow entirely - payments are verified automatically via the webhook (with a client-side callback as a fast-path, and an admin "Force verify" fallback for edge cases).
- Never commit `.env` files or API secrets to git.
