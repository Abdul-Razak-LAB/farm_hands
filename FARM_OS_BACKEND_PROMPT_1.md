# FarmOps Backend Prompt (Copy/Paste Ready)

You are a senior backend/platform architect. Design and implement the backend for a full farm operations platform using enterprise-grade patterns from a production Next.js + Prisma system.

## Product Context

Build complete backend coverage for:
- Concept 1 complete: work orchestration, proof-of-work, daily updates, approvals, digest generation
- Concept 2 complete: budgets, spend governance, procurement lifecycle, reconciliation, payroll workflows
- Concept 3 complete: audits/verification, discrepancy handling, sensor/event ingestion, early warning, incident response coordination

## Stack And Architecture (Non-Negotiable)

- Runtime/API: Next.js App Router route handlers (or equivalent Node service style), TypeScript strict
- Data: PostgreSQL + Prisma ORM
- Storage: S3-compatible object storage for media
- Async jobs: queue worker (Redis/SQS equivalent)
- Validation: Zod schemas at API boundaries
- Observability: structured logger with PII redaction + Sentry-style exception capture

## Third-Party Integration Parity (Match Existing Platform Discipline)

Explicitly design these integrations from day one:
- Email: Resend provider abstraction with quota/rate controls
- Storage: Cloudflare R2 (S3-compatible) for media + exports, with signed upload flow
- Cache/Rate limit: Upstash Redis for shared rate limits and cached reports/limits
- Delayed jobs: Upstash QStash (or equivalent) for scheduled reminders/workflows
- Payments (production-ready): gateway interface pattern with country adapters (Hubtel/Paystack style) and webhook verification flows
- Push notifications: Web Push with VAPID key management and subscription lifecycle
- Error monitoring: Sentry-compatible capture in API handlers and background workers
- Health checks: integration-aware status checks (DB, Redis, storage, email, SMS/payment providers)

## Core Architectural Rules

- Keep route handlers thin:
  - parse + validate input
  - auth/permission/rate-limit checks
  - call service layer
  - return unified response envelope
- Unified response format:
  - success: `{ success: true, data }`
  - error: `{ success: false, error: { code, message, details? } }`
- Domain errors must be typed (`AppError` subclasses with status + error code)
- Critical writes use serializable transactions + retry on retryable DB conflicts

## Domain Model Requirements

Implement append-only event-driven core.

Minimum entities:
- `users`, `farms`, `farm_memberships` (owner/manager/worker)
- `tasks`, `task_templates`, `task_checklist_items`
- `events` (append-only timeline)
- `attachments/media` (object storage metadata + hash)
- `spend_requests`, `approvals`
- `inventory_items`, `inventory_movements`
- `daily_updates`, `weekly_digest_snapshots`
- `devices`, `sync_cursors`, `outbox_receipts` (sync reliability)
- `budgets`, `budget_lines`
- `purchase_requests`, `purchase_orders`, `po_items`, `delivery_receipts`, `reconciliations`
- `vendors`, `vendor_prices`, `vendor_performance_metrics`
- `payroll_runs`, `payroll_entries`, `payroll_approvals`, `payroll_payments`
- `audits`, `audit_templates`, `audit_results`, `audit_media`
- `sensor_devices`, `sensor_readings`, `alert_rules`, `alerts`, `alert_actions`
- `issues`, `issue_comments`, `expert_requests`, `expert_reports`

Event examples:
- `TASK_ASSIGNED`
- `TASK_COMPLETED`
- `MEDIA_ATTACHED`
- `EXPENSE_REQUESTED`
- `EXPENSE_APPROVED`
- `INVENTORY_MOVED`
- `ISSUE_REPORTED`
- `PO_CREATED`
- `PO_DELIVERED`
- `PAYROLL_RUN_CREATED`
- `AUDIT_COMPLETED`
- `SENSOR_ALERT_TRIGGERED`
- `EXPERT_REQUESTED`

## Data Integrity + Idempotency

- Every client write endpoint must accept `idempotencyKey` (or equivalent client event ID)
- Enforce uniqueness at DB level (`farmId + idempotencyKey`)
- For offline sync batch ingestion:
  - process each record independently
  - return per-record result (`success`, `error`, `code`)
  - do not fail whole batch for partial failures
- Optional but preferred: tamper-evident hash chain in events (`prev_hash`, `hash`)

## Security Requirements

- Cookie/session auth with hashed stored session tokens
- Role/permission checks per farm scope (`requirePermission(farmId, permission)`)
- Same-origin checks for state-changing browser requests
- Rate limiting profiles by IP/user/farm for sensitive endpoints
- Strict env validation in startup (`DATABASE_URL`, app URL, secrets)
- Security headers/CSP policy and protected cron endpoints via secret

## Environment And Configuration Requirements

- Implement strict env validation at startup with:
  - hard fail in production on missing required vars
  - clear warnings for optional but configured features
- Include env groups for:
  - core app/database/auth
  - R2 storage
  - Resend email
  - Redis/QStash
  - payment gateways
  - VAPID push
  - Sentry

## Offline Sync API Requirements

Provide endpoints equivalent to:
- `GET /api/farms/:farmId/sync?cursor=...`
  - returns incremental dataset and `nextCursor`
  - includes deletions/tombstones
  - bounded payload with pagination support
- `POST /api/farms/:farmId/sync`
  - accepts batch outbox events
  - max batch size enforced
  - idempotent processing
  - per-item result payload

Behavior:
- Treat transient errors separately from permanent validation/business failures
- Return machine-readable error codes for retry classification
- Log sync summaries with counts by failure code

## Media Pipeline Requirements

- Signed upload URLs (short TTL)
- Content-type + max-size validation by folder/media type
- Metadata capture: timestamp, GPS (if available), device info, checksum
- Async post-processing jobs for:
  - voice transcription
  - receipt/invoice extraction
  - digest summarization
  - anti-duplication/media integrity checks

## Testing And Quality Gates

- Unit tests for service-layer business rules
- Integration tests for:
  - idempotent writes
  - permission boundaries
  - transaction retry behavior
  - sync incremental cursor semantics
  - procurement lifecycle invariants
  - payroll approval and posting rules
  - audit/sensor alert workflows
- E2E/API scenario:
  - offline-created records sync after reconnect without duplicates

## Deliverables

Return:
1. Proposed folder architecture
2. Prisma schema draft + indexes + uniqueness constraints
3. Endpoint contract list (request/response)
4. Service-layer pseudocode and key concrete implementations
5. Error code catalog and retry policy matrix
6. Security checklist mapped to implemented middleware
7. Full phased implementation plan with deliverables per phase and timeline for complete scope

## Constraints

- No hand-wavy output
- No “single giant service”; enforce modular domain services
- No coupling UI concerns into backend domain logic
- Design for multi-tenant farm isolation from day one
- Implement all requested modules in phased sequence until complete

Produce concrete, implementation-ready backend artifacts.
