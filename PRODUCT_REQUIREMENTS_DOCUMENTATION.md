# FarmOps (Absentee Farmer Platform) — Product Requirements Documentation (PRD)

Version: 1.0  
Date: 2026-03-01  
Product: FarmOps (Farm Hands)  
Platform: Web + PWA (mobile-first)

---

## 1) Executive Summary

FarmOps is an offline-first farm operations platform for absentee farm owners to remotely monitor and manage farms, coordinate managers/workers, and improve operational performance through real-time insights, governance workflows, and stakeholder collaboration.

The system supports end-to-end farm workflows across:
- Farm setup and team configuration
- Task operations and proof-of-work
- Finance, procurement, inventory, and payroll
- Monitoring, alerts, incidents, audits, and verification
- Offline sync and resilience
- Vendor collaboration
- Marketplace for produce/equipment/services trading

---

## 2) Product Vision

Enable farm owners to run farms effectively from anywhere by providing:
1. Operational visibility (what is happening now)
2. Control workflows (what must be approved/acted on)
3. Reliable execution in low-connectivity environments
4. Collaboration across owners, managers, workers, vendors, experts, and buyers/suppliers

---

## 3) Product Goals

### Primary Goals
- Provide a centralized platform for absentee farm owners to monitor and manage operations remotely.
- Enable near real-time monitoring of activities, weather, and equipment status.
- Trigger and route critical alerts (equipment, weather, thresholds, activity anomalies).
- Deliver actionable analytics for performance optimization.
- Improve communication across all farm stakeholders.

### Business Goals
- Reduce operational downtime and delayed interventions.
- Improve procurement and payroll governance.
- Improve productivity and accountability of field operations.
- Create a farm-to-market channel through the marketplace module.

---

## 4) Target Users & Personas

### 4.1 Owner
- Remote decision maker
- Needs high-level dashboards, exceptions, approvals, and trends
- Primary modules: Digest, Finance approvals, Procurement overview, Payroll approvals, Monitoring, Audits, Reports, Marketplace

### 4.2 Manager
- Day-to-day operational coordinator
- Needs task assignment, updates, procurement, inventory, incident handling
- Primary modules: Tasks, Updates, Procurement, Payroll prep, Monitoring, Incidents, Marketplace

### 4.3 Worker
- Field execution role
- Needs simple mobile workflows, offline support, proof capture, incident reporting
- Primary modules: Tasks, Updates, Incidents, Messages, Marketplace browsing/interest

### 4.4 Vendor / Supplier
- External partner for procurement and delivery
- Needs secure workflows for PO confirmation and invoice evidence
- Primary modules: Vendor portal, marketplace listings/interests (as stakeholder)

### 4.5 Expert / Consultant
- Handles escalations and agronomic issue advisory
- Primary modules: Incidents + expert request/report workflows

---

## 5) Scope

## 5.1 In Scope (Current Product)
1. Auth and role-aware shell
2. Farm setup and configuration
3. Task management and proof workflows
4. Daily updates and weekly digest
5. Finance and spend governance
6. Procurement lifecycle
7. Inventory movement tracking
8. Payroll runs/approvals/payments visibility
9. Monitoring and alert management
10. Incident and expert escalation workflows
11. Verification/audit workflows
12. Vendor collaboration portal
13. Offline center and sync orchestration
14. Reports and exports (CSV, Excel, PDF)
15. In-app communication and attachments
16. Marketplace (buy/sell produce, equipment, services)

## 5.2 Out of Scope (Current Release)
- Full in-app escrow or marketplace payment settlement
- Full logistics/shipping routing engine
- Multi-language localization pack
- Public open marketplace without farm-scoped controls (future expansion)

---

## 6) Product Principles

- Offline-first: user actions persist locally first, then sync.
- Role-safe: every route and action is permission guarded.
- Event-driven: append-only event timeline with idempotent writes.
- Mobile-first UX: low-friction forms, voice/photo-first where possible.
- Operational clarity: prioritize exceptions, status, and actions.

---

## 7) Functional Requirements

## FR-1 Authentication, Registration & Session
- Users can register/login/logout.
- Session-based authentication for protected APIs.
- Unauthorized API calls are rejected.
- Role is used for route and action-level permission checks.

Acceptance Criteria:
- Protected APIs return `401` without valid auth context.
- Role-restricted endpoints return `403` when permission is missing.

---

## FR-2 Farm Setup & Configuration

### FR-2.1 Farm Profile Management
- Owner/Manager can view and update farm profile:
  - Name
  - Location
  - Size (hectares)
  - Crop list
  - Notes

### FR-2.2 Sensor & Equipment Configuration
- Owner/Manager can add/update sensor devices.
- Sensor metadata (name/type) is configurable.

### FR-2.3 Role Assignment
- Owner/Manager can update team member roles within farm scope.

### FR-2.4 Alert Channel Preferences
- Configure in-app, SMS, and email channels.
- Configure recipients for SMS and email.

Acceptance Criteria:
- Changes are idempotent using `idempotencyKey`.
- Profile/sensor/role/channel changes are logged as events.

---

## FR-3 Real-time Monitoring

### FR-3.1 Dashboard Monitoring
- Show device status, unresolved alerts, recent readings.
- Show field leaderboard/analytics and machine health summaries.

### FR-3.2 Real-time Stream
- Monitoring dashboard receives streaming updates via SSE.
- Client updates query state from stream payloads.

### FR-3.3 Alert Trigger & Resolution
- Manager/Owner can trigger alerts manually.
- Alerts can be resolved and reflected in timeline.

Acceptance Criteria:
- Stream endpoint emits periodic dashboard events.
- Alert state transitions are persisted and visible.

---

## FR-4 Alerts & Notifications

- Critical event alerts support channel routing:
  - In-app
  - SMS (preference-based recipient list)
  - Email (preference-based recipient list)
- Alert dispatch actions are tracked for auditability.

Acceptance Criteria:
- Triggered alerts enqueue channel actions according to saved preferences.
- Notification dispatch is logged as an event.

---

## FR-5 Task Management

- Task board with today/overdue/completed states.
- Task details with proof capture support (photo/video/voice metadata pattern).
- Status updates and completion tracking.

Acceptance Criteria:
- Task state changes are reflected in board and detail views.
- Task actions work with offline queue and sync.

---

## FR-6 Reporting & Analytics

### FR-6.1 Summary Analytics
- Crop health/yield indicators
- Water and energy usage
- Equipment performance and alert pressure
- Labor cost/productivity indicators

### FR-6.2 Exports
- Export report in JSON (API), CSV, Excel-compatible, and PDF formats.

Acceptance Criteria:
- Report endpoint supports `format=json|csv|excel|pdf`.
- Downloads return correct MIME type and filename.

---

## FR-7 Communication & Collaboration

- In-app farm-scoped messaging.
- Thread-based message posting (general/operations/alerts/procurement).
- Attachment support (document/photo/video links via media pipeline).

Acceptance Criteria:
- Messages can be listed and posted via API.
- Attachments are persisted with message metadata.

---

## FR-8 Finance, Procurement, Inventory, Payroll (Governance)

### FR-8.1 Finance
- Spend requests and approval decisions.
- Budget visibility and status.

### FR-8.2 Procurement
- Purchase request -> PO creation -> delivery confirmation.
- Discrepancy capture and reconciliation support.

### FR-8.3 Inventory
- Inventory movement logging and balance impact.

### FR-8.4 Payroll
- Payroll run creation, approval, and payment status flow.

Acceptance Criteria:
- Governance endpoints enforce permissions and idempotency.
- Workflow state transitions are auditable in events.

---

## FR-9 Verification, Monitoring & Incident Response

- Audit templates and result capture.
- Monitoring thresholds and alert timeline.
- Incident logging, issue comments, expert request/report handling.

Acceptance Criteria:
- Incidents can be created/resolved and escalated.
- Audit and monitoring data are visible in dashboard modules.

---

## FR-10 Vendor Collaboration Surface

- Vendor-token route to view/acknowledge orders.
- Invoice/evidence upload support.

Acceptance Criteria:
- Vendor portal is accessible only via secure token context.
- Confirmation writes are idempotent and auditable.

---

## FR-11 Offline Center & Sync

- Show online/offline status.
- Show pending and failed outbox items.
- Manual “sync now”.
- Retry failed items.

Acceptance Criteria:
- Outbox state reflects local DB and retry transitions.
- Sync endpoint supports incremental GET and batched POST.

---

## FR-12 Marketplace (New)

### FR-12.1 Listing Creation
- Farm users can create listings for:
  - Produce
  - Equipment
  - Services
- Direction options:
  - Sell
  - Buy
  - Rent
  - Service
- Listing includes title, details, quantity, unit, price, currency, location, availability window.

### FR-12.2 Listing Discovery & Filtering
- Users can browse listings and filter by category.
- Listing card includes status (ACTIVE/CLOSED), metadata, and interest count.

### FR-12.3 Express Interest
- Users submit interest against listing with message and optional offer context.

### FR-12.4 Close Listing
- Listing owner/operator can close listing.

### FR-12.5 Stakeholder Directory
- Marketplace view includes relevant stakeholders (vendors, farm members).

Acceptance Criteria:
- Marketplace API supports list/create/interest/close actions.
- All write actions are idempotent and event-logged.
- Marketplace is farm-scoped and role-permission controlled.

---

## 8) Non-Functional Requirements

## NFR-1 Performance
- Interactive pages should remain responsive on mobile.
- Dashboard updates should avoid full-page reloads.

## NFR-2 Reliability
- Idempotent writes to prevent duplicates.
- Partial batch handling in sync (no all-or-nothing failure).

## NFR-3 Security
- Same-origin checks on state-changing API calls.
- Rate limiting by profile (auth/write).
- Protected cron/job/webhook endpoints.

## NFR-4 Observability
- Structured server logging.
- Exception capture hooks for API and UI.

## NFR-5 Accessibility
- Focus-visible controls.
- Touch-target friendly controls.
- Reduced-motion compatible behavior.

## NFR-6 Compatibility
- Android Chrome and iOS Safari/Home Screen support focus.
- Foreground sync strategy preferred over fragile background assumptions.

---

## 9) Data & Domain Requirements

## 9.1 Core Data Concepts
- Multi-tenant farm scope (`farmId`) is mandatory across domain writes.
- Event model is append-only for auditable timeline.
- Idempotency uniqueness enforced by `(farmId, idempotencyKey)`.

## 9.2 Key Entities
- Identity: `User`, `Farm`, `FarmMembership`, `Session`, `Invitation`
- Operations: `Task`, `TaskChecklistItem`, `TaskTemplate`, `DailyUpdate`, `WeeklyDigestSnapshot`
- Finance/Procurement: `Budget`, `BudgetLine`, `SpendRequest`, `Approval`, `PurchaseRequest`, `PurchaseOrder`, `POItem`, `DeliveryReceipt`, `Reconciliation`
- Inventory/Payroll: `InventoryItem`, `InventoryMovement`, `PayrollRun`, `PayrollEntry`, `PayrollApproval`, `PayrollPayment`
- Monitoring/Audit/Incident: `SensorDevice`, `SensorReading`, `Alert`, `AlertRule`, `AlertAction`, `Audit`, `AuditTemplate`, `AuditResult`, `Issue`, `IssueComment`, `ExpertRequest`, `ExpertReport`
- Attachments/Sync: `Attachment`, `SyncCursor`, `OutboxReceipt`, `Tombstone`

## 9.3 Marketplace Data Pattern
- Marketplace currently uses event-sourced records:
  - `MARKETPLACE_LISTING_CREATED`
  - `MARKETPLACE_INTEREST_SUBMITTED`
  - `MARKETPLACE_LISTING_CLOSED`

---

## 10) API Contract Standards

## 10.1 Unified Envelope
- Success: `{ success: true, data }`
- Error: `{ success: false, error: { code, message, details? } }`

## 10.2 Validation
- All mutating routes validate request payload with Zod.

## 10.3 Core Endpoint Families
- Auth: session/login/signup/logout/invite
- Farms: daily updates, finance, procurement, payroll, monitoring, incidents, invites, sync, vendor, setup, reports, messages, marketplace
- Integrations: push, health, jobs, payments webhooks

---

## 11) Navigation & Access Requirements

- App shell must be role-aware and route-restricted.
- Route-level guard maps each module to authorized roles.
- Marketplace, setup, offline, updates, messages are accessible by all farm roles.
- Sensitive governance modules remain owner/manager limited.

---

## 12) Acceptance Criteria by Module (Definition of Done)

A module is “Done” when:
1. Route exists and is accessible by intended roles.
2. API uses envelope + validation + permission checks.
3. Writes are idempotent where applicable.
4. UI handles loading, empty, and error states.
5. Lint/type checks pass.
6. Existing automated tests remain passing.

---

## 13) KPIs & Success Metrics

## Operational KPIs
- % tasks completed on time
- Mean time to incident acknowledgment/resolution
- Alert resolution time
- Sync success rate and retry recovery rate

## Financial/Governance KPIs
- Spend request approval cycle time
- Procurement discrepancy rate
- Payroll cycle completion time

## Marketplace KPIs
- Active listings per farm
- Interest-to-listing ratio
- Listing closure rate
- Time from listing creation to first interest

---

## 14) Risks & Mitigations

1. **Low connectivity / unstable network**
   - Mitigation: offline queue, retries, manual sync, idempotent writes.

2. **Notification channel reliability (SMS/email providers)**
   - Mitigation: channel preference fallback to in-app; dispatch logging.

3. **Data consistency under retries/concurrency**
   - Mitigation: idempotency keys and serializable transactions for critical writes.

4. **Operational complexity growth**
   - Mitigation: modular service architecture and route-level separation.

5. **PWA cache/HMR conflicts in development**
   - Mitigation: disable/unregister service worker in dev and avoid caching `/_next` and `/api`.

---

## 15) Release Plan (Phased)

## Phase 1 — Core Platform
- Auth, shell, tasks, daily updates, offline center, sync backbone, media pipeline

## Phase 2 — Control Tower
- Finance, budgets, approvals, procurement lifecycle, payroll workflows

## Phase 3 — Governance & Intelligence
- Monitoring dashboards, alerts, incidents, digest, reports, verification/audit

## Phase 4 — Ecosystem Expansion
- Vendor portal hardening, marketplace scaling, public stakeholder flows, advanced analytics

---

## 16) Test Strategy

## 16.1 Unit Tests
- Service-layer business logic and utility behavior.

## 16.2 Integration/API Tests
- Route contracts, permission boundaries, webhook verification, job auth.

## 16.3 Offline & Sync Tests
- Outbox transitions, retry behavior, sync idempotency semantics.

## 16.4 End-to-End
- Offline action -> reconnect -> successful sync path.

Current baseline validation:
- Type check (`npm run lint` => `tsc --noEmit`) passes.
- Unit test suite (`npm run test:run`) passes.

---

## 17) Compliance, Security & Privacy Notes

- Session token and role checks gate protected operations.
- API state changes enforce same-origin protections.
- Rate-limiting applied on sensitive paths.
- Logs and observability should avoid PII leakage.
- Media upload controls rely on signed URLs and validation.

---

## 18) Open Product Decisions

1. Marketplace commercial model:
   - Listing fee vs commission vs subscription
2. Marketplace trust model:
   - Ratings/reviews/KYC policy
3. Settlement model:
   - On-platform payment escrow vs off-platform settlement
4. External discoverability:
   - Farm-private marketplace vs cross-farm/public index
5. Notification policies:
   - Escalation ladder and SLA-based reminders

---

## 19) Traceability to Implemented Modules

Implemented module surfaces include:
- Setup (`/setup`) and setup API
- Monitoring (`/monitoring`) + SSE stream + alert preferences
- Reports (`/reports`) + export API
- Messages (`/messages`) + message API
- Marketplace (`/marketplace`) + marketplace API
- Existing modules: tasks, finance, procurement, payroll, incidents, audits, digest, offline, vendor, updates

---

## 20) Appendix — Example User Stories

### Owner
- As an owner, I want to review unresolved alerts and key trends so I can intervene quickly.
- As an owner, I want to approve spend and payroll actions remotely to maintain control.

### Manager
- As a manager, I want to post produce/equipment/service listings so I can source buyers/suppliers quickly.
- As a manager, I want to assign tasks and monitor completion with proof.

### Worker
- As a worker, I want to submit updates and incidents offline so work continues without signal.
- As a worker, I want to express interest in marketplace listings and communicate with stakeholders.

### Vendor
- As a vendor, I want to acknowledge orders and upload invoice evidence from a secure portal.

---

# End of PRD
