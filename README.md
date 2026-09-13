# UNIT-READY

**Subtitle:** *Offline Unit Administration, Duty Roster, Vehicle and Medical Store Management System*

**Unit Deployment:** Headquarters, 55 Field Ambulance

---

## 1. Mandatory Administrative Governance Notice

> “This application is an administrative and decision-support system. It does not replace official registers, authorised accounting procedures, clinical decisions, technical inspections or command policies unless formally approved by the competent authority.”

*Strict Operational Note: No weapon-related modules or data exist anywhere within this system.*

---

## 2. System Architecture & Features

1. **Part-I Daily Duty Roster**
   - Metadata validation (Reference number, duty date, shift period, distribution level).
   - In-app preview with dynamic `DRAFT — NOT YET APPROVED` banner and watermark.
   - Section OIC verification & Commanding Officer (CO) final approval.
   - Air-gapped publication to Unit Digital Notice Board.
   - Versioning (v1.0 → v1.1) and superseded history archive.

2. **Secure Digital Notice Board**
   - Air-gapped read-only view displaying ONLY CO-approved active documents.
   - Zero unapproved or returned draft leaks.
   - Secure in-app viewer with dynamic viewer, device, and Asia/Dhaka timestamp watermark overlay.
   - One-click verified acknowledgement logging (*"I HAVE READ AND ACKNOWLEDGED"*).

3. **Daily Manpower State**
   - Establishment metrics: Authorized, Held, Present, Effective, Leave, Course, Temporary Duty, Hospital Admitted.
   - Auto-calculated Deficiency ($Deficiency = Authorized - Held$).
   - Full nominal roll with qualification, appointment, status from date, and expected return tracking.

4. **Vehicle Fleet State**
   - Fleet metrics: Authorized, Held, Serviceable, Unserviceable, Under Repair, Inspection Due, Available for Task.
   - Defect classification, EME workshop job references, and 7-day/30-day inspection alerts.

5. **Medical Store (3 Subsections with Multi-Verification Gate)**
   - **Medicine Store**:
     - Generic name search without internal IDs.
     - Batch tracking with Rack/Shelf/Bin locations.
     - **FEFO Engine (First-Expire, First-Out)**: Automatically suggests nearest expiry batch and rejects expired stock with *"ISSUE BLOCKED — MOVE TO QUARANTINE"*.
     - High-Risk / Look-Alike Sound-Alike (LASA) safety warnings.
     - Shortage prediction ($DaysOfStock = UsableQuantity \div DailyConsumption$).
     - Monthly physical stock-taking variance detection ($Variance = Physical - ExpectedClosing$).
     - Append-only transaction logging with reversal entries.
   - **Medical Instruments**:
     - Strict Holding Balance validation: $Held = Serviceable + Unserviceable + UnderRepair$. Blocks submission on inequality.
     - Inspection and sterilization tracking.
   - **Medical Equipment**:
     - Electro-medical, life support, and sterilization equipment registry.
     - Key metrics: Serviceability Rate % ($Serviceable \div Held \times 100$) and Holding % ($Held \div Authorized \times 100$).
     - Next maintenance and calibration due alerts.

6. **Controlled 7-Stage Correction and Amendment Protocol**
   - Step 1: Correction Request Submission (12 error classifications, old value, proposed value, justification, proof voucher).
   - Step 2: Section OIC Recommendation.
   - Step 3: CO Limited Reopening Authorization (Sets 24-hour window, unlocks only specified fields).
   - Step 4: Limited Field Side-by-Side Correction.
   - Step 5: OIC Re-Verification.
   - Step 6: CO Final Re-Approval Change Summary.
   - Step 7: Automatic Version Bump (Locks Version 1.1; marks Version 1.0 `SUPERSEDED`).

7. **Cryptographically Sealed Audit Log**
   - Append-only immutable register logging logins, submissions, approvals, returns, holds, correction stages, and PDF exports.
   - Tamper-evident HMAC integrity hashes.

8. **Encrypted Local Backup & Restore**
   - Web Crypto AES-GCM-256 encrypted local `.bak` payload archive.
   - SHA-256 cryptographic verification before atomic restore.

9. **Bilingual User Interface**
   - Switchable English and Noto Sans Bengali (বাংলা).
   - English preserved for generic chemical names, dosages, and technical terms.
   - Asia/Dhaka 24-hour time notation and prominent Last Updated indicators.

---

## 3. Local Installation & Deployment Guide

### Prerequisites
- Node.js v18+ or local intranet Web Server (Nginx / Apache / Docker)

### Running Locally (Intranet Development Mode)
```bash
# Navigate to project directory
cd unit-ready-360

# Install dependencies (if not already installed)
npm install

# Start local server accessible over local network / intranet
npm run dev -- --host
```

Access the application in any browser on the intranet at `http://<local-server-ip>:5173`.

### Production Intranet Build
```bash
npm run build
```
The optimized offline bundle will be in `dist/` ready to serve statically from any intranet file server or container.

---

## 4. Android & Desktop PWA Installation

1. Open `http://<local-server-ip>:5173` on Chrome / Edge on Android Tablet, Phone, or Workstation.
2. Click the browser menu → **"Install App"** or **"Add to Home screen"**.
3. UNIT-READY will install as a standalone offline desktop/mobile application with Service Worker caching.

---

## 5. Demonstration Accounts

Use the one-click **"Switch Role"** selector in the top navigation bar to test all 12 roles:

| Role | Name | Service No | Primary Authority |
| :--- | :--- | :--- | :--- |
| **System Administrator** | Capt Tanvir Ahmed | `BA-10821` | Users, Hardware Whitelisting, OTPs, Backups |
| **Duty Roster Operator** | Sgt Mahbubur Rahman | `7104231` | Upload Duty PDFs, Drafts, Submit |
| **Manpower Operator** | Cpl Jahid Hasan | `7129840` | Nominal roll, Strength state, Submit |
| **Vehicle Operator** | Hav Anisur Rahman | `7098124` | Fleet readiness, EME job cards, Submit |
| **Medicine Operator** | Cpl Shafiul Alam | `7145612` | Batch entry, FEFO issue, Stocktaking |
| **Inst/Equip Operator** | Sgt Tariqul Islam | `7112903` | Instruments & Electro-med maintenance |
| **Section OIC** | Maj Asaduzzaman | `BA-9412` | Admin, Manpower & Vehicle verification |
| **Medical Store OIC** | Maj Dr. Farhana Yesmin | `BA-8954` | 3-Subsection Medical gate verification |
| **Consolidating Officer** | Maj Masud Parvez | `BA-8421` | State consolidation & forwarding |
| **Commanding Officer (CO)** | Lt Col Tariqul Anam | `BA-6540` | Command Final Approval, Lock, Publish |
| **Authorised Personnel** | L/Cpl Rashedul Islam | `7162981` | Read notice board & Acknowledge |
| **Auditor / Inspector** | Col Dr. M. A. Wadud | `BA-5120` | Read-only audit inspection & review |
