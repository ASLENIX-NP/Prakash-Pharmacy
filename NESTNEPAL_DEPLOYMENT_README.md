# Prakash Pharmacy - Nest Nepal Deployment README

Last updated: 23 November 2026

## 1. Purpose and deployment status

This document explains how to prepare and deploy Prakash Pharmacy
safely after development and testing.

GitHub push or merge does NOT mean production has been deployed.

Membership, customer history, family OPD and credit improvements
are still subject to final end-to-end testing and release approval.

Do not automatically deploy the latest main branch if it contains
unfinished or unapproved changes.

## 2. Project locations

Windows development project:
D:\Desktop\Prakash-Pharmacy

GitHub:
https://github.com/ASLENIX-NP/Prakash-Pharmacy

Production website:
https://clinic.prakashpharmacy.com.np

Verified Nest Nepal frontend document root:
/home1/aslenixt/clinic.prakashpharmacy.com.np

Previously used backend deployment area:
/home1/aslenixt/prakash-pharmacy-api/backend

IMPORTANT: Reconfirm the backend application root, startup entrypoint,
environment, Prisma Client layout, and restart method in cPanel before
creating or deploying any backend ZIP.

Local development database:
PostgreSQL prakash_pharmacy on localhost:5432

Local DB is NOT the production database.

## 3. GitHub and release management

Both developers should work in their own feature branches.

Before a release:
1. Review and merge approved pull requests.
2. Identify the exact Git commit to release.
3. Confirm all pending features are tested.
4. Verify there are no secrets committed.
5. Record the commit and planned release version.
6. Build artifacts from that exact release commit.

Do not blindly deploy the newest main branch.

## 4. Required deployment artifacts

A coordinated release may require:

FRONTEND ZIP
- Build from frontend/ using the approved production API settings.
- Run npm run typecheck and npm run build.
- ZIP the CONTENTS of frontend/dist/, not the dist folder itself.
- index.html must be at the ZIP root.
- assets/, site.webmanifest and icons must be included.
- Use ZIP entries with Linux-compatible forward-slash paths.
- Confirm built JavaScript does not call localhost.
- Never include .env or local development data.

BACKEND ZIP
- Build and test from backend/.
- Confirm the current cPanel Node.js application's directory layout.
- Include compiled backend code and runtime/project files required
  by that verified Node.js application.
- Include reviewed Prisma schema/migrations and required generated
  runtime components according to the actual server setup.
- Do not package local database dumps, secrets, logs or .env files.
- Do not assume the old backend ZIP format is still compatible.
- Verify the backend package before replacing production files.

Each ZIP must have a saved file manifest and SHA-256 hash.
Use a new release-specific filename each time.

## 5. Database migrations

Locally applied migrations requiring production verification:

20261119172858_shared_customer_registry

20261120110000_add_explicit_customer_membership

Before deployment:
- Verify production database identity without printing credentials.
- Create and verify a full production PostgreSQL backup.
- Check migration history with prisma migrate status.
- Review schema changes and database drift.
- Apply only approved pending migrations with prisma migrate deploy.
- Never use prisma db push or database reset as a shortcut.
- Do not automatically run the local historical customer backfill
  against production.
- Audit duplicate names and shared family phone numbers first.

Coordinate database migration with the compatible backend release.

## 6. Important production configuration

Production frontend .htaccess contains:
- cPanel-generated PHP directives.
- Prakash Clinic SPA rewrite rules.
- Prakash Clinic cache configuration.

On 20 November 2026 the cache configuration was updated:
- HTML: Cache-Control no-cache
- site.webmanifest: application/manifest+json and no-cache

The verified backup of the earlier configuration is:
/home1/aslenixt/.prakash-config-backups/
htaccess-before-cache-20261120-142704.bak

NEVER delete or overwrite the live .htaccess during frontend deployment.
Do not replace production .env files.

The frontend ZIP should not overwrite server-only configuration.

## 7. Deployment sequence - only after approval

1. Confirm exact approved Git commit and release scope.
2. Run all backend/frontend builds and functional tests.
3. Confirm production Node.js configuration and database migration status.
4. Create verified frontend, backend and database backups.
5. Create fresh release-specific frontend/backend ZIPs.
6. Record both ZIP hashes and verify their contents.
7. Stage ZIPs safely on Nest Nepal.
8. Apply reviewed database migrations in a controlled window.
9. Deploy compatible backend code and restart via cPanel Node.js App.
10. Verify API health, authentication and database connections.
11. Deploy frontend dist contents while preserving .htaccess.
12. Verify homepage, static assets, manifest and cache headers.
13. Test login, POS, credit, membership, OPD, reports and history.
14. Verify existing Chrome-installed app still works.
15. Record deployed Git commit, release ZIPs and deployment outcome.

Have a reviewed rollback plan before starting. Database schema changes
and data backfills may not be reversible simply by restoring old code.

## 8. Pending verification before the next full release

- Registered member and nonmember POS checkout.
- Credit checkout requires verified membership in frontend and backend.
- Credit balance correctness and settlement audit details.
- Membership-ID grouping for new credit invoices instead of phone alone.
- Historic credits remain accessible without unsafe identity merging.
- Father and child sharing a phone retain separate OPD patient histories.
- Membership POS/OPD history date filters and 10-record pagination.
- Member list and separate name/phone search.
- Settled invoice display and accounting totals.
- Previous OPD, sticker, sales, inventory and reports workflows.
- Correct payment semantics: OPD charge is not proof of payment.

Passing TypeScript and build tests is not sufficient by itself.

## 9. Release record template

Release version:
Approved Git commit:
Merged PRs:
Frontend ZIP:
Frontend SHA-256:
Backend ZIP:
Backend SHA-256:
Production database backup:
Frontend backup:
Backend backup:
Migrations applied:
Smoke test results:
Deployed at:
Rollback reference:
Outstanding issues:

## 10. New chat / handoff instructions

In a new ChatGPT conversation, provide this README and say:

"Continue Prakash Pharmacy development. Verify GitHub and current local
changes first. Do not deploy yet unless I approve. When development is
ready, generate new frontend/backend ZIPs from one verified release
commit, confirm Nest Nepal Node.js configuration, back up production,
review migrations, and guide the coordinated deployment step by step."

All Windows source editing uses PowerShell.
Nest Nepal cPanel Terminal uses Bash.
Never mix Windows and Linux commands.