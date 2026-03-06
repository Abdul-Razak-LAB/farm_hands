# FarmOps Frontend Implementation Artifacts

Version: 1.0
Date: 2026-03-05

## 1. Folder/File Structure (Frontend)

```text
src/
  app/
    layout.tsx
    globals.css
    page.tsx
    login/page.tsx
    register/page.tsx
    auth/invite/[token]/page.tsx
    vendor/[vendorToken]/page.tsx
    (dashboard)/
      setup/page.tsx
      tasks/page.tsx
      tasks/[taskId]/page.tsx
      finance/page.tsx
      finance/budgets/page.tsx
      finance/approvals/page.tsx
      finance/spend-requests/page.tsx
      procurement/page.tsx
      inventory/page.tsx
      payroll/page.tsx
      payroll/runs/page.tsx
      updates/page.tsx
      updates/daily/page.tsx
      digest/page.tsx
      audits/page.tsx
      monitoring/page.tsx
      incidents/page.tsx
      consultation/page.tsx
      messages/page.tsx
      vendor/page.tsx
      marketplace/page.tsx
      reports/page.tsx
      offline/page.tsx
  components/
    layout/
      navigation-shell.tsx
      role-guard.tsx
      auth-provider.tsx
      error-boundary.tsx
    features/
      tasks/
      finance/
      procurement/
      inventory/
      payroll/
      updates/
      digest/
      verification/
      monitoring/
      incidents/
      consultation/
      messages/
      vendor/
      marketplace/
      offline/
  hooks/
    use-offline-sync.ts
    use-sync.ts
    use-web-push.ts
    use-integration-status.ts
  lib/
    api/
      farm-client.ts
      contracts.ts
    db/index.ts
    media-safety.ts
    media-upload-client.ts
    observability.ts
    store/
```

## 2. Complete Screen Map

### Auth + Shell
- `/login`
- `/register`
- `/auth/invite/[token]`
- Role-aware navigation shell wraps all dashboard routes.

### Owner/Manager/Worker Core
- `/setup`
- `/tasks`
- `/tasks/[taskId]`
- `/updates`
- `/updates/daily`
- `/offline`
- `/messages`
- `/consultation`
- `/marketplace`

### Owner/Manager Governance
- `/finance`
- `/finance/budgets`
- `/finance/approvals`
- `/finance/spend-requests`
- `/procurement`
- `/inventory`
- `/payroll`
- `/payroll/runs`
- `/reports`
- `/digest`
- `/monitoring`
- `/incidents`
- `/audits`
- `/vendor`

### Vendor Surface
- `/vendor/[vendorToken]`

## 3. Core Implementations

### Offline/PWA
- Service worker app-shell caching: `public/sw.js`
- IndexedDB stores: `local_events`, `outbox_jobs`, `local_tasks`, `local_media`, `sync_meta` in `src/lib/db/index.ts`
- Foreground sync orchestrator and outbox queue in `src/hooks/use-offline-sync.ts`

### Media + Push + Observability
- Signed upload client flow: `src/lib/media-upload-client.ts`
- Media safety policy (compress image, video duration checks, storage quota guard): `src/lib/media-safety.ts`
- Push subscription with iOS Home Screen guidance: `src/hooks/use-web-push.ts`
- Integration-status driven feature gating and degraded UX messaging in feature modules.

### API Client Layer
- Typed farm API client: `src/lib/api/farm-client.ts`
- Shared envelope/types contracts: `src/lib/api/contracts.ts`

## 4. Test Plan and Sample Tests

### Unit
- Outbox transition behavior: `src/hooks/outbox-transitions.test.ts`
- Task lane partitioning: `src/components/features/tasks/task-lanes.test.ts`

### Integration/API
- Health endpoint: `src/app/api/health/route.test.ts`
- Procurement route permission behavior: `src/app/api/farms/[farmId]/procurement/orders/route.test.ts`

### E2E
- Offline create -> reconnect -> sync: `tests/e2e/offline-sync.spec.ts`

### Additional Required Tests to Add
- Accessibility checks per module (focus-visible, semantics, motion-reduced behavior)
- Proof capture mobile constraints (5-15s video policy, quota fallback)
- Role-based route matrix snapshot tests
- Sync dedupe under rapid reconnect and partial failure conditions

## 5. Phased Frontend Implementation Plan

### Phase 1 Core Platform (2 weeks)
- Auth flows, role shell, setup, tasks, updates, offline center
- IndexedDB + outbox + service worker hardening
- Typed client migration for critical flows (tasks/finance/procurement/payroll)

### Phase 2 Control Tower (2 weeks)
- Finance/procurement/inventory/payroll deep workflow UX
- Owner approvals and exception-centered digest refinements
- Enhanced mobile ergonomics and tablet layouts

### Phase 3 Governance (2 weeks)
- Incident/consultation/messages observability-linked UX
- Reports and trend cards with typed contracts and loading/empty/error states
- Accessibility hardening and keyboard-navigation pass

### Phase 4 Verification/Monitoring (2 weeks)
- Audit execution UX and discrepancy closure flows
- Monitoring dashboards/alert timelines polishing
- Vendor workflow completion and security context hardening

## 6. Explicit Tradeoffs

- Route breadth is implemented, but typed contracts are still being migrated across all feature modules.
- Native controls are currently used in many places; shadcn/radix primitive adoption remains a structured migration task.
- Offline reliability and media safety are functionally present; acceptance-level a11y verification needs broader automated coverage.

## 7. Acceptance Mapping (Current)

- App usable offline for core flows: PARTIAL/PASS
- No duplicate sync records after retries: PARTIAL (core behavior present, more tests needed)
- Failed sync recover with retry/backoff: PARTIAL/PASS
- Role-based screen access works: PASS
- Media capture workflow on mobile: PASS
- Procurement/payroll/verification/monitoring navigable: PASS
- Accessibility checks for full module set: PARTIAL
