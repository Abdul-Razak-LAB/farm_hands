# FarmOps Backend Implementation Artifacts

Version: 1.0  
Date: 2026-03-05  
Stack: Next.js App Router, TypeScript strict, Prisma/PostgreSQL

## 1. Proposed Folder Architecture

```text
src/
  app/
    api/
      auth/
        login/route.ts
        signup/route.ts
        logout/route.ts
        session/route.ts
        invite/[token]/route.ts
      farms/
        [farmId]/
          sync/route.ts
          setup/route.ts
          tasks/...
          finance/
            requests/route.ts
            requests/[requestId]/decision/route.ts
            budgets/route.ts
          procurement/
            requests/route.ts
            orders/route.ts
            deliveries/route.ts
          payroll/
            runs/route.ts
            runs/[runId]/approve/route.ts
            runs/[runId]/pay/route.ts
          monitoring/
            route.ts
            stream/route.ts
            alerts/[alertId]/resolve/route.ts
            alerts/preferences/route.ts
          incidents/
            route.ts
            resolve/route.ts
            expert-request/route.ts
          audits/
          vendor/
            orders/route.ts
          reports/route.ts
          daily-updates/route.ts
          weekly-digest/route.ts
          messages/route.ts
          marketplace/route.ts
      integrations/
        status/route.ts
      health/route.ts
      jobs/
        transcribe-audio/route.ts
        extract-receipt/route.ts
        summarize-digest-input/route.ts
        media-integrity/route.ts
      payments/
        [provider]/initialize/route.ts
        webhooks/[provider]/route.ts
      push/
        public-key/route.ts
        subscribe/route.ts
  lib/
    api/
      envelopes.ts
      auth-context.ts
      permissions.ts
      same-origin.ts
    errors.ts
    env.ts
    logger.ts
    prisma.ts
    rate-limit.ts
    session-token.ts
    transaction-retry.ts
    media-upload-server.ts
    server-observability.ts
  services/
    sync/sync-service.ts
    task/task-service.ts
    finance/finance-service.ts
    procurement/procurement-service.ts
    payroll/payroll-service.ts
    monitoring/monitoring-service.ts
    incident/incident-service.ts
    consultation/consultation-service.ts
    setup/setup-service.ts
    reporting/reporting-service.ts
    collab/collab-service.ts
    marketplace/marketplace-service.ts
    vendor/vendor-service.ts
    control/control-service.ts
  integrations/
    email/
      email-provider.ts
      resend-provider.ts
    storage/
      r2-storage.ts
    queue/
      qstash-client.ts
    payments/
      payment-gateway.ts
      paystack-adapter.ts
      hubtel-adapter.ts
    push/
      vapid-service.ts
```

Guidelines:
- Route handlers: parse input, permission/rate-limit/origin checks, call service, return envelope.
- Services: all business logic and transaction boundaries.
- Integrations: provider interfaces + adapters; no provider-specific logic in domain services.

## 2. Prisma Schema Draft, Indexes, and Constraints

This codebase already contains broad coverage in `prisma/schema.prisma`. The following are required constraints and index hardening to ensure enterprise semantics.

### 2.1 Existing Coverage Confirmed
- Core identity: `User`, `Farm`, `FarmMembership`, `Session`, `Invitation`
- Event core: `Event`, `SyncCursor`, `OutboxReceipt`, `Tombstone`
- Ops/governance: tasks, budgets, spend requests, procurement, inventory, payroll
- Verification/monitoring/incidents: audit/sensor/alert/issue/expert
- Vendor and attachment/media metadata models

### 2.2 Required Hardening Deltas

```prisma
// Session token must be hashed-at-rest only
model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique // hashSessionToken(rawToken)
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id])

  @@index([userId, expiresAt])
}

// Idempotent event writes per farm
model Event {
  id             String   @id @default(cuid())
  farmId         String
  type           String
  payload        Json
  metadata       Json?
  idempotencyKey String?
  userId         String?
  createdAt      DateTime @default(now())
  prevHash       String?
  hash           String?

  @@unique([farmId, idempotencyKey])
  @@index([farmId, createdAt])
  @@index([farmId, type, createdAt])
}

// Sync receipts must preserve dedupe and diagnostics
model OutboxReceipt {
  id             String   @id @default(cuid())
  farmId         String
  deviceId       String
  idempotencyKey String
  eventType      String
  status         String
  errorCode      String?
  errorMessage   String?
  createdAt      DateTime @default(now())

  @@unique([farmId, idempotencyKey])
  @@index([farmId, deviceId, createdAt])
  @@index([farmId, status, createdAt])
}
```

### 2.3 Additional Integrity Rules
- Every mutating endpoint payload includes `idempotencyKey`.
- For all write-side models without uniqueness on `(farmId, idempotencyKey)`, add nullable `idempotencyKey` + unique composite.
- Add foreign-key indexes on all `farmId` columns and high-cardinality query dimensions (`status`, `createdAt`).

## 3. Endpoint Contract List (Request/Response)

All endpoints return one envelope:
- Success: `{ success: true, data }`
- Error: `{ success: false, error: { code, message, details? } }`

### 3.1 Auth
- `POST /api/auth/signup`
  - Request: `{ fullName, email, phone?, password }`
  - Response: `{ userId, farmId, role }`
- `POST /api/auth/login`
  - Request: `{ email, password }`
  - Response: `{ userId, farmId, role }`
- `POST /api/auth/logout`
  - Request: no body
  - Response: `{ loggedOut: true }`
- `GET /api/auth/session`
  - Request: cookie session
  - Response: `{ userId, farmId, role }`

### 3.2 Offline Sync
- `GET /api/farms/:farmId/sync?cursor=<ISO>&limit=<n>`
  - Request: authenticated farm-scoped member
  - Response:
    ```json
    {
      "records": {
        "tasks": [],
        "spend": [],
        "inventory": []
      },
      "tombstones": [],
      "nextCursor": "2026-03-05T12:00:00.000Z",
      "hasMore": false
    }
    ```
- `POST /api/farms/:farmId/sync`
  - Request:
    ```json
    {
      "deviceId": "ios-14-pro-max",
      "events": [
        {
          "type": "TASK_COMPLETED",
          "payload": { "taskId": "..." },
          "idempotencyKey": "evt-uuid"
        }
      ]
    }
    ```
  - Response:
    ```json
    {
      "results": [
        {
          "idempotencyKey": "evt-uuid",
          "success": true,
          "data": { "reused": false }
        }
      ]
    }
    ```

### 3.3 Governance APIs
- Finance
  - `GET/POST /api/farms/:farmId/finance/requests`
  - `POST /api/farms/:farmId/finance/requests/:requestId/decision`
  - `GET /api/farms/:farmId/finance/budgets`
- Procurement
  - `GET/POST /api/farms/:farmId/procurement/requests`
  - `GET/POST /api/farms/:farmId/procurement/orders`
  - `POST /api/farms/:farmId/procurement/deliveries`
- Payroll
  - `GET/POST /api/farms/:farmId/payroll/runs`
  - `POST /api/farms/:farmId/payroll/runs/:runId/approve`
  - `POST /api/farms/:farmId/payroll/runs/:runId/pay`

### 3.4 Monitoring, Incident, Audit
- `GET/POST /api/farms/:farmId/monitoring`
- `GET /api/farms/:farmId/monitoring/stream` (SSE)
- `POST /api/farms/:farmId/monitoring/alerts/:alertId/resolve`
- `GET/POST /api/farms/:farmId/incidents`
- `POST /api/farms/:farmId/incidents/resolve`
- `POST /api/farms/:farmId/incidents/expert-request`
- `GET/POST /api/farms/:farmId/audits/*` (template, run, result, media)

### 3.5 Media Pipeline
- `POST /api/farms/:farmId/media/signed-upload`
  - Request: `{ folder, contentType, size, checksum, metadata }`
  - Response: `{ uploadId, uploadUrl, expiresAt, headers }`
- `PUT /api/farms/:farmId/media/upload/:uploadId`
  - Request: binary upload with signed constraints
  - Response: `{ fileUrl, attachmentId, checksumVerified }`

### 3.6 Integrations and Health
- `GET /api/integrations/status`
- `GET /api/health`
- `POST /api/jobs/*` protected by job secret
- `POST /api/payments/webhooks/:provider` signature-verified

## 4. Service-Layer Pseudocode + Key Concrete Implementations

### 4.1 Route Handler Pattern (Concrete)

```ts
export async function POST(request: NextRequest, ctx: { params: Promise<{ farmId: string }> }) {
  try {
    const { farmId } = await ctx.params;
    const input = requestSchema.parse(await request.json());

    const auth = await requireFarmPermission(request, farmId, 'procurement:write');
    await assertSameOrigin(request);
    await enforceRateLimit({ request, profile: 'write', userId: auth.userId, farmId });

    const data = await procurementService.createPurchaseOrder({
      farmId,
      userId: auth.userId,
      ...input,
    });

    return Response.json({ success: true, data });
  } catch (error) {
    return createErrorResponse(error);
  }
}
```

### 4.2 Sync Service (Concrete Behavior)
- Process events independently in a loop.
- For each item:
  - Start serializable transaction with retry.
  - Check `event(farmId,idempotencyKey)` uniqueness.
  - Persist event and dispatch to domain-specific service.
  - Upsert `OutboxReceipt` as `SUCCESS` or `FAILED` with error details.
- Return per-item result payload and batch summary log grouped by failure code.

### 4.3 Payment Gateway Interface

```ts
export interface PaymentGateway {
  initialize(input: {
    farmId: string;
    runId?: string;
    amount: number;
    currency: string;
    reference: string;
    customer?: { email?: string; phone?: string; name?: string };
  }): Promise<{ checkoutUrl?: string; providerRef: string; status: string }>;

  verifyWebhook(input: { headers: Headers; rawBody: string }): Promise<{
    verified: boolean;
    eventType?: string;
    reference?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  }>;
}
```

### 4.4 Email Provider Interface

```ts
export interface EmailProvider {
  send(input: {
    to: string;
    subject: string;
    html: string;
    idempotencyKey?: string;
  }): Promise<{ providerMessageId: string }>;
}
```

## 5. Error Code Catalog + Retry Policy Matrix

| Code | HTTP | Category | Retry? | Notes |
|---|---:|---|---|---|
| `VALIDATION_ERROR` | 400 | Permanent | No | Zod payload issues |
| `UNAUTHORIZED` | 401 | Permanent | No | Missing/invalid session |
| `FORBIDDEN` | 403 | Permanent | No | Missing farm permission |
| `FORBIDDEN_ORIGIN` | 403 | Permanent | No | Same-origin violation |
| `NOT_FOUND` | 404 | Permanent | No | Missing resource |
| `CONFLICT` | 409 | Permanent | No | Unique/idempotency conflict |
| `IDEMPOTENT_REPLAY` | 200 | Safe Replay | No | Return existing result |
| `RATE_LIMITED` | 429 | Transient | Yes | Respect `Retry-After` |
| `DB_SERIALIZATION_CONFLICT` | 409/503 | Transient | Yes | Retry transaction with jitter |
| `DATABASE_UNAVAILABLE` | 503 | Transient | Yes | Infra/database outage |
| `INTEGRATION_UNAVAILABLE` | 503 | Transient | Yes | Email/storage/payment/push down |
| `WEBHOOK_SIGNATURE_INVALID` | 401 | Permanent | No | Reject forged callbacks |
| `UNKNOWN_EVENT_TYPE` | 400 | Permanent | No | Sync event not recognized |
| `INTERNAL_ERROR` | 500 | Transient | Yes | Unknown server fault |

Retry policy:
- Client sync retries only transient classes (`429`, `5xx`, infra errors).
- Exponential backoff with jitter: `min(2^attempt * base + jitter, maxBackoff)`.
- Max attempts configurable per event type.

## 6. Security Checklist Mapped to Middleware

### 6.1 Request Security Controls
- [x] Security headers/CSP on API responses: `src/proxy.ts`
- [x] Same-origin checks for mutating APIs: `src/proxy.ts` + route helpers
- [x] Rate limiting by profile (`auth`, `write`) + farm/user/IP dimensions: `src/lib/rate-limit.ts`
- [x] Session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production)
- [x] Session token hash-at-rest: `src/lib/session-token.ts`, auth routes

### 6.2 Required Hardening Actions
- [ ] Remove role trust from headers in `src/lib/permissions.ts`; derive from session + membership.
- [ ] Enforce farm-scoped membership lookup (`requireFarmPermission(request,farmId,permission)`).
- [ ] Protect all cron/job routes with secret validation helper.
- [ ] Add webhook signature validation helpers per provider adapter.

### 6.3 Observability and Privacy
- [x] Structured logs with redaction: `src/lib/logger.ts`
- [x] Exception capture hooks for API/jobs: `src/lib/server-observability.ts`
- [ ] Add correlation IDs (`requestId`, `farmId`, `userId`) in every log line.

## 7. Full Phased Implementation Plan (Timeline + Deliverables)

### Phase 1: Core Platform Hardening (2 weeks)
Deliverables:
- Session-backed auth context and farm membership permission enforcement
- Sync API hardening (cursor paging, item-level retry classification)
- Idempotency enforcement audit across mutating endpoints
- Env validation startup fail-fast and optional integration warnings
- Baseline integration tests: auth/session, permission boundaries, sync idempotency

Milestones:
- Week 1: auth-context + permissions refactor, route adoption for critical endpoints
- Week 2: sync hardening + tests + rollout docs

### Phase 2: Governance and Financial Integrity (2-3 weeks)
Deliverables:
- Procurement invariants (request -> order -> delivery -> reconciliation)
- Payroll invariants (run -> approve -> pay) with payment adapter abstraction
- Approval workflow consistency across finance/procurement/payroll
- Expanded integration tests for governance rules and transaction retries

Milestones:
- Week 3: procurement/payroll service invariant checks
- Week 4: payment initialize + webhook verify flows
- Week 5 (optional): reporting cache/rate controls in Redis

### Phase 3: Verification + Monitoring + Incident Intelligence (2 weeks)
Deliverables:
- Audit lifecycle APIs (template, execution, media evidence)
- Sensor ingestion/read model and alert rule evaluation
- Incident escalation + expert request/report workflow hardening
- Alert actions and notification routing foundations

Milestones:
- Week 6: audit + incident workflows
- Week 7: sensor/alert pipeline + tests

### Phase 4: Integrations, Reliability, and E2E Readiness (2 weeks)
Deliverables:
- R2 media signed upload policy hardening (content-type, TTL, checksum)
- Queue workers (QStash) for delayed reminders and post-processing jobs
- Health and integration readiness scoring endpoint finalization
- E2E scenario: offline create -> reconnect sync -> no duplicates

Milestones:
- Week 8: storage + queue production guards
- Week 9: full e2e + release readiness checklist

## Immediate Execution Backlog (Concrete Next 10 Tasks)
1. Implement `requireFarmPermission(request, farmId, permission)` using session token + `FarmMembership` lookup.
2. Replace header-trusted role reads in farm routes with session-derived permission checks.
3. Add reusable `assertSameOrigin(request)` helper and apply to all mutating farm routes.
4. Add `idempotencyKey` Zod requirement to any remaining mutable endpoints missing it.
5. Add transaction retry wrappers for procurement/payroll multi-write operations.
6. Add `@@index([farmId, status, createdAt])` where queue-like retrieval is used.
7. Add webhook signature verification module for each payment provider.
8. Add consistent integration status adapter checks into `/api/health` and `/api/integrations/status`.
9. Add integration tests for sync cursor semantics (`nextCursor`, tombstones, hasMore).
10. Add API scenario test for offline sync replay dedupe across duplicate idempotency keys.

---

This blueprint is implementation-ready and aligned with the existing repository structure, while identifying exact hardening deltas required for enterprise parity.
