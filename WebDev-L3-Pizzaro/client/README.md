# PIZZARO

PIZZARO is a React/Vite pizza ordering client with an Express, MongoDB, and Mongoose API.

## Local setup

Requirements: Node.js 20 or later, MongoDB, and (for mail testing) a local SMTP inbox such as Mailpit.

In PowerShell, create local environment files only when they do not already exist. This avoids replacing any existing `.env` values:

```powershell
Set-Location .\client
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path .\server\.env)) { Copy-Item .\server\.env.example .\server\.env }
```

Edit `client/.env` for a production API URL, and `client/server/.env` for backend settings. Do not put backend credentials in a `VITE_*` variable or share either local `.env` file. In development, API calls use Vite's same-origin `/api` proxy, so localhost, `127.0.0.1`, and LAN browser URLs reach the backend on the development machine without browser CORS configuration. For a deployed frontend, set `VITE_API_BASE_URL` to the public API origin and configure backend `CLIENT_URL` to the frontend origin.

Install and start the API in one terminal:

```powershell
Set-Location .\client\server
npm install
npm run dev
```

Install and start Vite in a second terminal:

```powershell
Set-Location .\client
npm install
npm run dev
```

The backend seeds the supported inventory options with zero stock on first start. An administrator must record actual stock before checkout is allowed. With a MongoDB replica set (including Atlas), stock changes and order creation use transactions. Standalone MongoDB uses conditional atomic stock updates with compensating rollback.

## Safe local email testing

Use a local SMTP capture inbox instead of a personal or production mailbox. For example, with Docker available:

```powershell
docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit
```

The sample server environment points SMTP at `127.0.0.1:1025`; view captured messages at `http://127.0.0.1:8025`. Leave `SMTP_USER` and `SMTP_PASS` empty for the default local Mailpit configuration, and set `SMTP_FROM` to a valid sender accepted by your SMTP provider. If `SMTP_FROM` is omitted, the configured `SMTP_USER` is used as the sender. For a private or self-signed SMTP certificate, set `SMTP_CA_FILE` to the path of the trusted PEM CA certificate; `SMTP_TLS_SERVERNAME` can specify the certificate's DNS name when the SMTP host is an IP. TLS certificate validation remains enabled. Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`. Verification and password-reset tokens are never printed to the backend console. For another SMTP test service, use its test-only credentials and inbox; never copy production credentials into a development environment.

Email links use `CLIENT_URL`. Verification links expire after 24 hours; reset links expire after 15 minutes. Both tokens are stored only as SHA-256 hashes and are single-use.

## Razorpay test mode

Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `client/server/.env` from the Razorpay dashboard's **Test Mode** credentials. The key ID is returned to Checkout; the secret stays on the server. Use only Razorpay's current official test payment details, not live credentials. The API creates the Razorpay order, validates its signed callback with the official Node SDK, checks the payment/order/amount/currency with Razorpay, and only then records a paid order.

## Administrator access

Public registration always creates a normal user. To regain admin access for an existing account, use an authorized backend shell and the email for that account:

```powershell
Set-Location .\client\server
npm run admin:promote -- existing-account@example.test
```

This command changes only that existing database account's role and verified-email flag; it does not create a password, inspect a password, or reveal a password. Sign out and back in after promotion so the UI refreshes the database role. The same operation can use `ADMIN_BOOTSTRAP_EMAIL` from the server environment instead of a command-line argument. Do not expose the backend environment file.

Inventory is at `/admin`. Update stock and low-stock thresholds there. Counts must be whole numbers; orders are refused when any selected base, sauce, cheese, or vegetable cannot be reserved.

## Checks

```powershell
Set-Location .\client
npm run lint
npm run build
Set-Location .\server
npm test
```

## Manual acceptance tests

1. **Email verification:** Register a new account. Before following the Mailpit link, attempt login and confirm the API rejects the unverified account. Follow the link, sign in, and confirm a second use of the link is rejected. To test expiry on a disposable local account, set its expiry into the past before following the message:

   ```powershell
   mongosh 'mongodb://127.0.0.1:27017/pizzaro' --eval 'db.users.updateOne({ email: "tester@example.test" }, { $set: { emailVerificationExpires: new Date(Date.now() - 1000) } })'
   ```

   Confirm the old link fails and use `/verify-email` to request a new one.
2. **Password reset:** Request a reset from `/forgot-password`, open the message in Mailpit, and use the link on `/reset-password`. Sign in with the new password. Re-submit the same link and confirm it is rejected. For an immediate expiry test on a disposable local account, request another link and run:

   ```powershell
   mongosh 'mongodb://127.0.0.1:27017/pizzaro' --eval 'db.users.updateOne({ email: "tester@example.test" }, { $set: { resetPasswordExpires: new Date(Date.now() - 1000) } })'
   ```

   Confirm that reset link is rejected. This command only targets the local test database shown in the URI.
3. **Builder and totals:** Open any `/pizza/:id` page. Confirm there are five bases, five sauces, cheese choices, and independently selectable vegetables. Pick a paid base, sauce, cheese, and multiple vegetables; verify the displayed total equals the pizza size price plus each selected option once. Add it to cart and place a COD order; confirm all selected IDs and the server-calculated unit price are present in the order.
4. **Successful Razorpay test payment:** Select Razorpay, complete Checkout with a successful test payment from Razorpay's official test details, and confirm the order appears only after the server verifies the callback. Confirm it is marked paid and the server-calculated amount is the amount charged.
5. **Failed/cancelled Razorpay test payment:** Use an official failure test case or dismiss Checkout. Confirm no paid order appears and the reserved inventory is released only after the server checks Razorpay. Submit altered or missing callback signature data from a test client and confirm it cannot create an order.
6. **Inventory and overselling:** In `/admin`, set a selected ingredient's stock to a small count. Place an order that uses available stock and confirm its quantity is deducted. Attempt an order above the remaining stock and confirm it is rejected without creating an order. Cancel an eligible `Order Received` order and confirm its stock is restored once. A paid Razorpay cancellation should also show a successful test-mode refund before stock is restored.
7. **Low-stock email:** Set an ingredient below its threshold, then run `npm run alerts:check` from `client/server`. Confirm one alert appears in Mailpit. Run it again without restocking and confirm no duplicate; raise stock above the threshold, lower it below again, and confirm a new event sends another alert. The app also runs this check every 15 minutes.
8. **Admin permissions:** Submit `role: "admin"` in a public registration request and confirm the stored role is still `user`. Confirm that account receives `403` from `/api/inventory`. Promote an existing test account using the authorized CLI command, sign in again, and confirm inventory/order admin APIs work. Change the DB role back to `user` and confirm the same token loses admin API access.
9. **Order tracking and cancellation:** As admin, advance an order only through `Order Received` → `In Kitchen` → `Sent to Delivery` → `Delivered`. Keep the user's `/orders` page open and confirm it refreshes the status within about 10 seconds. Confirm a customer can cancel only while the status is `Order Received` and within the two-minute window; later or out-of-order transitions are rejected.
Internship Details
Organization: Oasis Infobyte
Track: Web Development
Level: Level 3
Project: PIZZARO — Pizza Delivery Application
Disclaimer
Razorpay is used in Test Mode for demonstration. Do not use real payment details in test transactions.