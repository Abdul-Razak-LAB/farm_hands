# Absentee Farmer Platform - Detailed Implementation Backlog

Version: 1.0  
Date: 2026-03-07

This backlog is tailored to the current architecture:
- Next.js App Router routes under `src/app/(dashboard)` and `src/app/api/farms/[farmId]`
- Service layer under `src/services/*`
- Shared contracts in `src/lib/api/contracts.ts`
- Event-driven/idempotent write pattern via `Event` and `idempotencyKey`
- Prisma/PostgreSQL schema in `prisma/schema.prisma`

## 1) Prioritized Epics

## EPIC A1 - Owner Control Tower and Predictive Analytics
Goal: Give absentee owners early warning and decision support, not only historical reporting.

Scope:
- Exception dashboard for owner persona (yield risk, budget overrun risk, labor SLA breaches)
- Forecast cards for 7/30/90 day scenarios
- Action recommendations linked to tasks/procurement/finance approvals

Backend:
- Add analytics service: `src/services/control/control-tower-service.ts`
- Extend reporting service for predictive summaries: `src/services/reporting/reporting-service.ts`

APIs:
- `GET /api/farms/:farmId/control/tower`
- `GET /api/farms/:farmId/control/forecasts?window=7d|30d|90d`
- `POST /api/farms/:farmId/control/recommendations/:recommendationId/execute`

UI routes:
- `src/app/(dashboard)/digest/page.tsx` (enhance with predictive cards)
- New: `src/app/(dashboard)/control/page.tsx`
- New: `src/components/features/control/control-tower-module.tsx`

Acceptance:
- Owner can see top 5 exceptions in <= 2 clicks
- Forecast endpoints return in < 600ms p95 for medium farm dataset

---

## EPIC A2 - Crop Planning and Rotation Management
Goal: Move from reactive tasks to season-based planning and auto-generated execution.

Scope:
- Seasonal plan creation by farm/field
- Crop rotation constraints and recommended sequence
- Planting, pruning, spraying, harvest windows
- Auto-create tasks from plan milestones

Backend:
- New service: `src/services/crop/crop-planning-service.ts`
- Integrate with task service for plan-to-task generation

APIs:
- `GET /api/farms/:farmId/crop/plans`
- `POST /api/farms/:farmId/crop/plans`
- `GET /api/farms/:farmId/crop/plans/:planId`
- `POST /api/farms/:farmId/crop/plans/:planId/publish`
- `POST /api/farms/:farmId/crop/plans/:planId/generate-tasks`
- `GET /api/farms/:farmId/crop/calendar?from=<ISO>&to=<ISO>`

UI routes:
- New: `src/app/(dashboard)/crop/page.tsx`
- New: `src/app/(dashboard)/crop/plans/[planId]/page.tsx`
- New: `src/components/features/crop/crop-planning-module.tsx`

Acceptance:
- Publishing a plan creates dated milestones
- Task generation is idempotent via `idempotencyKey`

---

## EPIC A3 - Precision Agriculture 2.0 (Drone/Satellite/IoT)
Goal: Upgrade existing monitoring to multi-source agronomic intelligence.

Scope:
- Ingest drone/satellite snapshots (NDVI/EVI/SAVI by field)
- Sensor-to-field anomaly detection
- Yield risk score and prescription suggestions

Current baseline leveraged:
- Existing NDVI and weather analytics in `src/services/monitoring/monitoring-service.ts`
- Existing sensors in `SensorDevice`/`SensorReading`

Backend:
- Extend `monitoring-service.ts`
- New provider adapters under `src/lib/integrations/imagery/*`

APIs:
- `POST /api/farms/:farmId/monitoring/imagery/ingest`
- `GET /api/farms/:farmId/monitoring/field-analytics`
- `GET /api/farms/:farmId/monitoring/yield-risk`
- `POST /api/farms/:farmId/monitoring/prescriptions`

UI routes:
- `src/app/(dashboard)/monitoring/page.tsx` (add field map + vegetation layers)
- New: `src/app/(dashboard)/monitoring/precision/page.tsx`

Acceptance:
- Field-level vegetation trend visible for last 4 weeks
- Alert fatigue reduced via grouped anomaly alerts

---

## EPIC A4 - Weather and Climate Decisioning
Goal: Convert weather data into concrete operational recommendations.

Scope:
- Hyperlocal forecast and climate stress index
- Rules engine for operation recommendations (spray, irrigation, harvest)
- Severe weather playbooks

Backend:
- Extend monitoring service + alert rules

APIs:
- `GET /api/farms/:farmId/weather/forecast`
- `GET /api/farms/:farmId/weather/alerts`
- `GET /api/farms/:farmId/weather/recommendations`
- `POST /api/farms/:farmId/weather/playbooks/:playbookId/ack`

UI routes:
- `src/app/(dashboard)/monitoring/page.tsx` (weather decision panel)
- New: `src/app/(dashboard)/monitoring/weather/page.tsx`

Acceptance:
- Recommendation payload includes confidence + rationale

---

## EPIC A5 - Supply Chain and Logistics
Goal: Extend current procurement delivery confirmation to outbound logistics and traceability.

Scope:
- Shipment creation and dispatch tracking
- Delivery ETA and proof-of-delivery
- Lot/batch traceability from farm to buyer

Current baseline leveraged:
- Procurement and delivery flow in `src/services/procurement/procurement-service.ts`

Backend:
- New service: `src/services/logistics/logistics-service.ts`
- Extend `src/services/supply/supply-service.ts`

APIs:
- `POST /api/farms/:farmId/logistics/shipments`
- `GET /api/farms/:farmId/logistics/shipments`
- `GET /api/farms/:farmId/logistics/shipments/:shipmentId`
- `POST /api/farms/:farmId/logistics/shipments/:shipmentId/status`
- `GET /api/farms/:farmId/logistics/traceability/:batchId`

UI routes:
- New: `src/app/(dashboard)/logistics/page.tsx`
- New: `src/components/features/logistics/logistics-module.tsx`

Acceptance:
- Shipment timeline with status transitions and audit trail

---

## EPIC A6 - Marketplace Trust and Settlement
Goal: Scale current marketplace into a dependable trade channel.

Scope:
- Buyer/seller reputation and verification
- Offer negotiation workflow
- Escrow/settlement status integrated with payment rails

Current baseline leveraged:
- Existing listing/interest flow in `src/services/marketplace/marketplace-service.ts`
- Existing Paystack/Hubtel integrations in `src/lib/integrations/payments/gateway.ts`

Backend:
- Extend `marketplace-service.ts`
- Add settlement service: `src/services/marketplace/settlement-service.ts`

APIs:
- `POST /api/farms/:farmId/marketplace/listings/:listingId/offers`
- `POST /api/farms/:farmId/marketplace/offers/:offerId/decision`
- `POST /api/farms/:farmId/marketplace/orders/:orderId/initialize-payment`
- `GET /api/farms/:farmId/marketplace/reputation`

UI routes:
- `src/app/(dashboard)/marketplace/page.tsx` (offers + settlement tab)

Acceptance:
- Listing->Offer->Accepted->Payment flow tracked end-to-end

---

## EPIC A7 - Certification and Compliance
Goal: Operationalize compliance for certifications and export readiness.

Scope:
- Compliance framework templates (Organic, GAP, Fair Trade)
- Evidence vault and expiry reminders
- Non-conformance remediation tasks

Current baseline leveraged:
- Existing audits module/routes and `Audit*` models

Backend:
- New service: `src/services/compliance/compliance-service.ts`
- Extend audit service to map audits to certification controls

APIs:
- `GET /api/farms/:farmId/compliance/frameworks`
- `POST /api/farms/:farmId/compliance/frameworks/:frameworkId/enroll`
- `GET /api/farms/:farmId/compliance/controls`
- `POST /api/farms/:farmId/compliance/evidence`
- `GET /api/farms/:farmId/compliance/deadlines`

UI routes:
- New: `src/app/(dashboard)/compliance/page.tsx`
- New: `src/components/features/compliance/compliance-module.tsx`

Acceptance:
- Compliance status by framework: PASS/AT_RISK/FAILED
- Evidence linked to controls and expiry date

---

## EPIC A8 - Financial Services (Loans, Insurance, Schemes)
Goal: Increase farmer liquidity and risk cover beyond payment processing.

Scope:
- Loan pre-qualification and application tracking
- Insurance quote/request/claim tracking
- Government scheme eligibility and application status

Backend:
- New service: `src/services/finance/financial-services-service.ts`
- New service: `src/services/schemes/government-schemes-service.ts`
- Provider adapters in `src/lib/integrations/finance/*`

APIs:
- `POST /api/farms/:farmId/finance/loans/applications`
- `GET /api/farms/:farmId/finance/loans/applications`
- `POST /api/farms/:farmId/finance/insurance/requests`
- `GET /api/farms/:farmId/finance/insurance/policies`
- `GET /api/farms/:farmId/schemes/eligibility`
- `POST /api/farms/:farmId/schemes/applications`

UI routes:
- New: `src/app/(dashboard)/finance/services/page.tsx`
- New: `src/app/(dashboard)/schemes/page.tsx`

Acceptance:
- Owner can track loan/insurance/scheme statuses from one page

---

## EPIC A9 - Knowledge Base, Training, and Community
Goal: Improve team capability and peer collaboration.

Scope:
- SOP/knowledge article library
- Role-based training modules and completion tracking
- Moderated community forum

Backend:
- New service: `src/services/knowledge/knowledge-service.ts`
- New service: `src/services/community/community-service.ts`

APIs:
- `GET /api/farms/:farmId/knowledge/articles`
- `POST /api/farms/:farmId/knowledge/articles`
- `GET /api/farms/:farmId/training/modules`
- `POST /api/farms/:farmId/training/modules/:moduleId/complete`
- `GET /api/farms/:farmId/community/threads`
- `POST /api/farms/:farmId/community/threads`
- `POST /api/farms/:farmId/community/threads/:threadId/replies`

UI routes:
- New: `src/app/(dashboard)/knowledge/page.tsx`
- New: `src/app/(dashboard)/training/page.tsx`
- New: `src/app/(dashboard)/community/page.tsx`

Acceptance:
- Worker can complete role-specific training in <= 10 minutes/module

---

## EPIC A10 - Multilingual and Worker Mobile Hardening
Goal: Improve accessibility and usability for distributed worker teams.

Scope:
- App localization framework and language switcher
- Translation coverage for critical workflows
- Mobile hardening of existing PWA and optional native wrapper

Current baseline leveraged:
- Existing PWA/offline center in `public/manifest.json`, `public/sw.js`, `src/hooks/use-offline-sync.ts`

Backend:
- API localizable copy metadata (where needed)

APIs:
- `GET /api/farms/:farmId/localization/languages`
- `GET /api/farms/:farmId/localization/resources?locale=<locale>`

UI routes:
- Keep existing routes, add locale segment strategy:
  - Option A (incremental): i18n in-client dictionaries
  - Option B (full): `src/app/[locale]/(dashboard)/*`

Acceptance:
- Full task/procurement/offline flows in top 2 target languages

## 2) API Backlog by Route Namespace

All mutating endpoints must keep existing envelope style and idempotency semantics:
- Success: `{ success: true, data }`
- Error: `{ success: false, error: { code, message, details? } }`
- Mutations: require `idempotencyKey`

New API namespaces to create under `src/app/api/farms/[farmId]/`:
- `control/*`
- `crop/*`
- `weather/*`
- `logistics/*`
- `compliance/*`
- `schemes/*`
- `knowledge/*`
- `training/*`
- `community/*`
- `localization/*`

Existing namespaces to extend:
- `monitoring/*` (precision inputs + yield risk)
- `marketplace/*` (offers/settlement)
- `finance/*` (loan/insurance)
- `reports/*` and `digest/*` (predictive insights)

## 3) Prisma Model Backlog (Proposed Additions)

Additive changes only; keep current core models intact.

### 3.1 Crop and Field Planning
- `Field`
  - `id`, `farmId`, `name`, `hectares`, `locationGeoJson`, `soilType`, `createdAt`
- `SeasonPlan`
  - `id`, `farmId`, `name`, `seasonYear`, `status`, `startsAt`, `endsAt`, `createdBy`, `idempotencyKey`, `createdAt`
- `FieldPlan`
  - `id`, `seasonPlanId`, `fieldId`, `cropName`, `variety`, `targetYieldPerHa`, `rotationGroup`, `createdAt`
- `PlanMilestone`
  - `id`, `seasonPlanId`, `fieldId`, `type`, `scheduledAt`, `status`, `taskId?`, `createdAt`

Indexes/constraints:
- `@@index([farmId, seasonYear, status])` on `SeasonPlan`
- `@@unique([farmId, idempotencyKey])` on mutating plan entities

### 3.2 Precision and Weather Intelligence
- `ImagerySnapshot`
  - `id`, `farmId`, `fieldId?`, `source`, `capturedAt`, `metrics Json`, `assetUrl?`, `createdAt`
- `FieldAnalytics`
  - `id`, `farmId`, `fieldId`, `periodStart`, `periodEnd`, `ndvi`, `evi`, `savi`, `yieldRiskScore`, `createdAt`
- `WeatherObservation`
  - `id`, `farmId`, `provider`, `observedAt`, `payload Json`, `createdAt`

Indexes:
- `@@index([farmId, capturedAt])`, `@@index([farmId, fieldId, periodStart])`

### 3.3 Logistics and Traceability
- `Shipment`
  - `id`, `farmId`, `reference`, `buyerName`, `status`, `eta`, `dispatchAt?`, `deliveredAt?`, `createdAt`
- `ShipmentItem`
  - `id`, `shipmentId`, `inventoryItemId?`, `batchId?`, `qty`, `unit`, `createdAt`
- `BatchTrace`
  - `id`, `farmId`, `batchCode`, `sourceType`, `sourceRef`, `status`, `metadata Json`, `createdAt`

Indexes:
- `@@index([farmId, status, createdAt])`, `@@unique([farmId, batchCode])`

### 3.4 Compliance
- `ComplianceFramework`
  - `id`, `code`, `name`, `version`, `isActive`, `createdAt`
- `FarmComplianceEnrollment`
  - `id`, `farmId`, `frameworkId`, `status`, `startDate`, `targetAuditDate`, `createdAt`
- `ComplianceControl`
  - `id`, `frameworkId`, `controlCode`, `title`, `requirement`, `severity`, `createdAt`
- `ComplianceEvidence`
  - `id`, `farmId`, `controlId`, `attachmentId?`, `notes`, `expiresAt?`, `status`, `createdAt`

Indexes:
- `@@index([farmId, status, targetAuditDate])`

### 3.5 Financial Services and Schemes
- `LoanApplication`
  - `id`, `farmId`, `provider`, `amount`, `currency`, `status`, `payload Json`, `idempotencyKey`, `createdAt`
- `InsurancePolicy`
  - `id`, `farmId`, `provider`, `policyNumber`, `coverageType`, `status`, `startsAt`, `endsAt`, `createdAt`
- `InsuranceClaim`
  - `id`, `farmId`, `policyId`, `claimRef`, `status`, `amount`, `payload Json`, `createdAt`
- `GovernmentScheme`
  - `id`, `countryCode`, `name`, `description`, `eligibility Json`, `isActive`, `createdAt`
- `SchemeApplication`
  - `id`, `farmId`, `schemeId`, `status`, `submittedAt?`, `payload Json`, `idempotencyKey`, `createdAt`

### 3.6 Knowledge and Community
- `KnowledgeArticle`
  - `id`, `farmId`, `title`, `slug`, `category`, `content`, `authorUserId`, `status`, `createdAt`, `updatedAt`
- `TrainingModule`
  - `id`, `farmId`, `title`, `roleScope`, `durationMin`, `content Json`, `isActive`, `createdAt`
- `TrainingCompletion`
  - `id`, `farmId`, `moduleId`, `userId`, `score?`, `completedAt`, `createdAt`
- `CommunityThread`
  - `id`, `farmId`, `title`, `body`, `createdBy`, `status`, `createdAt`
- `CommunityReply`
  - `id`, `farmId`, `threadId`, `body`, `createdBy`, `createdAt`

### 3.7 Localization
- `LanguagePack`
  - `id`, `locale`, `namespace`, `version`, `resources Json`, `isActive`, `createdAt`
- `FarmLanguagePreference`
  - `id`, `farmId`, `defaultLocale`, `supportedLocales Json`, `createdAt`, `updatedAt`

## 4) UI Route Backlog (App Router)

Add these route groups under `src/app/(dashboard)`:
- `control/page.tsx`
- `crop/page.tsx`
- `crop/plans/[planId]/page.tsx`
- `monitoring/precision/page.tsx`
- `monitoring/weather/page.tsx`
- `logistics/page.tsx`
- `compliance/page.tsx`
- `schemes/page.tsx`
- `finance/services/page.tsx`
- `knowledge/page.tsx`
- `training/page.tsx`
- `community/page.tsx`

Component modules to add under `src/components/features`:
- `control/`, `crop/`, `logistics/`, `compliance/`, `schemes/`, `knowledge/`, `training/`, `community/`

Navigation updates:
- Add role-scoped items in `src/components/layout/navigation-shell.tsx`
- Add route guards in `src/components/layout/route-access.ts`

## 5) Service Layer and Contract Updates

Service folders to add:
- `src/services/crop/`
- `src/services/logistics/`
- `src/services/compliance/`
- `src/services/schemes/`
- `src/services/knowledge/`
- `src/services/community/`

Contracts to extend:
- `src/lib/api/contracts.ts`
  - Add domain types for crop plans, logistics shipment DTOs, compliance statuses, scheme eligibility, training/community payloads

Client calls:
- Keep using shared API client `src/lib/api/farm-client.ts`
- Avoid new per-module fetch wrappers

## 6) Delivery Plan (12 Weeks)

Sprint 1-2 (Weeks 1-4):
- EPIC A2 (Crop Planning MVP)
- EPIC A1 (Control Tower v1)
- Prisma migrations for crop/field + analytics

Sprint 3-4 (Weeks 5-8):
- EPIC A3 (Precision 2.0)
- EPIC A4 (Weather Decisioning)
- EPIC A5 (Logistics + traceability v1)

Sprint 5-6 (Weeks 9-12):
- EPIC A7 (Compliance)
- EPIC A8 (Financial services + schemes v1)
- EPIC A9 (Knowledge/training) and A10 (Multilingual v1)

## 7) Non-Functional and Testing Backlog

Testing additions:
- API tests for each new namespace under `src/app/api/**/route.test.ts`
- Service unit tests for rule engines (forecast/recommendation/compliance)
- Offline conflict/retry tests for new mutation-heavy domains
- E2E flows: crop-plan->task generation, listing->offer->settlement, compliance evidence submission

Operational safeguards:
- Add rate limits and permission checks on all new mutating routes
- Enforce `idempotencyKey` for create/update actions
- Add observability traces and structured logs for recommendation execution and external-provider calls

## 8) Initial Ticket Seed (Ready for Jira/Linear)

A1-01: Create control tower API and service skeleton  
A1-02: Add predictive summary cards to digest/control UI  
A2-01: Introduce `SeasonPlan`, `FieldPlan`, `PlanMilestone` models + migration  
A2-02: Implement crop plan CRUD APIs  
A2-03: Implement task generation from milestones (idempotent)  
A3-01: Add imagery ingestion endpoint and adapter interface  
A3-02: Add field-level precision view in monitoring UI  
A4-01: Build weather recommendation engine endpoint  
A5-01: Add shipment and traceability models + APIs  
A6-01: Implement marketplace offers decision workflow  
A7-01: Add compliance framework/enrollment/control models  
A7-02: Build compliance deadlines and evidence APIs  
A8-01: Add loan and insurance application APIs  
A8-02: Add government scheme eligibility engine v1  
A9-01: Build knowledge article CRUD and training completion flow  
A9-02: Add community thread/reply APIs with moderation status  
A10-01: Add localization resources API and language preference model  
A10-02: Translate tasks/procurement/offline modules for top 2 locales
