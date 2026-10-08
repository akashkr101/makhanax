# Enterprise setup

## Current frontend boundaries

- `src/app/core/services/cart.service.ts` owns cart state and totals.
- `src/app/core/services/auth.service.ts` owns the OTP login state machine.
- `src/app/components/product-catalog` owns product browsing.
- `src/app/components/cart-drawer` owns cart presentation.
- `src/app/components/checkout` owns delivery and payment collection UI.
- `src/app/data/product-data.ts` is the temporary catalogue source.

## Orders and payments

Checkout currently supports cash on delivery only. It does not collect payment or card details.
Online payment methods and the old browser verification helpers fail closed until a real
gateway is integrated. Gateway secrets and signature verification must remain on the server.

The authenticated `createOrder` callable in `asia-south1` reads prices and stock from
Firestore, validates quantities and delivery details, and saves an order transactionally.
Each checkout has a request ID so a retry returns the same order. Client-supplied prices,
names, status, and email flags are not trusted. Direct client order creation is denied.
Checkout shows success only after the server responds; cloud-save failures are not treated
as locally completed orders. Product documents must exist in Firestore with valid names,
sizes, positive prices, and integer stock. The local fallback catalog cannot authorize an order.

Stock continues to be deducted at admin confirmation, not at checkout. Confirmation
emails are sent by the backend trigger; the browser no longer sends a duplicate confirmation.

## CI and deployment

Build CI runs coverage tests, app and backend dependency audits, a Functions build, and
emulator-backed security tests. Trusted branch builds then call the reusable SonarQube
workflow and wait for its quality gate before publishing images. Pull requests do not
execute code on the self-hosted runner. CD runs only after the entire Build CI succeeds.
It deploys Functions and Firestore rules before publishing the validated Hosting artifact.

The utility and emulator suites merge their coverage into one LCOV report. CI uploads
that report for Sonar rather than regenerating utility-only coverage on the scanner runner.
Standalone Sonar runs execute both suites. Backend source maps attribute callable coverage
to TypeScript, and tests also invoke the exported handler against the demo database because
Windows emulator worker shutdown can lose process-local coverage.

The existing self-hosted Windows runner must be online and have Git Bash. Configure
`SONAR_HOST_URL`, `SONAR_TOKEN`, `DOCKERHUB_USERNAME`, and `DOCKERHUB_TOKEN` as repository
secrets. Promote these workflow files, dependency manifests, lockfiles, and application
changes together from `dev` to `test` and `prod`; older branches lack the coverage script.
`workflow_run` CD uses the default branch's workflow, so keep that workflow updated too.

For each GitHub environment (`development`, `test`, `production`):

1. Configure its Firebase service-account secret: `FIREBASE_SERVICE_ACCOUNT_DEVELOPMENT`,
	`FIREBASE_SERVICE_ACCOUNT_TEST`, or `FIREBASE_SERVICE_ACCOUNT_PRODUCTION`.
2. Grant that deployment identity permissions for Hosting, Firestore rules, and second-generation
	Functions deployment, including acting as the Functions runtime service account. Hosting-only
	credentials are insufficient. Enable billing and required Functions/Cloud Build/Artifact Registry APIs.
3. Configure environment variables `SMTP_HOST`, `SMTP_USER`, and `SMTP_FROM`; `SMTP_PORT` defaults to 587.
4. Provision `SMTP_PASSWORD` in Firebase Secret Manager for the corresponding project and grant
	the runtime service account access. Run the following yourself; enter the password directly
	into the terminal prompt, not into source control or chat:

	```powershell
	npx --yes firebase-tools@15.33.0 functions:secrets:set SMTP_PASSWORD --project makhanax-dev
	```

Repeat secret provisioning for `makhanax-test` and `makhanax-prod`. Missing SMTP configuration
stops CD instead of silently omitting the backend. Real SMTP delivery and cloud IAM cannot
be validated by the isolated emulator tests.

Deploy this change with a coordinated backend/rules/frontend release. The old frontend
writes orders directly and is incompatible with the new rules, while the new frontend
requires the callable. During the backend-to-Hosting rollout there is a brief window where
old clients cannot submit orders; coordinate a maintenance window and ask users to reload.

## Local verification

Install both dependency trees and run the same checks used by CI:

```powershell
npm ci
npm ci --prefix functions
npm run test:coverage
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
npm run test:security
npm run build:production
npm audit --omit=dev --audit-level=high
npm audit --prefix functions --omit=dev --audit-level=high
```

Security tests require Java 21 and free local ports 9099, 8081, and 5001. They use only
`demo-makhanax`, with dummy SMTP parameters in `functions/.env.demo-makhanax`. No live
Firebase credentials or payment credentials are required. Live secrets, generated backend
output, service-account files, and emulator logs are ignored by Git.

The root dependency override pins gRPC to a patched 1.x release because Firebase 12
otherwise installs a vulnerable version. Reassess the override when upgrading Firebase.
