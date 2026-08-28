# CSE6035 Development Project (WRIT1) — Complete Answer Guide

**Module:** CSE6035 Development Project  
**Assessment:** Final Product / Thesis (WRIT1) — **80%**  
**Word count target:** ~8000 (references & appendices excluded)  
**Referencing:** Harvard  
**File naming for submission:** `stXXXXXXXX CSE6035 WRIT1.pdf`  
**Project (artefact):** RCICMaster / WayToCanada  

> **මේ file එකේ අරමුණ:** Assignment PDF එකේ තියෙන සෑම requirement එකකටම ඔයාගේ **RCICMaster** project එකෙන් answer ලියන්න ඕන details, structure, ready content, diagrams list, marking tips — එක තැනක.  
> Thesis එක **ඔයාගේ වචනවලින්** ලියන්න; මෙතනින් copy-paste කරලා plagiarise කරන්න එපා. මේක research + writing scaffold එකක්.

**Codebase source of truth:** `f:\WayToCanada\WayToCanada`  
**Related internal docs:** `docs/RCICMaster-Complete-System-Guide.md`, `docs/diagrams/*`

---

## 0) Quick start — මොනවා කරන්නද?

| Order | Deliverable / chapter area | මේ file එකේ section |
|------|----------------------------|---------------------|
| 1 | Project title + problem + aims/objectives | §2–§3 |
| 2 | Proposal / ethics notes | §4 |
| 3 | Literature review | §5 |
| 4 | Planning + methodology + Gantt ideas | §6 |
| 5 | SRS (requirements) | §7 |
| 6 | Design specification + diagrams | §8 |
| 7 | Implementation (artefact description) | §9 |
| 8 | Testing + evaluation | §10 |
| 9 | Conclusion, further work, abstract | §11 |
| 10 | EDGE (Ethical/Digital/Global/Entrepreneurial) | §12 |
| 11 | Thesis chapter map + marking rubric map | §13–§14 |
| 12 | Appendices checklist (supervisor logs, etc.) | §15 |

---

## 1) Assignment brief — ඔයාගෙන් බලාපොරොත්තු වෙන්නේ මොකද්ද?

### 1.1 Learning outcomes (must address in thesis)

1. **Design and develop** a project based on a software artefact.  
2. **Specify** the problem and research appropriate tools.  
3. **Conduct a literature review** in the problem context.  
4. **Evaluate** the artefact against literature and identify further work.

### 1.2 Marking weights (WRIT1)

| Category | Weight | ඔයාගේ thesis එකේ කොහෙද පෙන්නන්නේ |
|----------|--------|-----------------------------------|
| Achievement of Objectives | **25%** | Aims/objectives ↔ evaluation chapter; demo of working system |
| Use of Literature | **15%** | Literature review + critical discussion vs your solution |
| Methodology | **20%** | Research design + SDLC / Agile justification + tools |
| Analysis & Discussion / Solution Design & Implementation | **30%** | Problem analysis, SRS, design, implementation, testing |
| Report Structure & Academic Writing | **10%** | Structure, Harvard, clarity, figures labelled |

### 1.3 Project milestones (from brief)

| Milestone | Deliverables |
|-----------|--------------|
| Project Registration | Project title |
| Proposal + Presentation | Proposal, Research Ethics Approval Application, presentation |
| Progress 1 | Literature review, Project planning, **SRS** |
| Progress 2 | **Design specification** + prototype |
| Final | **Thesis document** + product / viva-demo |

### 1.4 Mandatory process notes

- Minimum **5 supervisor meetings**; signed logs in **Appendix**.  
- Final thesis needs **supervisor approval/signature**.  
- Submit PDF via Moodle/Turnitin by deadline (usually **2:00 pm**).  
- Pass mark: **40%** undergraduate (unless stated otherwise).

---

## 2) Suggested project identity (use consistently)

### 2.1 Recommended title options

**Primary (recommended):**  
**RCICMaster: A Multi-Tenant Digital Platform for Canadian Immigration Consultant Practice Management**

**Alternatives:**
1. Design and Development of a Cloud-Based Immigration Case Management System for Regulated Canadian Immigration Consultants (RCICs)
2. An AI-Assisted Practice Management Platform for Canadian Immigration Consultancies (RCICMaster)
3. WayToCanada / RCICMaster: End-to-End Digital Workflow for Immigration Applicants and RCIC Consultants

### 2.2 Brand vs repo naming (explain once in thesis)

| Name | Meaning |
|------|---------|
| **RCICMaster** | Product / brand name |
| **WayToCanada** | Repository / deployment folder name (`/opt/waytocanada`) |
| **RCIC** | Regulated Canadian Immigration Consultant |

### 2.3 One-paragraph elevator pitch (Abstract / Introduction ට)

RCICMaster is a production-oriented multi-tenant web and mobile platform that digitises the Canadian immigration consultancy workflow. Applicants register, complete questionnaires, upload documents, select consultants, e-sign retainers, pay fees, attend meetings, complete interactive IRCC-oriented forms, and study LMS content. Licensed RCIC consultants manage clients and cases through a pipeline (Kanban), pathway/CRS tools, Maple AI advisor, legislation hub, letters, trust accounting, billing, storage, marketing, and community features. Platform administrators configure users, packages, payment gateways, integrations, content sync (IRCC/CRS/legislation/tax), WhatsApp inbox, and support. Five Next.js portals and a Flutter app communicate with a Laravel 12 API, three PostgreSQL databases, AWS S3 storage, and third-party services (Stripe, PayPal, OpenAI, SES, meeting providers), hosted on AWS EC2 in Canada (`ca-central-1`).

---

## 3) Problem statement, aims, objectives, research questions

### 3.1 Problem domain (business / society gap)

Canadian immigration consulting practices still suffer from:

1. **Fragmented tools** — email + spreadsheets + shared drives + separate payment apps instead of one case lifecycle.  
2. **Compliance & trust accounting pressure** — retainers, milestones, invoices, and client funds need auditable trails.  
3. **Document-heavy processes** — passports, forms, evidence packs; manual OCR/review is slow.  
4. **Knowledge burden** — IRCC rules, CRS, legislation change frequently; consultants need searchable, AI-assisted support.  
5. **Client experience gaps** — applicants lack a clear digital journey from questionnaire → pathway → agreement → payment → submission readiness.  
6. **Multi-actor coordination** — client, RCIC, and platform operator need role-separated portals with secure access.

### 3.2 Aim (overall)

To **design, develop, and evaluate** a secure, cloud-hosted multi-tenant software platform that supports end-to-end immigration practice management for applicants, RCIC consultants, and administrators.

### 3.3 SMART objectives (map these 1:1 in Evaluation chapter)

| ID | Objective | How success is shown |
|----|-----------|----------------------|
| O1 | Analyse immigration consultancy workflow and specify functional/non-functional requirements | SRS chapter + use cases |
| O2 | Design layered architecture (web/mobile clients, API, DBs, integrations) | Architecture + UML/ER diagrams |
| O3 | Implement multi-role portals (client, RCIC, admin) with auth & RBAC | Working artefact + Sanctum/Spatie |
| O4 | Implement core case lifecycle (questionnaire → documents → retainer → payments → pipeline) | Demo + status model |
| O5 | Integrate payments (Stripe/PayPal), document storage (S3), and notifications | Integration evidence |
| O6 | Provide AI/OCR assistive features (Maple, EasyOCR) for consultants | Feature description + screenshots |
| O7 | Deploy to cloud (AWS EC2, Docker, Nginx, CI/CD) | Deploy docs / live domains |
| O8 | Test and critically evaluate against objectives and literature; propose further work | Test plan + evaluation |

### 3.4 Research / project questions (optional but strong)

1. How can a multi-tenant SaaS architecture support RCIC practice workflows securely?  
2. Which SDLC approach best fits iterative delivery of immigration practice software under academic constraints?  
3. To what extent can AI/OCR reduce consultant effort in document and pathway advisory tasks?  
4. How does the implemented artefact compare with existing generic CRM/case tools in literature and market?

### 3.5 Scope (In / Out)

**In scope (developed):**
- 5 Next.js web apps + Flutter mobile (client/consultant features)
- Laravel API `/api/v1`, Sanctum auth, Spatie roles
- Case pipeline, questionnaire, documents, retainers, payments/trust, meetings, LMS, Maple AI, legislation hub, admin ops
- PostgreSQL triple-DB model + S3
- AWS Canada deployment

**Out of scope / limitations (honest evaluation material):**
- Full IRCC government portal submission automation (system prepares readiness; IRCC e-filing remains external)
- Native admin mobile app
- Dedicated WebSocket realtime layer (notifications via queue/email/WhatsApp)
- Perfect OCR accuracy for all document languages/layouts
- Demo dashboard UI kit pages (not product)

---

## 4) Proposal & research ethics (Progress / early milestones)

### 4.1 Proposal structure you can reuse

1. Title  
2. Background & problem  
3. Aim & objectives  
4. Literature snapshot (5–8 key themes)  
5. Methodology & tools  
6. Expected deliverables & timeline  
7. Resources (hardware/software/cloud)  
8. Risks & ethics  
9. References (Harvard)

### 4.2 Ethics points to declare (Cardiff Met / BCS-aligned tone)

| Topic | How RCICMaster addresses it |
|-------|-----------------------------|
| Personal data | Immigration docs are sensitive; encryption in transit (TLS), auth required, role-based access |
| Consent | Users register; retainers/agreements require informed e-sign |
| Storage location | Prefer Canada region hosting (`ca-central-1`) for data residency narrative |
| Third parties | Stripe/PayPal/OpenAI/WhatsApp — document data-sharing necessity & config |
| AI use | Maple assists consultants; human RCIC remains responsible for advice (professional accountability) |
| Accessibility | Progressive web UI; note WCAG as further work if not fully audited |
| IP / plagiarism | Cite libraries, frameworks, government data sources; no essay mills |
| Research participants | If surveying RCICs/clients for evaluation, use consent forms + anonymised data |

### 4.3 Ethics approval application — content bullets

- Project type: software development + optional user feedback survey  
- Data collected: account profile, case data, documents (production); for research, preferably **anonymised survey/test accounts**  
- Retention: describe backup policy; student thesis uses screenshots without real PII  
- Risk level: medium (sensitive immigration data) → mitigations: test data, access control, no public dump of DB  
- Beneficiaries: RCICs, applicants, researcher learning outcomes  

---

## 5) Literature review — themes, gaps, how to write critically

> Literature = **15%**. Don’t just summarise. **Compare → critique → gap → how your system addresses the gap.**

### 5.1 Suggested thematic structure

1. **Digital transformation in professional services / legal-tech / immigration consulting**  
2. **Case management systems & workflow automation**  
3. **Multi-tenant SaaS architectures & RBAC security**  
4. **E-signature, trust accounting, and payment platforms in regulated professions**  
5. **Document intelligence (OCR) and AI assistants in knowledge work**  
6. **Cloud deployment, DevOps, and data residency**  
7. **Existing commercial tools** (research 4–6: e.g. generic CRMs, immigration-specific SaaS if publicly described) — compare features vs RCICMaster  
8. **Software process models** (Agile/Scrum, iterative, prototyping) for student/industry projects  
9. **Synthesis & research gap** → justifies RCICMaster

### 5.2 Research gap statement (template)

Existing literature and tools address CRM, document storage, or generic practice management in isolation. Few openly documented academic artefacts combine **applicant journey + RCIC workspace + admin SaaS controls + trust/payment milestones + legislation/AI assist + Canada-region cloud deployment** in one coherent multi-portal system. This project addresses that integrated gap for the RCIC domain.

### 5.3 Critical analysis tips (for 60–100 band)

- Prefer peer-reviewed papers + reputable standards (ISO/IEEE, OWASP, BCS) + official IRCC/Canada sources for domain facts.  
- For each theme: strengths of prior work → limitations → implication for your design.  
- Cite tools/frameworks academically (Laravel docs as secondary; prefer textbooks/papers for methodology).  
- End literature chapter with a **table**: Theme | Key authors | Limitation | How RCICMaster responds.

### 5.4 Placeholder Harvard examples (replace with real sources you actually read)

- Sommerville, S. (2016) *Software Engineering*. 10th edn. Pearson.  
- Pressman, R.S. and Maxim, B.R. (2019) *Software Engineering: A Practitioner’s Approach*.  
- Fowler, M. (2002) *Patterns of Enterprise Application Architecture*.  
- OWASP Foundation (n.d.) *OWASP Top Ten*.  
- Immigration, Refugees and Citizenship Canada (n.d.) official programme pages.  
*(Add 25–40 real references after your library/Google Scholar search.)*

### 5.5 Government / domain sources to cite carefully

- IRCC news & forms catalogues (your system syncs these)  
- Express Entry / CRS concepts  
- Justice Canada legislation sources (legislation hub)  
- CRA GST/HST rates (tax quotes)  
- CICC / RCIC regulatory context (licence verification narrative)

---

## 6) Methodology & project planning (20% of marks)

### 6.1 Recommended methodology (justify clearly)

**Primary:** Agile iterative / Scrum-inspired hybrid  
**Why it fits RCICMaster:**
- Large multi-portal scope needs incremental delivery  
- Requirements evolved (payments, AI, legislation sync)  
- Continuous demos align with Progress 1 / Progress 2 / Final  
- Academic time-box (≈12 weeks module rhythm) needs prioritised backlog

**Supporting practices:**
- Requirements engineering (SRS, use cases)  
- Layered architecture design before major build spikes  
- Prototype → refine (Progress 2)  
- Automated/manual testing (PHPUnit + feature tests + UAT checklists)  
- CI/CD (GitHub Actions)

**Alternatives you can discuss then reject:**
- Pure Waterfall — too rigid for multi-integration product  
- Extreme Programming alone — pairing/TDD full adoption limited for solo student  
- Research-only design science without artefact — fails module LO (must develop software)

### 6.2 Tools & environment

| Layer | Technology |
|-------|------------|
| Web frontends | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix/shadcn |
| Mobile | Flutter 3.8+, Riverpod, Dio, go_router |
| Backend | Laravel 12, PHP 8.2, Sanctum, Spatie Permission, Socialite |
| Databases | PostgreSQL 16 (`db_cws`, `db_lms`, `db_legal`) |
| Files | AWS S3 (+ LocalStack locally) |
| OCR | FastAPI + EasyOCR (`ai-service`, :8001) |
| AI | OpenAI (Maple advisor, letters, legislation assist) |
| Payments | Stripe (primary), PayPal, Interac option |
| Email | AWS SES |
| Meetings | Google Meet / Zoom / Microsoft Teams OAuth |
| Hosting | AWS EC2 Ubuntu 24.04, Docker Compose, Nginx, Let’s Encrypt, `ca-central-1` |
| CI/CD | GitHub Actions (`ci.yml`, `deploy.yml`) |
| PDF | DomPDF |
| State/forms (web) | Zustand, Zod, React Hook Form |

### 6.3 Development methodology mapping to stages

| Stage | Activities | Artefacts |
|-------|------------|-----------|
| Planning | Topic, aims, ethics, Gantt | Proposal |
| Analysis | Actors, use cases, requirements | SRS |
| Design | Architecture, ER, UML, UI structure | Design spec |
| Implementation | Sprints: auth → case → payments → AI → admin → deploy | Working product |
| Testing | Unit/feature/API/UAT | Test results |
| Evaluation | Objectives matrix, literature comparison | Discussion chapter |
| Reporting | Thesis write-up | WRIT1 PDF |

### 6.4 Example high-level Gantt (adapt to your real dates)

| Week | Focus |
|------|--------|
| 1–2 | Proposal, ethics, literature start, env setup |
| 3–4 | SRS, use cases, architecture draft |
| 5–6 | Auth + roles + core case/questionnaire/docs |
| 7–8 | Retainers, payments, pipeline prototype (Progress 2) |
| 9 | AI/OCR/legislation/LMS integrations |
| 10 | Admin + deploy hardening + testing |
| 11 | Evaluation, surveys (if any), screenshots |
| 12 | Thesis polish, abstract, supervisor sign-off, submit |

### 6.5 Risk register (put in Planning)

| Risk | Impact | Mitigation |
|------|--------|------------|
| Third-party API downtime (Stripe/OpenAI) | High | Fallbacks, config flags, graceful errors |
| OCR accuracy | Medium | Human review workflow remains |
| Scope creep | High | MoSCoW prioritisation |
| Sensitive data leak | Critical | RBAC, TLS, no real PII in thesis screenshots |
| Solo developer bandwidth | High | Vertical slices; MVP first |
| Deploy disk/SSH issues | Medium | Documented deploy scripts, backups |

---

## 7) Software Requirements Specification (SRS)

### 7.1 Stakeholders / actors

| Actor | Needs |
|-------|-------|
| Applicant / Client | Clear journey, uploads, sign, pay, learn, communicate |
| RCIC Consultant | Manage cases, assess pathway, AI tools, bill, meet, comply |
| Platform Admin | Configure packages, gateways, syncs, moderate, support |
| Guest | View marketing sites, start registration |
| System (scheduler/webhooks) | Reminders, sync IRCC/CRS/legislation/tax, payment events |

### 7.2 Functional requirements (sample — expand with MoSCoW)

#### Authentication & accounts
- FR-A1: Users can register/login with email-password.  
- FR-A2: OAuth login via Google/GitHub.  
- FR-A3: Password reset & email verification.  
- FR-A4: Role-based access (`client`, `rcic`, `admin`/`super-admin`).  
- FR-A5: Consultant licence / CICC verification path.

#### Client journey
- FR-C1: Complete immigration questionnaire.  
- FR-C2: Upload supporting documents; optional OCR scan.  
- FR-C3: Choose/request consultant.  
- FR-C4: View/sign retainer via secure token link.  
- FR-C5: View/pay payment requests.  
- FR-C6: Access case hub, messages, meetings.  
- FR-C7: Fill interactive IRCC-oriented forms.  
- FR-C8: Consume assigned LMS courses.  
- FR-C9: Receive in-app / email / WhatsApp notifications (as configured).

#### Consultant practice
- FR-R1: Manage clients & workspace (command center).  
- FR-R2: Review questionnaire & documents.  
- FR-R3: Pathway/CRS assessment tools.  
- FR-R4: Send retainer templates; track signatures.  
- FR-R5: Create payment requests; trust ledger & milestones.  
- FR-R6: Case pipeline Kanban status updates.  
- FR-R7: Maple AI advisor (chat/docs/advisory).  
- FR-R8: Letter templates + AI generation + PDF.  
- FR-R9: Legislation search/bookmarks/AI explain.  
- FR-R10: Meetings calendar + Meet/Zoom/Teams.  
- FR-R11: Storage folders/files + storage add-ons.  
- FR-R12: Marketing services orders; SaaS subscription billing.  
- FR-R13: RCIC community participation.  
- FR-R14: Compliance/activity export PDFs.

#### Admin
- FR-P1: Manage users/roles.  
- FR-P2: Configure subscription/storage/marketing packages.  
- FR-P3: Payment gateway & integration settings.  
- FR-P4: LMS CMS; IRCC/CRS/legislation/GST-HST sync controls.  
- FR-P5: WhatsApp inbox; support tickets; community moderation.  
- FR-P6: Analytics/settings/email templates/broadcasts.

### 7.3 Case status model (core domain requirement)

1. `PENDING_ASSESSMENT`  
2. `PATHWAY_SELECTED`  
3. `AGREEMENT_SENT`  
4. `AGREEMENT_SIGNED`  
5. `DOCUMENTS_UPLOADING`  
6. `UNDER_REVIEW`  
7. `READY_FOR_SUBMISSION`  
8. `APPLICATION_SUBMITTED`  

Lifecycle overlay: `active` → `on_hold` → `closed` / `completed`.

### 7.4 Non-functional requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR1 | Security | TLS; Sanctum tokens; RBAC; least privilege |
| NFR2 | Privacy | Minimise PII in logs; Canada-region hosting preference |
| NFR3 | Performance | API responses suitable for interactive dashboards; queue heavy jobs |
| NFR4 | Scalability | Multi-tenant logical separation; Dockerised services |
| NFR5 | Reliability | Scheduler reminders; Stripe webhook fulfillment; DB backups |
| NFR6 | Maintainability | Modular Laravel services; Next app separation |
| NFR7 | Usability | Role-specific portals; clear journey steps |
| NFR8 | Portability | Web responsive; Flutter mobile for client/consultant |
| NFR9 | Interoperability | REST JSON API `/api/v1` |
| NFR10 | Auditability | Activity logs; trust ledger entries |

### 7.5 MoSCoW (example)

- **Must:** Auth, roles, questionnaire, documents, case statuses, retainer, payments basics, admin packages  
- **Should:** Maple AI, OCR, legislation hub, LMS, meetings OAuth  
- **Could:** Community, marketing add-ons, WhatsApp inbox  
- **Won’t (this version):** Fully automated IRCC filing; admin mobile; realtime websockets

---

## 8) Design specification

### 8.1 High-level architecture

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

### 8.2 Production domains

| Domain | App |
|--------|-----|
| `rcicmaster.ca` / `www` | Consultant marketing website |
| `consultant.rcicmaster.ca` | Consultant dashboard |
| `apply.rcicmaster.ca` | Public applicant website |
| `app.rcicmaster.ca` | Client dashboard |
| `admin.rcicmaster.ca` | Admin dashboard |
| API via Nginx | Laravel `:8000` → `/api/v1` |

### 8.3 Frontend applications

| App folder | Host | Purpose |
|------------|------|---------|
| `frontend/Publick website` | apply.rcicmaster.ca | Applicant entry / marketing auth |
| `frontend/Consultant Website` | rcicmaster.ca | RCIC marketing + auth |
| `frontend/Public users Dashbord` | app.rcicmaster.ca | Client workspace |
| `frontend/Consultant Dashbord` | consultant.rcicmaster.ca | RCIC practice workspace |
| `frontend/Admins Dashbord` | admin.rcicmaster.ca | Platform ops |
| `frontend/Demo Dashbord` | — | **NOT product** (UI kit only) |
| `mobileapp/` | Flutter | Client + consultant mobile |

### 8.4 Design patterns / styles to mention

- **Layered / N-tier** architecture (presentation → API → domain/services → data)  
- **Multi-tenant SaaS** (shared app, role/tenant scoped data)  
- **Repository/Service** style in Laravel (`app/Services`, controllers thin)  
- **API-first** SPA/mobile clients  
- **Tokenised public actions** (agreement/pay/meet links without full session)  
- **Queue + scheduler** for async side effects  
- **Kanban pipeline** for case visualisation  
- **RBAC** (Spatie permissions)

### 8.5 Data design — three databases

| Connection | DB | Purpose |
|------------|-----|---------|
| `cws` | `db_cws` | Users, cases, payments, Maple, letters, notifications, IRCC catalog… |
| `lms` | `db_lms` | Courses, modules, lessons, quizzes, assignments |
| `legal` | `db_legal` | Legislation docs, provisions, sync runs |

**Key entities (discuss in ER chapter):**  
User, ClientProfile, CaseFile, QuestionnaireSubmission, DocumentSubmission, ConsultantAgreementTemplate, ClientPaymentRequest, ClientTrustAccount, TrustLedgerEntry, CaseFeeMilestone, ClientMeeting, IrccInteractiveForm, LmsCourse, LegislationDocument, ConsultantLetter, SupportTicket, etc.

**Diagram sources already in repo:**
- `docs/diagrams/waytocanada-full-er.dbml`
- `docs/diagrams/master-er-diagram.mmd`
- `docs/er-diagram-chen.html`
- ChatGPT prompt files for UML / architecture / DFD / sequence

### 8.6 UML / diagrams you should include in thesis

Generate/export and insert as figures (label Figure 1, Figure 2…):

1. System architecture diagram  
2. High-level system flow (case journey)  
3. Use case diagram (actors × major use cases)  
4. Class diagram (core domain)  
5. Sequence diagrams: login; document upload+OCR; retainer sign; Stripe payment; Maple chat  
6. Activity diagram: end-to-end case lifecycle  
7. DFD Level 0 / Level 1  
8. ER diagram (full or core subset)  
9. Deployment diagram (EC2, Docker, Nginx)  
10. UI wireframes/screenshots (client + consultant + admin)

Prompt files to help generate diagrams:
- `docs/diagrams/system-architecture-chatgpt-prompt.md`
- `docs/diagrams/system-flow-overview-chatgpt-prompt.md`
- `docs/diagrams/uml-*.md`

### 8.7 End-to-end business process (narrative for Activity/Sequence)

1. Register/login (email or OAuth)  
2. Client chooses/requests RCIC; consultant accepts  
3. Questionnaire + document uploads (OCR optional)  
4. Pathway assessment (CRS / Maple / legislation tools)  
5. Retainer sent → client e-signs via token link  
6. Payment request / Stripe Connect, PayPal, or Interac  
7. Trust milestones / invoices  
8. Meetings, messaging, IRCC interactive forms  
9. Case moves through Kanban toward submission readiness  
10. Optional LMS assignment/completion  
11. Compliance/activity PDF export  

### 8.8 Scheduler (design of background processes)

| When | Command |
|------|---------|
| Daily | `ircc:fetch-news` |
| 03:00 | `ircc:sync-forms` |
| 04:00 | `crs:sync` |
| 05:00 | `legislation:sync` |
| 06:30 | `gst-hst:sync` |
| 09:00 | `agreements:send-reminders` |
| 09:30 | `payments:send-reminders` |
| Every 15 min | `meetings:send-reminders` |

Timezone: `America/Toronto`.

---

## 9) Implementation — what was built (artefact evidence)

### 9.1 Repository map

```
WayToCanada/
├── backend/                 Laravel 12 API
├── frontend/                5 product Next apps (+ Demo kit)
├── mobileapp/               Flutter
├── ai-service/              FastAPI OCR
├── deploy/                  Nginx, EC2 scripts, env templates
├── docker-compose*.yml
├── .github/workflows/       CI + deploy
└── docs/                    Guides & diagram prompts
```

### 9.2 Backend capabilities (summarise by module in thesis)

- Auth & account (Sanctum, OAuth, verification, licence path)  
- Public catalog (packages, IRCC news/forms, CRS calc, tax quote)  
- Token links: agreement / payment / meeting  
- Client APIs: journey, docs, payments, LMS, notifications  
- Consultant APIs: workspace, pipeline, Maple, letters, legislation, billing, storage, community  
- Admin APIs: users, packages, gateways, syncs, WhatsApp, tickets, CMS  
- Webhooks: Stripe; WhatsApp  
- OCR proxy: `POST /api/v1/documents/scan`

### 9.3 Integrations table (implementation chapter gold)

| Integration | Role |
|-------------|------|
| Stripe | SaaS subscriptions, Connect client fees, webhooks |
| PayPal | Billing / client payment path |
| Interac | Payment-account option |
| AWS SES | Transactional email |
| AWS S3 | Document object storage |
| OpenAI | Maple AI, letters, legislation assist |
| EasyOCR | Document text extraction |
| WhatsApp | Notifications + admin inbox |
| Google/Zoom/Teams | Meetings |
| Google/GitHub OAuth | Social login |
| GA4 | Frontend analytics |
| DomPDF | Retainers, invoices, letters, compliance PDFs |

### 9.4 Coding standards & quality practices to claim honestly

- PHP / Laravel conventions; TypeScript in frontends  
- Feature tests under `backend/tests` (PHPUnit)  
- CI runs Laravel tests with PostgreSQL  
- Environment-based secrets (`.env`, not committed secrets in thesis)  
- Separated concerns: Services, Jobs, Commands, Controllers  

### 9.5 Screenshots checklist for thesis figures

Capture with **fake/test data only**:

1. Public apply site + login  
2. Client dashboard journey home  
3. Questionnaire + document upload  
4. Consultant client command center  
5. Pathway/CRS calculator  
6. Case pipeline Kanban  
7. Retainer PDF / sign screen  
8. Payment request / Stripe checkout evidence  
9. Maple AI chat  
10. Legislation hub search  
11. Admin packages / gateways  
12. Mobile app screens (optional)  
13. Architecture + ER diagrams  

---

## 10) Testing & evaluation

### 10.1 Test strategy

| Level | Approach | Examples |
|-------|----------|----------|
| Unit | PHPUnit services | CRS scoring helpers, validators |
| Feature / API | Laravel HTTP tests | Auth, case status transitions |
| Integration | Manual + webhook tests | Stripe CLI, OCR scan |
| UI / UAT | Role-based scripts | Client journey; consultant pipeline |
| Non-functional | Checklist | TLS, RBAC denial tests, backup restore note |
| Usability | Optional small survey | 5–10 users (ethics approved) |

### 10.2 Sample UAT cases

| ID | Role | Steps | Expected |
|----|------|-------|----------|
| UAT-01 | Client | Register → questionnaire → upload | Saved; visible to consultant |
| UAT-02 | RCIC | Review docs → set pathway → send retainer | Status advances; email/link works |
| UAT-03 | Client | Open agreement token → sign | `AGREEMENT_SIGNED` |
| UAT-04 | RCIC | Create payment request → client pays | Ledger/webhook updates |
| UAT-05 | RCIC | Ask Maple a pathway question | Relevant advisory returned |
| UAT-06 | Admin | Sync CRS / view packages | Data updates; no unauth access |
| UAT-07 | Guest | Hit admin API without token | 401/403 |

### 10.3 Evaluation against objectives (template table)

| Objective | Status | Evidence | Limitations |
|-----------|--------|----------|-------------|
| O1 … | Achieved / Partial | SRS §x | … |
| O2 … | Achieved | Fig. architecture | … |
| … | … | … | … |

### 10.4 Critical discussion points (high marks)

- Strengths: integrated multi-portal workflow; Canada hosting; AI/OCR assist; trust ledger  
- Weaknesses: OCR not perfect; no websockets; IRCC filing not fully automated; PayPal webhook route caveats if any  
- Comparison to literature/tools: more domain-specific than generic CRM; less mature than large commercial immigration SaaS in some polish areas  
- Validity/reliability of evaluation: test accounts vs real production load; sample size of user feedback  

### 10.5 Further work

1. Deeper WCAG accessibility audit  
2. Realtime notifications (Laravel Reverb/Pusher)  
3. Stronger automated E2E (Playwright/Cypress)  
4. Advanced fraud/compliance monitoring  
5. Multi-region HA / separate DB hosts  
6. Deeper IRCC form auto-fill from questionnaire  
7. Formal penetration test  
8. iOS store release polish  

---

## 11) Thesis writing — recommended chapter structure (~8000 words)

> Plan like a story: problem → method → build → prove → reflect.

| Chapter | Suggested focus | Approx words |
|---------|-----------------|--------------|
| Title page | ID, module, title, supervisor | — |
| Abstract | Aim, method, artefact, key findings | 250–300 |
| Acknowledgements | Optional | — |
| Contents / List of figures | Auto | — |
| **1 Introduction** | Background, problem, aim, objectives, scope, structure | 800–1000 |
| **2 Literature Review** | Themes + critical gap | 1500–1800 |
| **3 Methodology** | Agile, tools, ethics, plan | 900–1100 |
| **4 Requirements Analysis** | Actors, FR/NFR, use cases | 900–1100 |
| **5 System Design** | Architecture, UML, ER, UI design | 1200–1400 |
| **6 Implementation** | Modules, integrations, screenshots | 1200–1400 |
| **7 Testing & Evaluation** | Tests, objectives matrix, discussion | 1000–1200 |
| **8 Conclusion & Further Work** | Achievements, reflection, future | 500–700 |
| References | Harvard | excluded |
| Appendices | Ethics, Gantt, meeting logs, SRS extras, code samples | excluded |

### 11.1 Abstract writing checklist

- Problem one sentence  
- Aim one sentence  
- Method one sentence  
- What was built (tech stack one phrase)  
- Evaluation outcome one sentence  
- Contribution / further work half sentence  

### 11.2 Conclusion writing checklist

- Restate aim  
- Objectives achieved? (table summary)  
- Contribution to domain  
- Personal learning reflection  
- Limitations  
- Further work  

---

## 12) Cardiff Met EDGE mapping (explicitly write a subsection)

| EDGE | How RCICMaster / your process demonstrates it |
|------|-----------------------------------------------|
| **Ethical** | Sensitive immigration PII; consent via agreements; RBAC; AI as assist not replacement; cite IP; avoid real client data in thesis |
| **Digital** | Modern stack (Next/Laravel/Flutter), cloud DevOps, AI/OCR, payment APIs, CI/CD |
| **Global** | Cross-border immigration domain; Canada data residency narrative; multi-language legislation corpus awareness; cultural sensitivity in client journey UX |
| **Entrepreneurial** | SaaS packages for RCICs; marketing add-ons; storage add-ons; platform marketplace dynamics between clients & consultants |

---

## 13) Marking rubric — how to aim 70–100

| Category | 70–100 behaviours |
|----------|-------------------|
| Objectives (25%) | All objectives met; innovative extras (Maple, legislation sync, trust ledger) clearly evidenced |
| Literature (15%) | Extensive, critical, insightful citations; gap clearly drives design |
| Methodology (20%) | Justified Agile + limitations discussed; ethics & plan credible |
| Design & Implementation (30%) | Deep analysis; alternatives considered; high-quality architecture & working product |
| Report (10%) | Professional structure; error-free academic English; labelled figures; consistent Harvard |

**Common fail patterns to avoid:**
- Feature laundry list without problem/literature link  
- Screenshots without evaluation  
- No supervisor meeting logs  
- Uncited AI-generated text / plagiarism  
- Claiming Demo Dashboard as product  
- Ignoring security/privacy for immigration data  

---

## 14) Viva / demonstration script (5–10 minutes)

1. Problem (30s)  
2. Architecture slide (45s)  
3. Live: client questionnaire → upload (1–2 min)  
4. Live: consultant review → pathway → send retainer (2 min)  
5. Live: payment or pipeline move (1 min)  
6. Maple or legislation quick demo (45s)  
7. Admin package/gateway glimpse (30s)  
8. Evaluation + further work (45s)  
9. Q&A ready topics: why Laravel, why 3 DBs, ethics of AI advice, Stripe Connect, multi-tenant risks  

---

## 15) Appendices checklist (final PDF)

- [ ] Signed supervisor meeting logs (≥5)  
- [ ] Ethics approval application / approval evidence  
- [ ] Project Gantt / sprint backlog sample  
- [ ] Full FR/NFR tables if truncated in main text  
- [ ] Extra UML diagrams  
- [ ] Sample questionnaire fields  
- [ ] Test case sheets + results  
- [ ] Deployment notes summary  
- [ ] Glossary (RCIC, CRS, IRCC, CICC, SaaS, RBAC, OCR)  
- [ ] Selected code excerpts (short; not whole repo)

---

## 16) Ready “facts pack” — copy into chapters carefully (paraphrase)

### 16.1 Product summary facts

- Multi-tenant RCIC practice management platform  
- Actors: client, rcic, admin/super-admin  
- 5 Next.js portals + Flutter mobile + Laravel API  
- 3 PostgreSQL DBs + S3 files  
- Hosted AWS EC2 Canada, Docker, Nginx, GitHub Actions  
- Payments: Stripe, PayPal, Interac option  
- AI: Maple (OpenAI); OCR: EasyOCR microservice  
- Case statuses: PENDING_ASSESSMENT → … → APPLICATION_SUBMITTED  

### 16.2 Innovation claims you can defend

1. Domain-specific end-to-end immigration consultancy workflow (not generic CRM only)  
2. Dual-sided marketplace journey (applicant ↔ RCIC) under one API  
3. Trust ledger + milestone invoicing for professional fee handling  
4. Maple AI + legislation corpus assist grounded in synced legal data  
5. Operational sync jobs for IRCC news/forms, CRS, GST/HST  
6. Canada-region deployment aligned with data sensitivity narrative  

### 16.3 Honest limitations (builds trust with markers)

- Not a replacement for licensed RCIC professional judgement  
- OCR/AI can err → human verification required  
- IRCC final submission portals remain external  
- Realtime websocket layer not implemented  
- Commercial competitors may have larger sales/support orgs  

---

## 17) Sinhala quick guide — thesis ලියනකොට මතක තියාගන්න

1. **Problem** පැහැදිලිව: immigration consultancy fragmented tools.  
2. **Aim/Objectives** හදාගෙන Evaluation එකේ එකින් එක tick කරන්න.  
3. **Literature** critique නැතුව marks අඩුයි — gap එකෙන් RCICMaster justify කරන්න.  
4. **Methodology** Agile කියලා විතරක් නෙවෙයි — ඇයිද කියලා ලියන්න.  
5. **SRS + Design diagrams** Progress milestones වලටත් final එකටත් ඕන.  
6. **Implementation** screenshots + architecture + integrations.  
7. **Testing + Evaluation** objectives table එක compulsory වගේ සලකන්න.  
8. **Ethics + supervisor logs** appendix එකේ තියන්න — නැත්නම් mark නෑ කියලා brief එකේ තියෙනවා.  
9. **Harvard** only; Turnitin එකට කලින් 24h කලින් submit කරන්න.  
10. Demo Dashbord / shadcn demo pages **product කියලා ලියන්න එපා**.

---

## 18) Submission compliance card

| Item | Value |
|------|--------|
| Module | CSE6035 Development Project |
| Assessment | WRIT1 Final Product / Thesis (80%) |
| Format | PDF via Moodle Turnitin |
| Filename | `st{YourID} CSE6035 WRIT1` |
| Word count | ~8000 (appendices/refs excluded) |
| Referencing | Harvard |
| Artefact | RCICMaster / WayToCanada working system |
| Must include | Supervisor signed thesis + meeting logs appendix |

---

## 19) Related project documentation (deeper technical)

| File | Use for |
|------|---------|
| `WayToCanada/docs/RCICMaster-Complete-System-Guide.md` | Full system truth |
| `docs/diagrams/system-architecture-chatgpt-prompt.md` | Architecture figure |
| `docs/diagrams/system-flow-overview-chatgpt-prompt.md` | Flow overview figure |
| `docs/diagrams/uml-*.md` | UML generation prompts |
| `docs/diagrams/waytocanada-full-er.dbml` | ER diagram |
| `deploy/EC2-DEPLOY.md` | Deployment chapter evidence |

---

## 20) Next actions for you (practical)

1. Confirm **exact title** with supervisor.  
2. Fill **student ID**, supervisor name, real dates into proposal/thesis.  
3. Do a proper **literature search** (replace placeholder refs).  
4. Export **diagrams** from prompts/DBML into PNG for thesis.  
5. Take **screenshots** with dummy data.  
6. Run through **UAT checklist**; record results.  
7. Keep **meeting log** template and get signatures.  
8. Write chapter-by-chapter; put Abstract & Conclusion last.  
9. Supervisor draft feedback → final PDF → Turnitin.

---

*End of CSE6035 WRIT1 Complete Answer Guide for RCICMaster / WayToCanada.*  
*Paraphrase into your own academic voice. Do not submit this guide as the thesis.*
