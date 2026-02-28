# FarmOps Frontend Prompt (Copy/Paste Ready)

You are a senior frontend architect and UI engineer. Build the frontend for a full farm operations platform PWA using the exact quality bar and patterns from a mature Next.js codebase.

## Product Context

Build an offline-first FarmOps PWA for three roles:
- Owner (approvals, weekly digest, exceptions)
- Manager (daily operations, fund requests, inventory movements)
- Worker (task execution with proof-of-work)

Full implementation scope:
- Concept 1 complete: task operations, proof capture, daily updates, owner approvals, weekly digest
- Concept 2 complete: budgeting, spend governance, purchase requests, POs, delivery confirmation, reconciliation, payroll workflows
- Concept 3 complete: verification/audit workflows, discrepancy resolution, sensor-aware monitoring views, incident/response coordination

## Stack And Architecture (Non-Negotiable)

- Framework: Next.js 15 App Router + React 19 + TypeScript strict
- Styling: Tailwind CSS v4 + CSS variables + shadcn/radix UI primitives
- State:
  - TanStack Query for server state
  - Zustand for client-local workflow state
  - React Hook Form + Zod for forms/validation
- PWA:
  - service worker (`/public/sw.js` style) for app-shell caching
  - IndexedDB for offline domain data
  - foreground sync as primary strategy; do not assume reliable background sync on iOS

## UI/Theming Parity (Must Match Existing Product Feel)

- Keep the visual language clean, practical, and minimal like the current app; avoid experimental/flashy styling.
- Use shadcn/radix components and existing semantic Tailwind token classes (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`).
- Do not hardcode colors in feature components; rely on CSS variables/tokens and theme primitives.
- Preserve multi-theme behavior pattern:
  - default app theme supports light/dark
  - storefront-like surfaces can be light-forced when needed
  - keep a dedicated theme scope class for customer-facing surfaces when applicable
- Maintain strong accessibility defaults already present in the current app:
  - visible focus rings
  - reduced-motion support
  - touch-target sizing
- Keep typography readable and neutral; prioritize hierarchy, spacing, and clarity over decorative effects.
- Keep motion restrained and meaningful (state transitions/feedback), not ornamental.

## Third-Party Integration Parity (Must Be Planned In Frontend)

- Cloudflare R2-compatible media pipeline UX:
  - request signed upload URL/token from backend
  - direct upload with progress/error states
  - attachment metadata persisted in outbox event payloads
- Web Push UX:
  - VAPID-driven subscription flow
  - iOS-specific guidance (Home Screen install required before push enablement)
  - graceful fallback to in-app notifications if push unavailable
- Observability:
  - frontend error boundary + Sentry-compatible instrumentation hooks
  - user-facing error states for degraded integrations (upload/email/push unavailable)
- Environment-driven feature gating:
  - hide/disable push/upload-dependent controls when backend marks integration unavailable

## Engineering Patterns To Reuse

- Keep route-facing UI code thin; move logic into hooks/services/util modules
- Enforce business/farm scoping in local cache keys and IndexedDB keys (`farmId`-scoped)
- Use resilient offline queue patterns:
  - outbox records with `PENDING/FAILED`, attempts, `nextAttemptAt`, lastError
  - exponential backoff + jitter
  - bounded batch size
  - dedupe in-flight sync calls
- Build around consistent API envelopes:
  - success: `{ success: true, data }`
  - error: `{ success: false, error: { code, message, details? } }`
- Accessibility defaults:
  - visible focus states
  - reduced-motion support
  - 44px minimum touch targets
- Use only library primitives for core controls (button/dialog/select/sheet/etc); do not reimplement primitives from scratch

## Required Frontend Modules (No Omissions)

1. Auth + role-aware shell
2. Task board (today, overdue, completed) + template management UI
3. Task detail + proof capture (photo/video/voice + time/GPS metadata)
4. Spend request flow + owner approval inbox + budget visibility
5. Procurement UI: purchase requests, PO creation, delivery confirmation, discrepancy logging
6. Inventory movement UI (in/out/adjustment, lot tracking, leakage-item controls)
7. Payroll workflow UI (run preparation, approvals, payment status visibility)
8. Daily manager update (voice-first + short form fallback)
9. Weekly digest + exception center + trend cards
10. Verification module: audit scheduling, checklist execution, discrepancy reports
11. Monitoring module: sensor status dashboards, threshold alert views, issue timelines
12. Incident/response module: issue escalation, expert request workflow, resolution tracking
13. Vendor-facing surface (web/portal-lite or secure shared workflow) for PO confirmation/invoice evidence
14. Offline center:
   - connection status
   - pending outbox count
   - manual “Sync now”
   - failed items with retry

## Offline-First Requirements

- IndexedDB stores (minimum):
  - `local_events`
  - `outbox_jobs`
  - `local_tasks`
  - `local_media`
  - `sync_meta`
- All user actions are saved locally first, then queued for sync
- Sync triggers:
  - app open
  - reconnect event
  - manual sync button
  - optional best-effort background sync where available
- Enforce local media safety policy:
  - compress images before store/upload
  - short video policy (5–15s)
  - storage threshold fallback (switch to photo-only when near quota)

## UX And Design Direction

- Mobile-first and field-usable in low-connectivity environments
- Voice/photo interactions should be primary; minimize typing burden
- High-contrast, calm visual system with clear status signaling (queued/synced/failed)
- Keep interaction latency low; optimistic UI where safe
- Ensure excellent behavior on Android Chrome and iOS Safari/Home Screen mode

## Deliverables

Provide:
1. Folder/file structure for frontend implementation
2. Core component and hook implementations (production-grade)
3. Service worker + IndexedDB + outbox sync implementation
4. API client layer with typed contracts and robust error handling
5. Complete screen map and implementations for Owner/Manager/Worker/Vendor/Verifier personas
6. Test plan and sample tests:
   - unit tests for hooks/offline queue logic
   - Playwright flow for “offline action -> reconnect -> synced”
7. Full phased implementation plan (Phase 1 Core Platform, Phase 2 Control Tower, Phase 3 Governance, Phase 4 Verification/Monitoring) with timeline and milestones

## Acceptance Criteria

- App usable offline for core flows
- No duplicated sync records after retries
- Failed syncs recover with retry/backoff
- Role-based screen access works
- Media capture workflow functions on mobile
- Procurement + payroll + verification + monitoring modules are fully implemented and navigable
- UI passes accessibility checks for focus states, semantics, and reduced motion

Do not provide vague guidance. Return concrete implementation artifacts, real code, and explicit tradeoffs.
