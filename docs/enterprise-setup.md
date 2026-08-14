# Enterprise setup

## Current frontend boundaries

- `src/app/core/services/cart.service.ts` owns cart state and totals.
- `src/app/core/services/auth.service.ts` owns the OTP login state machine.
- `src/app/components/product-catalog` owns product browsing.
- `src/app/components/cart-drawer` owns cart presentation.
- `src/app/components/checkout` owns delivery and payment collection UI.
- `src/app/data/product-data.ts` is the temporary catalogue source.

## Production integrations still required

Set the provider choices in `src/environments/environment.ts` and replace the mock actions with server calls:

1. OTP: create a backend endpoint that requests and verifies OTPs through Firebase, Twilio, or MSG91. Never verify OTPs only in the browser.
2. Payments: create an order on the backend, obtain a gateway order token, open the provider checkout, and verify the webhook signature server-side.
3. Orders: persist the customer, address, cart snapshot, payment id, and status in a database.
4. Catalogue: replace the local data file with a versioned catalogue API and validate prices on the server.
5. Security: add HTTPS, server-side validation, rate limiting, CSP, secret management, audit logs, and role-based admin access.

The current UI intentionally uses `mock` providers so it can be previewed without credentials. Do not put gateway secrets in Angular environment files; browser environment values are public after build.
