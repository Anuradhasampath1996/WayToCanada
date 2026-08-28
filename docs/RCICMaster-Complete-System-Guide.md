# RCICMaster (WayToCanada) — Complete System Guide

> **Purpose of this document:**  
> මේ file එක කියවුවම RCICMaster කියන්නේ මොන වගේ system එකක්ද, කවුද භාවිතා කරන්නේ, දැනට develop කරලා තියෙන features / APIs / apps / databases / integrations මොනවද කියලා **සම්පූර්ණ idea එකක්** ගන්න පුළුවන් විදිහට ලියලා තියෙනවා.  
> Source of truth: `f:\WayToCanada\WayToCanada` codebase.

---

## 1. RCICMaster කියන්නේ මොකක්ද?

**RCICMaster** (brand / product name: **RCICMASTER**) යනු Canadian immigration consultants (**RCIC** — Regulated Canadian Immigration Consultant) සඳහා හදපු **multi-tenant practice management platform** එකකි.

**WayToCanada** යනු මේ project එකේ repo / deploy / folder name එකයි (`/opt/waytocanada` on server).

### System එක කරන්නේ මොකද්ද?

එක platform එකකින්:

1. **Applicants / Clients** immigration journey එක start කරනවා — register, questionnaire, documents upload, consultant choose, retainer sign, payments, meetings, IRCC forms, LMS learning.
2. **RCIC Consultants** clients / cases manage කරනවා — pathway assessment, Maple AI advisor, legislation hub, letters, case pipeline, billing, trust ledger, storage, marketing, community.
3. **Platform Admins** whole system configure / moderate කරනවා — users, packages, payment gateways, integrations, LMS content, IRCC/CRS/legislation/tax sync, WhatsApp inbox, support tickets.

සරලව කිව්වොත්:  
**Immigration office software + client portal + admin console + AI tools + payments + learning**, එක API එකක් යටතේ.

---

## 2. කවුද භාවිතා කරන්නේ? (Actors / Roles)

| Role (Spatie) | Who | Main apps |
|---|---|---|
| `client` | Immigration applicant | Public website, Client dashboard, Mobile |
| `rcic` | Licensed RCIC consultant | Consultant website, Consultant dashboard, Mobile |
| `admin` / `super-admin` | Platform operators | Admin dashboard (web only) |
| Guest / Public visitor | Not logged in | Public / consultant marketing sites |

Auth: **Laravel Sanctum** bearer tokens + email/password + **Google / GitHub OAuth**.

---

## 3. Production Domains

Primary domain family: **`.rcicmaster.ca`**  
(Legacy `.rcicmaster.com` / `portal.*` → 301 redirect to `.ca`)

| Domain | App |
|---|---|
| `rcicmaster.ca` / `www` | Consultant marketing website |
| `consultant.rcicmaster.ca` | Consultant dashboard |
| `apply.rcicmaster.ca` | Public applicant website |
| `app.rcicmaster.ca` | Client / applicant dashboard |
| `admin.rcicmaster.ca` | Platform admin dashboard |
| API (same host Nginx) | Laravel on port `8000` → `/api/v1` |

---

## 4. High-Level Architecture (one glance)

```
Browser / Flutter Mobile
        │
        ▼
   Nginx + TLS (AWS EC2, ca-central-1)
        │
        ├──► Next.js Frontends (:3000, :3001, :3002, :3003, :3005)
        │
        └──► Laravel 12 API (:8000)  /api/v1
                    │
                    ├── PostgreSQL
                    │     ├── db_cws   (main workspace)
                    │     ├── db_lms   (learning)
                    │     └── db_legal (legislation)
                    │
                    ├── AWS S3 (documents)
                    ├── Database Queue + Scheduler
                    ├── OCR Service (FastAPI + EasyOCR :8001)
                    │
                    └── Third parties:
                          Stripe, PayPal, OpenAI (Maple),
                          SES, WhatsApp, Google/Zoom/Teams,
                          Google/GitHub OAuth
```

**Hosting:** Single AWS EC2 (Ubuntu 24.04, `ca-central-1`), Docker Compose, host Nginx + Certbot.  
**CI/CD:** GitHub Actions → SSH deploy to `/opt/waytocanada`.

---

## 5. Tech Stack (දැනට භාවිතා වන)

### Frontend (Web)
- **Next.js 16.0.10**
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- Radix / shadcn UI kit
- Zustand, Zod, React Hook Form
- TipTap, FullCalendar, Recharts, Motion
- Google Analytics 4 (`react-ga4`)

### Mobile
- **Flutter 3.8+**
- Riverpod, go_router, Dio, flutter_secure_storage
- Package name: `rcicmaster_mobile`
- Android primary (iOS/web scaffolds exist)
- Note: mobile folder may be local-only (often in `.gitignore`)

### Backend
- **Laravel 12** / **PHP 8.2**
- Laravel Sanctum + Spatie Permission
- Socialite (Google, GitHub)
- Stripe PHP SDK
- DomPDF, PDF parser
- Flysystem AWS S3

### Data & Infra
- **PostgreSQL 16** (3 databases)
- AWS S3 + LocalStack (local)
- AWS SES (email)
- Docker + Nginx + Certbot
- Queue: database driver
- OCR: FastAPI 0.111 + EasyOCR 1.7

---

## 6. Applications Developed (Frontends)

### 6.1 Public Applicant Website
- **Folder:** `frontend/Publick website`
- **Host:** `apply.rcicmaster.ca` (port 3000)
- **What it has:** landing, login, register, forgot/reset password, OAuth callback, entry into client journey

### 6.2 Consultant Marketing Website
- **Folder:** `frontend/Consultant Website`
- **Host:** `rcicmaster.ca` (port 3003)
- **What it has:** marketing/landing, login, register, forgot/reset password, OAuth callback → consultant dashboard

### 6.3 Client Dashboard (Public Users Dashboard)
- **Folder:** `frontend/Public users Dashbord`
- **Host:** `app.rcicmaster.ca` (port 3002)
- **Product modules:**
  - Journey home / account
  - Immigration questionnaire
  - Choose consultant
  - Document uploads
  - Retainer agreement (sign)
  - Case management
  - My pathway
  - Application / IRCC interactive forms
  - Billing / pay requests
  - Messages
  - LMS learning
  - Notifications
  - Token routes: agreement / pay / meet links

> Note: folder එකේ shadcn kit demo pages (CRM/POS etc.) තියෙන්න පුළුවන් — ඒවා **product features නෙවෙයි**.

### 6.4 Consultant Dashboard
- **Folder:** `frontend/Consultant Dashbord`
- **Host:** `consultant.rcicmaster.ca` (port 3005)
- **Product modules:**
  - Clients + client command center / workspace
  - Questionnaire review
  - Pathway calculator / CRS tools
  - Retainer agreements + templates
  - Case management + **Case Pipeline (Kanban)**
  - Client requests
  - Document review (+ OCR assist)
  - Maple AI advisor
  - Letters (AI-assisted)
  - Legislation hub (search / bookmark / AI explain)
  - Meetings / calendar
  - Payment requests + trust ledger / milestones
  - Billing / subscribe (Stripe/PayPal)
  - Storage add-ons
  - Marketing services / orders
  - RCIC community
  - Notifications / account / license verification

### 6.5 Admin Dashboard
- **Folder:** `frontend/Admins Dashbord`
- **Host:** `admin.rcicmaster.ca` (port 3001)
- **Product modules:**
  - Users (admins, RCICs, clients, immigration consultants)
  - Subscription packages & payments
  - Storage packages & subscriptions
  - Marketing services & orders
  - Client payment requests overview
  - Payment gateway settings
  - Company invoice settings
  - Integrations (mail, OpenAI, WhatsApp tests, etc.)
  - Application packages / IRCC forms tooling
  - CRS sync, GST/HST sync
  - Legislations hub + sync/analyze
  - LMS CMS
  - WhatsApp inbox
  - RCIC community moderation
  - Support tickets
  - Email templates / broadcasts / notifications
  - Platform analytics / settings

### 6.6 Demo Dashboard (NOT product)
- **Folder:** `frontend/Demo Dashbord`
- Shadcn UI kit template only (CRM/hotel/POS demos).  
- **Document / present as product feature එකක් කරන්න එපා.**

---

## 7. Mobile App Developed

**Path:** `mobileapp/` (`rcicmaster_mobile`)

| Area | Features |
|---|---|
| Client | Journey, questionnaire, retainer, case hub, trust, IRCC forms, LMS, notifications |
| Consultant | Dashboard, clients/workspace, case pipeline, calendar/meetings, legislation, templates, billing/profile |
| Shared | Notifications, CRS calculator, IRCC news, account |
| Admin | **Not supported** on mobile (use web admin) |

Architecture note: authenticated experience often bridges through a WebDashboard WebView; native feature screens also exist under `lib/features/{client,consultant,shared}`.

---

## 8. Backend API — What is built

**Base:** `https://<host>/api/v1`  
**Health:** `/up`

### 8.1 Auth & account
- Register (public client + consultant flows)
- Login / logout
- Forgot / reset password
- Email verification
- Consultant licence / CICC verification path
- Google OAuth + GitHub OAuth (web + mobile Google start)
- `GET me` (current user)
- Set password / profile basics
- Notification preferences

### 8.2 Public catalog / tools
- Subscription packages
- Storage addon packages
- Marketing services
- Consultant website features
- IRCC news
- IRCC forms tree/catalog
- CRS calculate / rules endpoints
- GST/HST tax quote endpoints

### 8.3 Token-based public links (no full login required)
- Retainer agreement: `/case-file/agreement/{token}`
- Payment request: `/payment-request/{token}`
- Meeting join: `/meeting/{token}`

### 8.4 Client APIs (authenticated)
- Client dashboard data
- Choose / request consultant
- Questionnaire submit / update
- Document upload + scan (OCR proxy)
- Case hub / messages
- Sign retainer
- Payment requests / trust view
- Meetings
- Interactive IRCC forms
- LMS course progress
- Notifications

### 8.5 Consultant APIs (authenticated)
- Profile / company / onboarding
- Clients list + client workspace detail
- Case file lifecycle / status updates
- Pathway assessment
- Questionnaire review
- Document review
- Agreement templates + send retainer
- Payment account (Stripe Connect / PayPal / Interac)
- Create client payment requests
- Trust ledger / milestones / invoices
- Meetings + OAuth meeting accounts (Google/Zoom/Teams)
- Maple AI advisor (chat / docs / advisory)
- Letter templates + AI letter generation + PDF export
- Legislation search / bookmarks / AI explain
- Case pipeline
- Client requests inbox
- LMS assign courses to clients
- Storage folders/files + storage addon checkout
- Marketing orders / checkout
- Subscription / billing / Stripe checkout
- Compliance packet / activity logs
- RCIC community + support tickets

### 8.6 Admin APIs (`/api/v1/admin/...`, role-protected)
- Stats / analytics
- Users & roles management
- RCIC CICC registry import/export
- Immigration consultants directory
- Payment gateway settings
- Integration settings + connection tests
- Packages: subscription, storage, marketing
- Website feature sections
- Payment/order exports
- Platform company settings
- Stripe test clock helpers
- Legislation sync / analyze / linkify
- GST/HST sync, CRS sync
- Application packages + interactive forms admin
- IRCC news refresh
- LMS content CMS
- WhatsApp inbox
- Community moderation
- Support tickets
- Email templates / broadcasts

### 8.7 Webhooks
- `POST /api/v1/webhooks/stripe` — payment / subscription fulfillment
- `GET|POST /api/v1/webhooks/whatsapp` — inbound WhatsApp
- PayPal webhook controller exists in code; **route may not be registered** in `routes/api.php` yet (PayPal still used via payment-account / checkout paths)

### 8.8 OCR microservice
- Separate service: `ai-service/` (FastAPI + EasyOCR, port **8001**)
- Laravel proxies: `POST /api/v1/documents/scan`

---

## 9. Databases & Data Model (summary)

### 9.1 Three PostgreSQL databases

| Connection | DB name | Purpose |
|---|---|---|
| `cws` (default) | `db_cws` | Main app: users, cases, payments, community, IRCC catalog, Maple AI, letters, notifications, etc. |
| `lms` | `db_lms` | Courses, modules, lessons, quizzes, homework, assignments, attempts |
| `legal` | `db_legal` | Legislation documents, provisions, references, sync runs |

Object files (passports, PDFs, uploads): **AWS S3** (not inside Postgres).

### 9.2 Important domain entities (developed)

**Users & clients**
- `User`, roles/permissions, `ClientProfile`, `ConsultantClientRequest`, `RcicConsultant`, `ImmigrationConsultant`

**Cases & documents**
- `CaseFile`, `CaseMessage`, `QuestionnaireSubmission`, `DocumentSubmission`, `IrccPackageDocumentSubmission`, `ClientActivityLog`, `ConsultantAgreementTemplate`

**Payments & trust**
- `SubscriptionPackage`, `ConsultantSubscription`, `SubscriptionPaymentRecord`
- `ConsultantPaymentAccount`, `ClientPaymentRequest`
- `ClientTrustAccount`, `TrustLedgerEntry`, `CaseFeeMilestone`, `MilestoneInvoice`
- `PaymentGatewaySetting`, `GstHstRateVersion`

**Meetings & notifications**
- `ClientMeeting`, `ConsultantMeetingAccount`
- `UserNotification`, `NotificationDelivery`, `UserNotificationPreference`
- `WhatsAppConversation`, `WhatsAppMessage`

**IRCC / CRS / legislation**
- `IrccCategory`, `IrccCategoryDocument`, `IrccInteractiveForm`, `IrccInteractiveFormResponse`
- `IrccNews`, `IrccFormCatalog`
- `CrsRuleVersion`, `ExpressEntryDraw`
- `LegislationDocument`, `LegislationProvision`, `LegislationReference`, `LegislationSyncRun`, `ConsultantLegislationBookmark`

**Maple AI & letters**
- `ConsultantClientAiChatMessage`, `ConsultantClientAiDocument`, `ConsultantClientAiAdvisory`
- `ConsultantLetterTemplate`, `ConsultantLetter`

**LMS**
- `LmsCategory`, `LmsCourse`, `LmsModule`, `LmsLesson`
- `LmsQuiz`, questions/options, homework
- `LmsCourseAssignment`, completions, quiz attempts, homework submissions

**Community / support / marketing / storage**
- `RcicCommunityPost/Reply/Reaction/Report`
- `SupportTicket`, `SupportTicketMessage`
- `MarketingService`, `ConsultantMarketingOrder`
- `StorageAddonPackage`, `ConsultantStorageAddon`, `ConsultantStorageFolder`, `ConsultantStorageFile`
- `IntegrationSetting`, `PlatformCompanySetting`

> Full ER sources also exist under `docs/diagrams/` (DBML / ChatGPT ER schema / Mermaid).

---

## 10. Core Business Workflow (දැනට implement වෙලා තියෙන journey)

### Case status pipeline (`CaseFile`)

1. `PENDING_ASSESSMENT`
2. `PATHWAY_SELECTED`
3. `AGREEMENT_SENT`
4. `AGREEMENT_SIGNED`
5. `DOCUMENTS_UPLOADING`
6. `UNDER_REVIEW`
7. `READY_FOR_SUBMISSION`
8. `APPLICATION_SUBMITTED`

Lifecycle overlay (multi-case): `active` → `on_hold` → `closed` / `completed`.

### End-to-end process (implemented)

1. User registers / logs in (email or OAuth)
2. Client chooses or requests an RCIC; consultant accepts / invites
3. Client fills questionnaire + uploads documents (OCR optional)
4. Consultant reviews, assigns pathway (CRS / Maple / legislation tools)
5. Consultant sends retainer; client e-signs via secure token link
6. Payment request / checkout (Stripe Connect, PayPal, or Interac option)
7. Trust milestones / invoices tracked
8. Meetings, messaging, IRCC interactive forms, package docs
9. Case moves through Kanban pipeline toward submission
10. Optional LMS courses assigned and completed
11. Compliance / activity PDFs can be exported

Reminders (agreements, payments, meetings) run on the Laravel scheduler.

---

## 11. Integrations — What each one does in the product

| Integration | Status / role in product |
|---|---|
| **Stripe** | Consultant SaaS subscriptions, storage/marketing checkout, Connect for client fee collection, webhooks, tax helpers, admin test clock |
| **PayPal** | Consultant billing path + PayPal.me / checkout for client payments (webhook controller exists; route wiring may be incomplete) |
| **Interac** | Consultant payment-account option for client collection |
| **AWS SES** | Transactional email (preferred mailer) |
| **AWS S3** | Document / file object storage |
| **OpenAI (Maple)** | Workspace AI advisor, letter generation, legislation analyze/linkify |
| **OCR service** | EasyOCR identity/document text extraction via API proxy |
| **WhatsApp** | Meta Cloud API (+ Twilio fallback), notifications + admin inbox |
| **Google Meet / Zoom / Teams** | Meeting account OAuth + schedule/remind meetings |
| **Google / GitHub OAuth** | Social login |
| **GA4** | Frontend analytics |
| **IRCC / canada.ca sync** | News + forms catalog |
| **CRS sync** | Express Entry rules + draws + calculator |
| **Legislation sync** | Justice Canada XML corpus for hub |
| **GST/HST sync** | CRA rates for tax quotes on payments |
| **DomPDF** | Retainers, invoices, letters, compliance PDFs |

---

## 12. Background Jobs & Schedules

### Queue
- Driver: **database**
- Jobs include:
  - `DeliverNotificationChannelsJob`
  - `RunLegislationSyncJob`
  - `SyncLegislationCatalogBatchJob`

### Scheduler (`America/Toronto`)

| When | Command | Why |
|---|---|---|
| Daily | `ircc:fetch-news` | Fresh IRCC news |
| 03:00 | `ircc:sync-forms` | Forms/guides catalog |
| 04:00 | `crs:sync` | CRS rules / draws |
| 05:00 | `legislation:sync` | Legal corpus |
| 06:30 | `gst-hst:sync` | Tax rates |
| 09:00 | `agreements:send-reminders` | Unsigned retainers |
| 09:30 | `payments:send-reminders` | Unpaid requests |
| Every 15 min | `meetings:send-reminders` | Upcoming meetings |

**No first-party WebSocket realtime layer** (broadcast driver is log). Notifications go in-app + email + WhatsApp via queue.

---

## 13. Cloud / DevOps

| Item | Detail |
|---|---|
| Cloud | AWS EC2, region `ca-central-1` |
| OS | Ubuntu 24.04 |
| App path | `/opt/waytocanada` |
| Containers | Postgres, Laravel API, 5 Next apps, optional OCR |
| Reverse proxy | Host Nginx + Let's Encrypt |
| CI | GitHub Actions (`ci.yml`) — Laravel tests + Postgres |
| CD | GitHub Actions (`deploy.yml`) — SSH + `deploy/deploy-on-server.sh` |
| Local | Windows Postgres / Docker LocalStack + OCR; `run-all-servers.bat` |

> Local `run-all-servers.bat` port order can differ from production Nginx mapping. For production docs, use Nginx ports.

---

## 14. Repository Map (where things live)

```
WayToCanada/
├── backend/                 Laravel 12 API
├── frontend/
│   ├── Publick website/     apply.rcicmaster.ca
│   ├── Public users Dashbord/   app.rcicmaster.ca
│   ├── Consultant Website/  rcicmaster.ca
│   ├── Consultant Dashbord/ consultant.rcicmaster.ca
│   ├── Admins Dashbord/     admin.rcicmaster.ca
│   └── Demo Dashbord/       UI kit only (not product)
├── mobileapp/               Flutter app
├── ai-service/              FastAPI OCR
├── deploy/                  Nginx, EC2, env templates, deploy scripts
├── docker-compose*.yml
├── .github/workflows/       CI + deploy
└── docs/                    Architecture, ER, UML ChatGPT prompts, this guide
```

---

## 15. Documentation already prepared for diagrams

Under `docs/diagrams/`:

| File | For generating |
|---|---|
| `system-architecture-chatgpt-prompt.md` | High-level system architecture |
| `system-flow-overview-chatgpt-prompt.md` | High-level system flow overview |
| `uml-class-diagram-chatgpt-prompt.md` | UML class diagram |
| `uml-use-case-diagram-chatgpt-prompt.md` | UML use case diagram |
| `uml-sequence-diagrams-chatgpt-prompt.md` | UML sequence diagrams |
| `uml-activity-and-dfd-chatgpt-prompt.md` | Activity diagrams + DFD |
| `waytocanada-er-chatgpt-schema.txt` / `.dbml` / `.mmd` | ER / schema diagrams |

Also: `docs/er-diagram-chen.html`, `deploy/EC2-DEPLOY.md`, `scripts/LOCAL-DEV-DATABASE.md`.

---

## 16. What is NOT the product (avoid confusion)

- `frontend/Demo Dashbord` POS/CRM/hotel demos
- Leftover shadcn kit demo routes inside some dashboards
- Anything that looks like a generic shop “Cashier / Stock Keeper / Bill Item” model — **that is not RCICMaster**

RCICMaster’s real core nouns are:  
**User, ClientProfile, CaseFile, Questionnaire, Documents, Retainer, Payments/Trust, Meetings, Maple AI, Legislation, LMS, Admin config.**

---

## 17. One-paragraph elevator summary

**RCICMaster is a production-oriented Canadian immigration practice platform:** five Next.js portals and a Flutter mobile client talk to one Laravel 12 API secured by Sanctum and role-based access; business data lives in three PostgreSQL databases plus S3 files; money moves through Stripe/PayPal (and Interac options); documents can be OCR-scanned; consultants get Maple AI, legislation tools, letters, case pipeline, and trust accounting; clients get questionnaire-to-submission journey with retainers, payments, meetings, forms, and LMS; admins run packages, gateways, sync jobs, WhatsApp, and support — all hosted on a Dockerized AWS Canada EC2 stack behind Nginx with GitHub Actions deploy.

---

## 18. Quick FAQ

**Q: API එක තියෙන්නේ කොහෙද?**  
A: `backend/` — Laravel, prefix `/api/v1`.

**Q: Frontend කීයක්ද?**  
A: Production product surfaces **5** Next apps (+ Demo kit that is not product) + Flutter mobile.

**Q: Database එක කීයද?**  
A: PostgreSQL logical DBs **3** (`db_cws`, `db_lms`, `db_legal`) + S3 for files.

**Q: AI තියෙනවද?**  
A: Yes — OpenAI-powered **Maple** advisor, letter assist, legislation tools + separate **EasyOCR** service.

**Q: Payments?**  
A: Stripe (primary), PayPal, Interac option; trust ledger + milestones for client fees; SaaS subscriptions for consultants.

**Q: Realtime WebSockets?**  
A: No dedicated product WebSocket layer; notifications via DB queue + email/WhatsApp.

---

*End of Complete System Guide — use this file as the master briefing document for RCICMaster / WayToCanada.*
