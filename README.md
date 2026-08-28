# SetuCare (सेतुकेअर)

> Stepped-Care Clinical Navigation & Referral Management System

SetuCare connects frontline healthcare workers (ASHAs / ANMs), Primary Health Centres (PHCs), Rural Hospitals, and District Hospitals into a coordinated, stepped-care clinical network.

## Phase 1 Foundation: Repo Scaffold, Data Schema, Auth

### Architecture
- **Client**: React + Vite, Zustand (`authStore`), Axios with `withCredentials: true`, Vanilla CSS design system.
- **Server**: Node.js + Express, Mongoose schemas, JWT stored in `httpOnly` secure cookies.
- **Access Control**: Role-based access (`roleGuard`) and facility-level data isolation (`facilityScope`).

### 6 Core Mongoose Data Models
1. **User**: Frontline workers, Medical Officers, Specialists, Program Managers, Admins.
2. **Facility**: Sub-Centres, PHCs, Rural Hospitals, District Hospitals with geospatial coordinates.
3. **Patient**: Unique PHID identifier (indexed for QR lookup), demographic & language preferences.
4. **Encounter**: Clinical records with typed vitals, symptoms, triage risk classification, and routing.
5. **Referral**: Inter-facility patient referrals with lifecycle status history tracking.
6. **FollowUp**: Cohort-based care tracking (maternal, child, chronic) with due date schedules.

### Getting Started

```bash
# 1. Install all dependencies
npm run install:all

# 2. Start both client and server concurrently
npm run dev
```

- Client runs on: `http://localhost:5173`
- Server runs on: `http://localhost:5000`
- API Healthcheck: `http://localhost:5000/api/health`
