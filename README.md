# SetuCare (सेतुकेअर)

SetuCare is a full-stack healthcare referral and continuity platform for stepped-care clinical navigation across rural health facilities. It connects frontline workers, primary care units, rural hospitals, and district hospitals into a single continuity model for patient registration, QR-based lookup, clinical encounters, and facility-driven care coordination.

This project is built as a monorepo with:

- a React + Vite frontend for clinical workflows
- an Express + MongoDB backend for secure APIs and business logic
- role-based access and facility-scoped authorization
- PHID-based patient identity and QR-based continuity across facilities

---

## 1. Project purpose

The app is designed for a real-world public-health workflow in India, especially around referral and stepped-care pathways.

Core goals:

- register patients with a unique Patient Health ID (PHID)
- generate QR codes for patient continuity
- allow cross-facility lookup using PHID
- record clinical encounters with vitals and symptoms
- enforce facility-aware access rules and role permissions
- manage a four-tier facility hierarchy from sub-centre to district hospital
- support admin operations for facility setup and hierarchy management

---

## 2. High-level architecture

### Frontend

- React 18
- Vite
- Zustand for auth state
- Axios with cookie-based auth
- lucide-react icons
- custom CSS-based dashboard UI

### Backend

- Node.js + Express
- MongoDB with Mongoose
- JWT-based auth using httpOnly cookies
- structured controllers, routes, middleware, and models
- QR generation utilities and PHID generation logic

### Security model

- JWT is issued on login/register and stored in an httpOnly cookie
- routes are protected with `protect`
- access is restricted by role using `roleGuard`
- facility boundaries are enforced with `facilityScope`

---

## 3. Repository structure

```text
133/
├── package.json                     # root scripts for dev + install
├── README.md                       # project documentation
├── client/                         # React frontend
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── api/
│       │   └── axios.js
│       ├── components/
│       │   ├── AccessTester.jsx
│       │   ├── EncounterCreateModal.jsx
│       │   ├── Navbar.jsx
│       │   ├── PatientCardModal.jsx
│       │   ├── QRScanner.jsx
│       │   └── SchemaViewer.jsx
│       ├── pages/
│       │   ├── AdminFacilitiesPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── LoginPage.jsx
│       │   ├── PatientRegisterPage.jsx
│       │   ├── PatientsListPage.jsx
│       │   ├── RegisterPage.jsx
│       │   └── ScanLookupPage.jsx
│       ├── stores/
│       │   └── authStore.js
│       └── utils/
│           └── symptomVocabulary.js
├── server/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── config/
│       │   └── db.js
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── encounterController.js
│       │   ├── facilityController.js
│       │   └── patientController.js
│       ├── middleware/
│       │   ├── auth.js
│       │   ├── facilityScope.js
│       │   └── roleGuard.js
│       ├── models/
│       │   ├── Encounter.js
│       │   ├── Facility.js
│       │   ├── FollowUp.js
│       │   ├── Patient.js
│       │   ├── Referral.js
│       │   ├── ScanLog.js
│       │   ├── User.js
│       │   └── index.js
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── encounterRoutes.js
│       │   ├── facilityRoutes.js
│       │   └── patientRoutes.js
│       ├── seed/
│       │   └── facilities.js
│       └── utils/
│           ├── phidGenerator.js
│           └── qrGenerator.js
└── ...
```

---

## 4. Core data model

The backend revolves around a small but powerful domain model.

### User

The `User` model represents a healthcare worker or admin.

Roles:

- `frontline_worker`
- `medical_officer`
- `specialist`
- `program_manager`
- `admin`

Each user may belong to a facility, unless they are an admin. Passwords are hashed with `bcryptjs`, and JWT is issued on successful login.

### Facility

The `Facility` model models the stepped-care hierarchy.

Facility tiers:

- `sub_centre`
- `phc`
- `rural_hospital`
- `district_hospital`

It supports:

- `parentFacility` relationships
- `district` and `state` metadata
- location coordinates (`lat`, `lng`)
- active/inactive status
- `shortCode` for quick lookup and display

The hierarchy is validated to ensure correct parent-child progression:

- district hospital → root
- rural hospital → district hospital parent
- PHC → rural hospital parent
- sub-centre → PHC parent

### Patient

The `Patient` model stores demographic and registration info.

Important fields:

- `phid`: unique patient health ID
- `name`, `dob`, `gender`
- `guardianName`
- `phone`, `address`
- `registeredAtFacility`
- `preferredLanguage`

This is the identity backbone of the system.

### Encounter

The `Encounter` model records patient visits and clinical observations.

Fields include:

- `patient`
- `facility`
- `worker`
- `vitals` (`bp`, `tempC`, `pulse`, `weightKg`, `spo2`)
- `symptoms`
- `notes`
- `triageResult`
- `encounterType`

This represents the clinical event history used during patient continuity and referral review.

### Additional models

The project also contains models for:

- `Referral`
- `FollowUp`
- `ScanLog`

These are part of the broader continuity and follow-up workflow, even though the current phase focuses heavily on patient registration, lookup, facility management, and encounter recording.

---

## 5. How the app works

### Authentication flow

1. User opens the app.
2. Frontend calls `GET /api/auth/me` on startup through `useAuthStore.fetchMe()`.
3. If a valid JWT cookie exists, the user is considered logged in.
4. If not, the app routes user to the login screen.
5. On login/register, backend creates or validates user, hashes password if needed, and sets an `httpOnly` `token` cookie.

The frontend uses a shared Axios instance with `withCredentials: true` so cookies are included automatically.

### Access control flow

The backend uses middleware in sequence:

- `protect` verifies JWT
- `roleGuard(...)` checks allowed roles
- `facilityScope()` restricts access to assigned facility scope for facility-bound roles

Examples:

- admin has global access
- program manager has cross-facility view
- frontline worker and medical officer are facility scoped

---

## 6. Main user flows

### A. User registration and login

Entry points:

- `client/src/pages/LoginPage.jsx`
- `client/src/pages/RegisterPage.jsx`
- backend routes in `server/src/routes/authRoutes.js`

Operations:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

The auth controller returns the user profile and also sets the token cookie.

### B. Facility management (admin)

Admin users can create and manage the health hierarchy.

Routes:

- `GET /api/facilities`
- `GET /api/facilities/tree`
- `POST /api/facilities`
- `PATCH /api/facilities/:id`
- `DELETE /api/facilities/:id`
- `POST /api/facilities/seed`

Behavior:

- validates facility tier and required parent tier
- auto-seeds a default Maharashtra hierarchy if no facilities exist
- builds a nested facility tree for visualization

### C. Patient registration

This is a core clinical workflow.

Flow:

1. Current clinician opens the register patient page.
2. System validates required fields and guardian requirement for minors.
3. Backend determines facility assignment from user/facility context.
4. PHID is generated uniquely and safely.
5. Patient record is saved.
6. QR code is generated from the PHID.
7. Patient card is returned to the frontend for printing or display.

Relevant modules:

- `server/src/controllers/patientController.js`
- `server/src/utils/phidGenerator.js`
- `server/src/utils/qrGenerator.js`
- `client/src/pages/PatientRegisterPage.jsx`

### D. Duplicate check before registration

Before creating a new patient record, the app checks for potential duplicates using:

- phone number match
- matching name + dob

This helps reduce duplicate medical records and supports safer patient onboarding.

### E. QR scanning and lookup

The lookup process is designed for continuity across facilities.

Flow:

1. User scans a QR code or enters a PHID manually.
2. Frontend calls `GET /api/patients/lookup/:phid`.
3. Backend resolves the patient by exact PHID match.
4. Related encounter history is loaded.
5. QR code is generated again if needed for display.
6. UI shows patient demographics, facility source, and visit history.

This is the “continuity spine” of the app: a patient can be found by PHID regardless of where they present.

### F. Clinical encounter capture

Once a patient is found, workers can record a new encounter.

The flow:

1. UI opens encounter modal
2. User enters vitals, symptoms, notes, and encounter type
3. Backend stamps the facility and worker identity
4. encounter is stored with patient reference
5. patient lookup is refreshed to reflect new history

Relevant route:

- `POST /api/encounters`

### G. Patient directory and card management

The app also includes patient browsing and printable card presentation, which is useful for local workflow support and offline card-based continuity.

---

## 7. API overview

### Auth API

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/test-role-guard
GET  /api/auth/test-admin-only
GET  /api/auth/test-frontline-only
GET  /api/auth/test-facility-scope
```

### Facility API

```text
GET    /api/facilities
GET    /api/facilities/tree
GET    /api/facilities/:id
POST   /api/facilities
PATCH  /api/facilities/:id
DELETE /api/facilities/:id
POST   /api/facilities/seed
```

### Patient API

```text
GET    /api/patients/check-duplicate
GET    /api/patients/lookup/:phid
GET    /api/patients/:phid/encounters
POST   /api/patients/lookup/:phid/scan-log
GET    /api/patients/:id/card
POST   /api/patients
GET    /api/patients
GET    /api/patients/:id
PATCH  /api/patients/:id
```

### Encounter API

```text
POST /api/encounters
GET  /api/encounters/:id
GET  /api/encounters/patient/:phid
```

### Healthcheck

```text
GET /api/health
```

---

## 8. Frontend module map

### Main app entry

- `client/src/App.jsx`

This is the top-level app shell. It:

- loads the logged-in user via `fetchMe()`
- decides which view to render based on auth status
- manages navigation between dashboard, scan, register, patient list, and admin facility screens

### Store

- `client/src/stores/authStore.js`

This Zustand store handles:

- `fetchMe`
- `login`
- `register`
- `logout`
- loading and error state

### Pages

- `DashboardPage.jsx`: home dashboard with quick actions
- `ScanLookupPage.jsx`: QR lookup and patient continuity workflow
- `PatientRegisterPage.jsx`: patient onboarding form
- `PatientsListPage.jsx`: directory view
- `AdminFacilitiesPage.jsx`: facility admin screen
- `LoginPage.jsx` and `RegisterPage.jsx`: auth screens

### Shared components

- `Navbar.jsx`: navigation and role-aware layout
- `QRScanner.jsx`: camera or image-based PHID scanning
- `PatientCardModal.jsx`: display patient card/QR data
- `EncounterCreateModal.jsx`: record visit details
- `SchemaViewer.jsx`: data schema visual display
- `AccessTester.jsx`: tests access control setup and role validation

---

## 9. Backend module map

### Server entry

- `server/src/index.js`

This file:

- initializes express
- connects MongoDB
- configures CORS and cookies
- mounts API routes
- adds healthcheck and error-handling middleware
- starts the Node server on port 5000

### Middleware

- `auth.js`: verifies JWT
- `roleGuard.js`: checks role permissions
- `facilityScope.js`: enforces facility restrictions for facility-scoped roles

### Controllers

- `authController.js`: registration, login, logout, user lookup
- `patientController.js`: registration, duplicate detection, lookup, patient card, scan logging
- `facilityController.js`: facility CRUD, validation, tree generation, seed logic
- `encounterController.js`: encounter creation and retrieval

### Models

Each model is defined under `server/src/models` and centrally exported via `models/index.js`.

### Utilities

- `phidGenerator.js`: generates unique patient IDs
- `qrGenerator.js`: generates QR image data for patient cards
- `seed/facilities.js`: populates a default district and facility hierarchy

---

## 10. PHID and QR design

The project uses a custom patient identity model based on a unique PHID string rather than a generic numeric ID.

Key ideas:

- each patient gets a unique PHID
- PHID is generated from facility context and uniqueness logic
- QR payload is tied to the PHID
- QR can be used for quick patient lookup and continuity between facilities

This design supports practical field usage, especially for frontline health workers using a mobile or tablet workflow.

---

## 11. Facility hierarchy and stepped-care logic

The app assumes a government/public-health stepped-care structure:

```text
District Hospital
   └── Rural Hospital
         └── PHC
               └── Sub-Centre
```

This is represented in the database through `parentFacility` relationships and validated on creation.

The `facility tree` endpoint builds a nested representation for visualizing referral pathways and care escalation routes.

---

## 12. Setup and running the project

### Prerequisites

- Node.js 18+
- npm
- MongoDB running locally on default port 27017

### 1. Install dependencies

From the repository root:

```bash
npm install
npm run install:all
```

This installs:

- root dev dependencies
- server deps
- client deps

### 2. Start MongoDB

Make sure MongoDB is running locally.

Default connection string:

```bash
mongodb://127.0.0.1:27017/setucare
```

### 3. Run the app

From the repo root:

```bash
npm run dev
```

This starts:

- backend: http://localhost:5000
- frontend: http://localhost:5173

### 4. Optional: seed facilities

If the facility collection is empty, the server can auto-seed available hierarchy data. You can also run:

```bash
npm run seed:facilities
```

---

## 13. Environment variables

The backend expects a `.env` file in `server/` or similar environment configuration. The app currently falls back to safe development defaults if not set.

Typical values:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/setucare
JWT_SECRET=setucare_jwt_secret_dev_2026_phase1_secure_key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

---

## 14. Typical end-to-end workflow

A common journey in the app looks like this:

1. Admin creates or seeds facility hierarchy
2. Admin creates a user and assigns them a facility role
3. Frontline worker logs in
4. Worker registers a patient and gets a PHID + QR card
5. Patient is scanned later at another facility or clinic
6. Worker locates the patient using PHID
7. Encounter is recorded with vitals and symptoms
8. Case follows stepped-care referral flow through the facility network

This creates a longitudinal continuity layer for patient care across different facilities and clinician roles.

---

## 15. Current status and scope

This project is in a strong foundation phase for healthcare continuity workflows. It already includes:

- auth + role-based access
- facility hierarchy management
- patient registration and PHID generation
- QR lookup and continuity
- encounter capture
- facility awareness and cross-facility identification

The app is built with a modular pattern and is ready for the next phase of expansion, such as:

- referral workflows
- follow-up scheduling
- triage logic and decision support
- stronger admin analytics
- more detailed patient journey tracking

---

## 16. Summary

SetuCare is a practical healthcare coordination system for rural and district clinical networks. It models a real field workflow where patient identity, facility hierarchy, and clinician access all matter.

The most important architectural idea is this:

- patient identity is portable via PHID/QR
- facility hierarchy provides referral and escalation context
- auth and middleware enforce the right permissions and boundaries
- the frontend gives field workers a single clinical dashboard for continuity work

If you are onboarding to the project, start with:

1. `server/src/index.js`
2. `server/src/routes/*`
3. `server/src/controllers/*`
4. `client/src/App.jsx`
5. `client/src/stores/authStore.js`

That gives you the fastest understanding of how the project is structured and how data flows through the system.
