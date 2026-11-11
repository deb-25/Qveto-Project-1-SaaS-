# TeamFlow — System Architecture & Security Specification

This document details the architectural principles, multi-tenant isolation model, Role-Based Access Control (RBAC) guarantees, and defense-in-depth security measures implemented in **TeamFlow**.

---

## 📑 Table of Contents

1. [High-Level Architectural Blueprint](#1-high-level-architectural-blueprint)
2. [Multi-Tenant Isolation Architecture](#2-multi-tenant-isolation-architecture)
3. [PostgreSQL Row Level Security (RLS) Deep-Dive](#3-postgresql-row-level-security-rls-deep-dive)
4. [Role-Based Access Control (RBAC) Matrix & Guards](#4-role-based-access-control-rbac-matrix--guards)
5. [Task State Machine & Optimistic Concurrency](#5-task-state-machine--optimistic-concurrency)
6. [Private File Storage & Attachment Boundaries](#6-private-file-storage--attachment-boundaries)
7. [AI Edge Functions & Model Fallback Resilience](#7-ai-edge-functions--model-fallback-resilience)
8. [Automated Overdue Detection Architecture](#8-automated-overdue-detection-architecture)
9. [HTTP Security Headers & Production Hardening](#9-http-security-headers--production-hardening)
10. [Automated & Live Security Audit Verification](#10-automated--live-security-audit-verification)

---

## 1. High-Level Architectural Blueprint

TeamFlow is architected as a resilient, three-tier cloud-native application combining a typed single-page application (SPA), serverless edge functions, and an isolated relational data layer.

```mermaid
graph TB
    subgraph Client Tier ["Client Tier (Browser SPA)"]
        UI["React 18 + Vite + TypeScript"]
        DND["@dnd-kit Kanban Board"]
        Canvas["IsoGlow 3D Engine (HTML5 Canvas)"]
        Context["AuthContext + OrgContext"]
        RBAC["Client-side RBAC Guard (rbac.ts)"]
    end

    subgraph Edge Tier ["Edge Computing Tier (Supabase)"]
        AIFunc["teamflow-ai Edge Function\n(OpenRouter Fallback Chain)"]
        OverdueFunc["overdue-checker Edge Function\n(Batch Notification Engine)"]
    end

    subgraph Storage Tier ["Private Storage Tier"]
        StorageBucket["Supabase Storage: 'attachments'\n(Private, 10MB limit, Auth RLS)"]
    end

    subgraph Database Tier ["Data & Security Tier (PostgreSQL)"]
        RLS["PostgreSQL Row Level Security (RLS)\n(org_id & auth.uid() Enforced)"]
        Tables["17 Relational Tables\n(Foreign Keys & Cascading Deletes)"]
        RPC["Stored Procedures & Functions\n(search_orgs, approve_req, run_overdue)"]
        Triggers["Triggers\n(handle_new_user, updated_at)"]
    end

    UI -->|HTTPS / REST / Realtime| RLS
    UI -->|Invoke / JSON| AIFunc
    UI -->|Upload / Download| StorageBucket
    OverdueFunc -->|Batch Scan / Audit| RLS
    RLS --> Tables
    RLS --> RPC
    Tables --> Triggers
```

### Architectural Principles:
1. **Tenant Safety by Construction**: Every database entity is explicitly associated with an `org_id`. Cross-organization queries are blocked at the PostgreSQL engine level.
2. **Contract-First Typing**: Shared TypeScript interfaces match database schemas and RPC signatures identically, eliminating runtime type drift.
3. **Optimistic UI with Automatic Rollback**: The interface reflects user actions immediately while holding revert handlers to restore the previous state if the database rejects an update.
4. **Graceful Degradation**: External dependencies (such as AI models or email dispatch) include deterministic fallback pathways ensuring core workflows are never blocked.

---

## 2. Multi-Tenant Isolation Architecture

In a multi-tenant SaaS application, preventing cross-tenant data leakage is the primary security imperative. TeamFlow enforces isolation through **Row Level Security (RLS)** in PostgreSQL rather than relying solely on application-level filtering.

### Key Tenant Isolation Invariants:
* **Tenant Root**: The `organizations` table acts as the security root. Every tenant has a unique UUID (e.g., `a0000000-0000-0000-0000-000000000001` for Acme Labs).
* **Tenant Scoping**: All 16 child and descendant tables contain an explicit `org_id` column referencing `organizations(id)`.
* **Composite Foreign Keys**: Child records (e.g., tasks belonging to projects) validate that both the parent entity and child entity belong to the exact same `org_id`.
* **Membership Prerequisite**: An authenticated user (`auth.uid()`) can only read or write records belonging to an organization where a verified record exists in `public.memberships`.

---

## 3. PostgreSQL Row Level Security (RLS) Deep-Dive

Row Level Security is enabled on **all 17 tables** in the database. The PostgreSQL query planner automatically rewrites every query to inject tenant-isolation criteria.

### Helper Security Function: `public.get_org_role`
To ensure fast, consistent role resolution in RLS policies without recursive table queries:
```sql
create or replace function public.get_org_role(target_org_id uuid)
returns text language sql stable security definer as $$
  select role from public.memberships
  where org_id = target_org_id and user_id = auth.uid()
  limit 1;
$$;
```

### Representative RLS Policies:

#### 1. Task Isolation Policy:
```sql
-- Users can only read tasks from organizations they belong to
create policy "Users can view tasks in their organizations"
on public.tasks for select
using (
  exists (
    select 1 from public.memberships
    where memberships.org_id = tasks.org_id
      and memberships.user_id = auth.uid()
  )
);
```

#### 2. Task Mutation Policy (Role & Membership Check):
```sql
-- Only members with valid project access can create tasks
create policy "Members can create tasks in permitted projects"
on public.tasks for insert
with check (
  exists (
    select 1 from public.memberships m
    where m.org_id = tasks.org_id
      and m.user_id = auth.uid()
      and (
        m.role in ('owner', 'manager')
        or exists (
          select 1 from public.project_members pm
          where pm.project_id = tasks.project_id
            and pm.user_id = auth.uid()
        )
      )
  )
);
```

#### 3. Organization Join Request Policies:
```sql
-- Only organization owners and managers can approve/reject join requests
create policy "Org owners and managers can decide join requests"
on public.org_join_requests for update
using (public.get_org_role(org_id) in ('owner', 'manager'));
```

---

## 4. Role-Based Access Control (RBAC) Matrix & Guards

TeamFlow defines three organizational roles: **Owner**, **Manager**, and **Employee**.

### Access Control Matrix (Document 1 §8):

| Action / Capability | Owner | Manager | Employee | Enforcement Layer |
|---|:---:|:---:|:---:|---|
| **Delete Organization** | ✔ | ✖ | ✖ | RLS + UI Guard + Slug Confirmation |
| **Modify Org Name & Settings** | ✔ | ✖ | ✖ | RLS + UI Guard |
| **Invite New Members** | ✔ | ✔ | ✖ | RLS + `memberships` policy |
| **Change Member Roles** | ✔ | ◐ *(Cannot edit Owners)* | ✖ | `rbac.ts` + RLS |
| **Remove Members** | ✔ *(Except last Owner)* | ◐ *(Employees only)* | ✖ | `rbac.ts` + Last-Owner Guard |
| **Create / Archive Workspaces** | ✔ | ✔ | ✖ | RLS + UI Guard |
| **Create / Archive Projects** | ✔ | ✔ | ✖ | RLS + UI Guard |
| **View Project Overview & Tasks** | ✔ All | ✔ All | ◐ *(Joined projects only)* | RLS + `project_members` join |
| **Create & Update Tasks** | ✔ | ✔ | ◐ *(If project member)* | RLS + UI Guard |
| **Reopen Cancelled Tasks** | ✔ | ✔ | ✖ | `statusTransitions.ts` (Doc 1 §10) |
| **Delete / Archive Tasks** | ✔ | ✔ | ◐ *(Creator only)* | RLS + UI Guard |
| **Post Comments & Attachments** | ✔ | ✔ | ◐ *(If project member)* | RLS + `storage.objects` RLS |
| **Delete Comments** | ✔ Any | ✔ Any | ◐ *(Author only)* | RLS (`user_id = auth.uid()`) |
| **View Executive KPI Reports** | ✔ All | ✔ All | ◐ *(Assigned scope)* | RLS + `analyticsService.ts` |
| **Cross-Organization Access** | ✖ | ✖ | ✖ | **PostgreSQL RLS Hard Barrier** |

### Critical Security Guards:
1. **Last-Owner Guard**:
   * An organization must always have at least one active Owner.
   * Attempting to demote or remove the sole remaining Owner is blocked both in the UI and database.
2. **Manager-Owner Protection Barrier**:
   * A user with the `Manager` role cannot demote, edit, or remove a user holding the `Owner` role.
3. **Employee Project Scope Boundary**:
   * Regular employees cannot access or query projects unless an explicit record linking them exists in `project_members`.
   * Unassigned projects return `404 Not Found` rather than `403 Forbidden` to prevent organizational resource enumeration.

---

## 5. Task State Machine & Optimistic Concurrency

Task statuses follow a strict finite-state automaton defined in [`statusTransitions.ts`](file:///src/utils/statusTransitions.ts):

```
[Backlog] --------(Direct Start)-------> [In Progress]
    |                                          |
(Normal Forward)                         (Submit Review)
    v                                          v
 [To Do] --------(Normal Forward)------> [In Review]
                                               |
                                           (Approve)
                                               v
                                            [Done]
```

### Transition Validation Rules:
* **Allowed Adjacent Steps**:
  * `backlog` ➔ `todo`
  * `todo` ➔ `in_progress`
  * `in_progress` ➔ `in_review`
  * `in_review` ➔ `done`
* **Allowed Adjacent Backward Steps**:
  * `in_review` ➔ `in_progress` (Changes requested)
  * `in_progress` ➔ `todo` (Re-queued)
* **Explicit Exceptions**:
  * `backlog` ➔ `in_progress`: Allowed as a fast-track shortcut.
  * `done` ➔ `in_progress`: Permitted if work must be reopened.
  * Cancelled: Any status can transition to `cancelled`. However, **only Owners and Managers** can reopen a cancelled task back to `backlog`.
* **Disallowed Transitions**:
  * `backlog` ➔ `done` (Rejected: Cannot skip intermediate execution).
  * `todo` ➔ `done` (Rejected: Non-adjacent workflow jump).

### Optimistic UI & Revert Protocol:
1. When a task card is dragged to a new column or updated via keyboard shortcut, the client immediately updates the local React Query / state cache.
2. The asynchronous mutation is sent to Supabase.
3. If the backend returns an error (e.g., network failure or RLS permission rejection), the client catches the exception, displays an alert toast, and executes the revert callback restoring the task card to its exact previous position.

---

## 6. Private File Storage & Attachment Boundaries

File uploads are handled by Supabase Storage backed by an S3-compatible object store.

### Storage Security Architecture:
* **Private Bucket**: The bucket named `attachments` is configured with `public = false`. File objects cannot be read or downloaded via public URLs.
* **Storage RLS Policies** (`20261020000003_storage_setup.sql`):
  ```sql
  create policy "Authenticated users can upload attachments"
  on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.role() = 'authenticated');
  
  create policy "Authenticated users can read attachments"
  on storage.objects for select
  using (bucket_id = 'attachments' and auth.role() = 'authenticated');
  ```
* **File Constraints Enforced by Client & Storage**:
  * **File Size Cap**: Strict **10 MB limit** (`MAX_FILE_SIZE = 10 * 1024 * 1024`). Files exceeding 10MB are rejected prior to network transmission.
  * **MIME Type Allowlist**: Restricted to verified formats (PNG, JPEG, GIF, SVG, WebP, PDF, DOCX, XLSX, TXT, ZIP, JSON, CSV).
  * **Client-Side SHA-256 Hashing**:
    ```typescript
    const buffer = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    const checksum = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    ```
    This checksum is saved in `public.attachments.checksum` to detect transmission corruption and guarantee file integrity.

---

## 7. AI Edge Functions & Model Fallback Resilience

The AI task copilot runs in an isolated Deno runtime via Supabase Edge Function `teamflow-ai`.

### Multi-Model Fallback Chain:
To guarantee uptime even during third-party rate limits or API downtime, the Edge Function queries OpenRouter using a priority fallback chain:

```mermaid
flowchart TD
    Req[AI Task Request: breakdown / enhance / priority] --> M1[Primary: google/gemini-2.0-flash-exp:free]
    M1 -->|Success| Out[Return Structured JSON]
    M1 -->|Rate Limit / 429 / 5xx| M2[Fallback 1: meta-llama/llama-3.3-70b-instruct:free]
    M2 -->|Success| Out
    M2 -->|Error| M3[Fallback 2: qwen/qwen-2.5-72b-instruct:free]
    M3 -->|Success| Out
    M3 -->|Error| M4[Fallback 3: deepseek/deepseek-r1:free]
    M4 -->|Success| Out
    M4 -->|All Fail / Offline| DetFallback[Deterministic Heuristic Fallback]
    DetFallback --> Out
```

* **Deterministic Heuristic Fallback**: If OpenRouter is unreachable or no API key is provided, the function executes a local heuristic generator returning structured subtasks and formatted agile descriptions, ensuring the user interface never crashes.

---

## 8. Automated Overdue Detection Architecture

Tracking overdue deliverables is handled through a dual-channel architecture:

1. **Client-Side Periodic Hook** ([`useOverdueEngine.ts`](file:///src/hooks/useOverdueEngine.ts)):
   * Triggers an automated scan when a user navigates between projects or workspaces.
   * Calls stored procedure `run_overdue_scan(target_org_id)`.
2. **Serverless Edge Function** (`overdue-checker`):
   * Designed to be invoked via cron schedule or HTTP webhook.
   * Scans all tasks where `status not in ('done', 'cancelled')` and `due_date < now()`.
   * Dispatches notifications to task assignees with anti-noise deduplication key `overdue:{taskId}:{dueDate}`.
   * Sets `email_status = 'simulated_sent'` in `public.notifications` to fulfill audit requirements without requiring production SMTP servers.

---

## 9. HTTP Security Headers & Production Hardening

The production deployment on Vercel is hardened using explicit HTTP response headers configured in [`vercel.json`](file:///vercel.json):

| Security Header | Configured Value | Purpose |
|---|---|---|
| **X-Frame-Options** | `DENY` | Prevents UI redressing and clickjacking in iframes |
| **X-Content-Type-Options** | `nosniff` | Disables MIME sniffing, forcing browsers to respect declared types |
| **X-XSS-Protection** | `1; mode=block` | Activates browser cross-site scripting filters |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Protects sensitive URL paths when linking out to external services |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=()` | Restricts access to sensitive device APIs |
| **Strict-Transport-Security** | `max-age=63072000; includeSubDomains; preload` | Enforces HTTPS over TLS across all subdomains |

---

## 10. Automated & Live Security Audit Verification

Security guarantees are verified through two complementary systems:

### 1. Automated Vitest Suite (`src/tests/acceptanceCriteria.test.ts`):
Run via `npm test`, testing all acceptance criteria AC-01 through AC-08:
* `AC-01.1` to `AC-01.5`: Cross-tenant boundary block, employee project boundary, manager last-owner barrier.
* `AC-02.1` to `AC-02.6`: State machine forward moves, backward moves, illegal skip rejections.
* `AC-04.1` to `AC-04.3`: File size restrictions (10MB), MIME type allowlist, checksum calculation.
* `AC-05.1` to `AC-05.2`: Notification anti-noise deduplication logic.
* `AC-06.1` to `AC-06.2`: Zero-denominator mathematical KPI safety and priority weight computations.

### 2. Live In-Browser Security Audit Runner (`src/tests/crossTenantAudit.ts`):
Located in **Organization Settings ➔ Security**:
* Executes real-time Supabase queries targeting an unauthenticated foreign UUID (`00000000-0000-0000-0000-ffffffffffff`).
* Validates that the active session receives zero leaked rows from other organizations.
* Confirms RLS status, storage isolation, and KPI zero-denominator resilience with real-time UI status badges.

