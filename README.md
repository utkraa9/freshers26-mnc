# Freshers'26 — Mathematics & Computing

Free static starter website for Shri Mata Vaishno Devi University.

## Included
- `index.html` — student-facing site
- `admin.html` — local demo admin panel
- Payment amounts, UPI and event details are placeholders.
- Payment submissions remain PENDING until admin verification.
- Verification creates a unique digital ticket with QR code.
- CSV export is included.

## Important before real launch
This version stores data in browser localStorage, so it is a prototype/demo and **not suitable for real money collection across multiple devices**. For the real free deployment, connect the forms/admin workflow to a shared backend such as Google Sheets + Google Apps Script (or another free backend), and protect the admin endpoint with authentication.

## Edit later
Search in `index.html` for `Coming Soon`, `To Be Announced`, and the amount elements to update event details. The visible site is intentionally simple and mobile-friendly.
