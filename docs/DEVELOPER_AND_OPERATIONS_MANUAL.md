# TeamFlow — Developer & Operations Manual

This guide provides end-to-end instructions for engineers, DevOps specialists, and evaluators to set up, develop, test, deploy, and maintain **TeamFlow**.

---

## 📑 Table of Contents

1. [Prerequisites & Development Tools](#1-prerequisites--development-tools)
2. [Local Workspace Setup](#2-local-workspace-setup)
3. [Environment Configuration](#3-environment-configuration)
4. [Database Provisioning & Migrations](#4-database-provisioning--migrations)
5. [Running Development & Build Tasks](#5-running-development--build-tasks)
6. [Automated Testing Suite (Vitest)](#6-automated-testing-suite-vitest)
7. [Supabase Edge Functions Deployment](#7-supabase-edge-functions-deployment)
8. [Vercel Production Deployment](#8-vercel-production-deployment)
9. [Two-Tenant Isolation Testing Guide](#9-two-tenant-isolation-testing-guide)
10. [Troubleshooting & FAQ](#10-troubleshooting--faq)

---

## 1. Prerequisites & Development Tools

Ensure your local development machine has the following tools installed:

| Tool | Recommended Version | Verification Command |
|---|---|---|
| **Node.js** | `v20.x` or `v22.x` (LTS) | `node -v` |
| **npm** | `v9.x` or `v10.x` | `npm -v` |
| **Git** | `v2.40+` | `git --version` |
| **Supabase CLI** *(Optional for local DB)* | `v1.150+` | `npx supabase --version` |

---

## 2. Local Workspace Setup

Clone the repository and install all frontend and backend dependencies:

```bash
# 1. Clone the repository
git clone https://github.com/organization/teamflow.git
cd teamflow

# 2. Install dependencies via npm
npm install
```

> [!TIP]
> The repository uses standard npm workspaces. If running in a CI/CD environment, use `npm ci` for deterministic package resolution.

---

## 3. Environment Configuration

Copy the example environment configuration into your working `.env` file:

```bash
cp .env.example .env
```

### Environment Variables Reference:

```env
# URL of your Supabase project instance (e.g., https://xyzcompany.supabase.co)
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Public anonymous API key (safe for browser distribution)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> [!IMPORTANT]
> Never commit `.env` containing production keys to version control. The repository's `.gitignore` explicitly excludes all `.env` files except `.env.example`.

---

## 4. Database Provisioning & Migrations

All database tables, Row Level Security policies, triggers, and RPC functions are managed as version-controlled SQL files in `supabase/migrations/`.

### Applying Migrations via Supabase CLI (Cloud Project):

1. **Login to Supabase CLI**:
   ```bash
   npx supabase login
   ```

2. **Link to your Supabase Project**:
   ```bash
   npx supabase link --project-ref your-project-id
   ```

3. **Push all migrations**:
   ```bash
   npx supabase db push
   ```

### Applying Migrations Manually via Supabase Dashboard:

If not using the CLI, navigate to **Supabase Dashboard ➔ SQL Editor** and execute the migration files sequentially:
1. `supabase/migrations/20261020000000_initial_schema.sql` (Tables, FKs, RLS)
2. `supabase/migrations/20261020000001_seed_data.sql` (Seed test organizations & accounts)
3. `supabase/migrations/20261020000002_module_enhancements.sql` (Realtime & RPCs)
4. `supabase/migrations/20261020000003_storage_setup.sql` (Storage bucket & policies)
5. `supabase/migrations/20261023000003_fix_org_creation_rls.sql` (Org creation policies)
6. `supabase/migrations/20261023000004_company_join_and_user_profile.sql` (Join requests & profile attributes)
7. `supabase/migrations/20261024000005_fix_user_auth_and_profile_rls.sql` (Auth triggers & profile RLS)

---

## 5. Running Development & Build Tasks

Use npm scripts defined in [`package.json`](file:///package.json):

```bash
# Start Vite development server (hot reload enabled)
npm run dev

# Run TypeScript typecheck without emitting output
npm run lint

# Compile production bundle to /dist
npm run build

# Preview the production build locally
npm run preview
```

The local development server launches by default at:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 6. Automated Testing Suite (Vitest)

TeamFlow contains a full unit and acceptance test suite in [`src/tests/acceptanceCriteria.test.ts`](file:///src/tests/acceptanceCriteria.test.ts).

### Running Tests:

```bash
# Run the test suite once (CI mode)
npm test

# Run tests in interactive watch mode
npm run test:watch
```

### Verified Acceptance Criteria Invariants:
* **AC-01**: Multi-tenant authorization boundaries, foreign org blocks, and manager limits.
* **AC-02**: Task status transition state machine, invalid skips rejection.
* **AC-04**: Attachment size limits (10MB) and MIME type allowlist.
* **AC-05**: Anti-noise notification deduplication.
* **AC-06**: Zero-denominator safety in KPI calculations.
* **AC-08**: Multi-organization live isolation verification.

---

## 7. Supabase Edge Functions Deployment

TeamFlow features two serverless functions located in `supabase/functions/`.

### 1. `teamflow-ai`
Provides OpenRouter-backed AI task breakdown, user story agile description generation, and priority advice.

```bash
# Deploy function without requiring JWT on gateway (function verifies internally)
npx supabase functions deploy teamflow-ai --no-verify-jwt

# Configure OpenRouter API Key secret
npx supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
```

### 2. `overdue-checker`
Automated scanner for overdue deliverables.

```bash
npx supabase functions deploy overdue-checker
```

---

## 8. Vercel Production Deployment

TeamFlow is fully pre-configured for one-click deployment on [Vercel](https://vercel.com).

### Deployment Steps:
1. Connect your GitHub repository to Vercel.
2. Select framework preset: **Vite**.
3. Configure build settings:
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
   * **Install Command**: `npm install`
4. Add the following **Environment Variables**:
   * `VITE_SUPABASE_URL`
   * `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**.

### Routing and Hardening (`vercel.json`):
TeamFlow includes [`vercel.json`](file:///vercel.json) ensuring:
* Single Page Application (SPA) wildcard rewrite (`/*` ➔ `/index.html`) so client-side React Router works seamlessly on deep page refreshes.
* Modern HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Permissions-Policy`).

---

## 9. Two-Tenant Isolation Testing Guide

To prove zero data leakage between tenants live (AC-08):

1. **Sign in to the application** at `/login`.
2. **Select Organization A ("Acme Labs")**:
   * Inspect the Kanban Board (`/board`). Observe tasks associated with project `ENG - NextGen Platform 2.0`.
   * Open the browser DevTools ➔ Network tab.
3. **Switch to Organization B ("BrightWave Studio")**:
   * Click the organization dropdown in the sidebar and choose **BrightWave Studio**.
   * The Kanban board immediately refreshes. The tasks from Acme Labs **vanish completely**.
   * Only BrightWave design tasks (`DES - Brand Identity Refresh`) appear.
4. **Trigger In-App Security Audit**:
   * Navigate to **Organization & Team ➔ Security & Compliance Audit**.
   * Click **Run Multi-Tenant & Security Audit**.
   * The client sends queries attempting to read from an unjoined organization UUID (`00000000-0000-0000-0000-ffffffffffff`).
   * **Result**: PostgreSQL RLS blocks the query and returns 0 rows. The audit displays all green **SEC-01 through SEC-05 Passed** badges.

---

## 10. Troubleshooting & FAQ

### Q: Why do I get an empty screen or 403 when creating a task?
* **Cause**: Ensure your authenticated user has an active membership in the currently selected organization and is added to the project in `public.project_members` if your role is `Employee`.
* **Fix**: Owners and Managers have organization-wide project visibility automatically.

### Q: Files fail to upload with "Storage bucket not found".
* **Cause**: The `attachments` storage bucket has not been initialized.
* **Fix**: Run `supabase/migrations/20261020000003_storage_setup.sql` in your Supabase SQL editor to create the bucket and assign RLS policies.

### Q: AI features return heuristic results instead of LLM completions.
* **Cause**: The `OPENROUTER_API_KEY` secret is not configured in Supabase Edge Functions.
* **Fix**: Run `npx supabase secrets set OPENROUTER_API_KEY=your_key` or set it in the Supabase Dashboard under **Settings ➔ Edge Functions ➔ Secrets**. The app automatically uses heuristic fallbacks if no key is present.

