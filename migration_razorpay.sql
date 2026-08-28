-- Run this once in Supabase SQL editor before deploying the Razorpay integration.

alter table public.registrations
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

-- Prevent two registrations from ever sharing the same order id
create unique index if not exists registrations_razorpay_order_id_idx
  on public.registrations (razorpay_order_id)
  where razorpay_order_id is not null;

-- IMPORTANT (security): the browser now only INSERTs a pending registration
-- and never marks anything as verified. Verification is done exclusively by
-- the /api/verify-payment and /api/webhook serverless functions using the
-- Supabase SERVICE ROLE key, which bypasses RLS. Make sure your RLS policy
-- on `registrations` does NOT allow anon/authenticated UPDATE on
-- payment_status, ticket_status, or ticket_id — only your own service role
-- key should be able to change those. Example tightened policy:
--
-- drop policy if exists "allow anon update" on public.registrations; -- if one exists
-- (keep only an INSERT policy for anon, and SELECT only through the
--  get_ticket_status RPC, not a direct table SELECT policy for anon)
