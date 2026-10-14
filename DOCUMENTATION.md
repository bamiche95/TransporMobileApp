# Transport Mobile App - System Documentation

Welcome to the comprehensive system documentation for the **Transport Mobile App**. This document provides an in-depth reference manual covering system architecture, database design, API specification, frontend application screens, automated PDF generation, background email services, and deployment instructions.

---

## 1. Executive Summary & Overview

The **Transport Mobile App** is an enterprise-grade mobile application and backend service suite built for logistics, transportation, and waste management operations. It is designed to assist drivers and dispatchers in managing transport tasks in real-time. 

### Core Capabilities
* **Job Management & Dispatching**: Drivers receive real-time job assignments on their mobile devices. Jobs are ordered by casting priority values (`Priority 1` to `Priority 10`).
* **Active Poll Updates**: The app polls the backend server every 30 seconds to fetch up-to-date assignments, ensuring high synchronization between dispatch and drivers.
* **Complex Bin Operations**: Supports multiple transport action modes including **Collect Only**, **Deliver Only**, **Exchange** (collecting one bin and delivering another), **Tip and Return**, **Relocate**, **Wait and Load**, and **Inspection/Repair**.
* **Lug Lock Management**: Enforces specialized fitting and assignment of security lug locks to RORO (Roll-On Roll-Off) and Skip bins.
* **Waste Transfer Note (WTN) Generation**: Automates filling of standard legal PDF templates, dynamically ticking matching waste checkboxes, injecting driver and customer signatures, and flattening form fields to prevent alterations.
* **Asset Tracking & History**: Monitors physical location shifts of bin containers through QR/barcode scanning (or manual input) and logs historical transfer chains in a database.
* **Email Dispatch**: Emails the completed WTN PDF to customers and internal audit mailboxes immediately upon job completion.

---

## 2. System Architecture

The application is structured into three primary tiers:

```
┌────────────────────────────────────────────────────────┐
│                    Mobile Frontend                     │
│               React Native + Expo App                  │
│       (Screens, AuthContext, Camera Scanner, Canvas)   │
└───────────────────────────┬────────────────────────────┘
                            │  HTTPS (JSON & JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│                     Node.js API                        │
│                Express Web Server                      │
│     (JWT Auth, PDF Document Filler, Emailer Module)    │
└───────────────────────────┬────────────────────────────┘
                            │  MySQL Protocol
                            ▼
┌────────────────────────────────────────────────────────┐
│                    MySQL Database                      │
│          Tables: Jobs, Bins, Users, History            │
└────────────────────────────────────────────────────────┘
```

### Technical Stack Summary
* **Frontend**: React Native (0.81.5), Expo SDK 54, TypeScript, React Navigation (Bottom Tabs + Native Stack), React Native Signature Canvas (HTML5 canvas inside WebView), Expo Camera (for barcode scanning).
* **Backend**: Node.js, Express, MySQL 2 (Connection Pooling), JWT (JSON Web Tokens), Bcrypt, PDF-Lib (for template form-field writing & signature embedding), Nodemailer.
* **Deployment System**: Windows Server 11 / IIS (running node inside `C:\inetpub\wwwroot\Transport-app\`), MySQL Server.

---

## 3. Database Reference Schema

The application relies on a MySQL relational database schema. The database name is configured as `transport_app`.

### Core Database Tables

#### 1. `users`
Represents drivers and system users.
* `user_id` (INT, PK, Auto-increment)
* `username` (VARCHAR)
* `password_hash` (VARCHAR, Bcrypt hash)
* `first_name` (VARCHAR)
* `last_name` (VARCHAR)
* `signature` (LONGTEXT, Base64 PNG signature of the driver)

#### 2. `jobs`
Maintains records of all transport requests.
* `job_id` (INT, PK, Auto-increment)
* `customer_id` (INT, FK)
* `company_id` (INT, FK)
* `job_status_id` (INT, FK)
* `bin_type_id` (INT, FK)
* `job_type_id` (INT, FK)
* `waste_type_id` (INT, FK)
* `assigned_to` (INT, FK to `users.user_id`)
* `job_date` (DATE)
* `priority` (VARCHAR)
* `jobs_notes` (TEXT)
* `address` (TEXT)
* `sic_code` (VARCHAR)
* `customer_name` (VARCHAR) - Signature signee name
* `customer_email` (VARCHAR) - Signature signee email
* `customer_signature` (LONGTEXT, Base64 PNG)
* `driver_comments` (TEXT)
* `vehicle_reg` (VARCHAR)
* `modified_by` (INT)
* `modified_at` (DATETIME)

#### 3. `job_status`
Enums for job states: `Open`, `In Progress`, `Completed`, `Cancelled`.
* `job_status_id` (INT, PK)
* `job_status_name` (VARCHAR)

#### 4. `jobtype`
Rules engine governing bin operations.
* `job_type_id` (INT, PK)
* `job_type_name` (VARCHAR) - e.g., `Exchange`, `Collect`, `Deliver`, `Tip And Return`
* `allows_collect` (TINYINT / Boolean) - Defines whether the driver collects a bin
* `allows_deliver` (TINYINT / Boolean) - Defines whether the driver delivers a bin

#### 5. `bins`
Tracks physical assets (containers) in circulation.
* `bin_id` (INT, PK, Auto-increment)
* `bin_number` (VARCHAR, Unique identifier, e.g., 6-digit code)
* `bin_description` (TEXT)
* `bin_type_id` (INT, FK to `bintype`)
* `customer_id` (INT, FK to `customer` - represents current physical location)
* `modified_by` (INT)
* `modified_at` (DATETIME)

#### 6. `bintype`
Classification of bins: RORO, Skip, Front End Loader (FEL), etc.
* `bin_type_id` (INT, PK)
* `bin_name` (VARCHAR)

#### 7. `binhistory`
Historical log of physical container movements.
* `history_id` (INT, PK, Auto-increment)
* `bin_id` (INT, FK)
* `job_id` (INT, FK, Nullable)
* `from_location` (VARCHAR) - Name of origin customer location
* `to_location` (VARCHAR) - Name of destination location
* `moved_by` (INT, FK to `users.user_id`)
* `moved_at` (DATETIME)

#### 8. `job_bins`
Records which bins were handled during a specific job transaction.
* `job_bin_id` (INT, PK, Auto-increment)
* `job_id` (INT, FK)
* `bin_id` (INT, FK)
* `action` (VARCHAR) - `COLLECT` or `DELIVER`
* `movement_type` (VARCHAR)

#### 9. `lug_locks`
Tracks security security-tags or lug locks used for holding chains.
* `lug_id` (INT, PK, Auto-increment)
* `lug_type_id` (INT, FK)
* `job_id` (INT, FK, Nullable)
* `location_id` (INT, FK, Nullable)
* `date_fitted` (DATETIME, Nullable)
* `issued_to` (INT, FK, Nullable)

#### 10. `waste_types`
Classes of legal waste types under European/UK waste regulations.
* `waste_type_id` (INT, PK)
* `waste_type_name` (VARCHAR)
* `pdf_field_name` (VARCHAR) - Exact form field name matching the checkbox in the WTN template PDF

---

## 4. Backend System (Node.js API)

The backend handles request routing, authorization middleware, database queries via pools, PDF rendering, and SMTP emailing. It runs on port `3003` by default.

### Middleware & Security
* **JWT Verification (`authenticateToken`)**: Restricts access to all routes except `/login`. It decodes the bearer token header (`Authorization: Bearer <TOKEN>`) and binds `req.user` to the session.
* **Bcrypt Hashing**: Secures user passwords before comparing them at database queries.
* **Payload Size Limits**: Standardized body-parser handles payloads up to `50MB` to safely transmit high-resolution Base64 signatures.

### API Endpoint Specifications

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/login` | Public | Validates credentials, returns signed JWT token (expires in 7 days) and user object. |
| `GET` | `/customers/search` | JWT | Performs regex search (`%query%`) on customer locations. Returns top 10 matches. |
| `GET` | `/jobs` | JWT | Fetches active jobs for the authenticated driver scheduled for **today** (`CURDATE()`) that are `Open` or `In Progress`. Sorted by priority. |
| `GET` | `/job/:job_id` | JWT | Retrieves extensive job info including customer/company details, job specifications, and a flag indicating if bins are already processed. |
| `PUT` | `/job/:job_id/status` | JWT | Updates the status of the job (e.g., changes status from 'Open' to 'In Progress' when started). |
| `GET` | `/lug-locks/:job_id` | JWT | Fetches available lug locks filtered by the matching bin type (e.g. `roro` or `skip`). |
| `GET` | `/bins/check` | JWT | Verifies whether a manually typed or scanned bin number exists in the database. |
| `GET` | `/bins/:customer_id` | JWT | Fetches all bins currently residing at the specified customer's location. |
| `PUT` | `/users/me/signature` | JWT | Updates the logged-in driver's permanent signature. |
| `POST` | `/bins/update-location` | JWT | Bulk relocates a collection of bins to a target customer location. Records transfer logs in `binhistory`. |
| `POST` | `/execute/:job_id` | JWT | Executes a transaction. For each bin collected/delivered, updates location, records `binhistory` entries, updates matching lug locks, and handles 'Inspection/Repair' cases. Enforces a duplicate-execution guard. |
| `POST` | `/job/:job_id/signature` | JWT | Submits final signatures, names, driver comments, vehicle registration, and updates status to `Completed`. |
| `POST` | `/job/:job_id/waste-transfer-note` | JWT | Generates the filled and signed WTN PDF template, flattens it, saves to disk, triggers email transmission, and returns file download URL. |

---

## 5. Waste Transfer Note (WTN) PDF Engine & Mailer

One of the most complex modules on the backend is the automated PDF compilation and dispatch pipeline triggered via `POST /job/:job_id/waste-transfer-note`.

```
                  ┌───────────────────────────────┐
                  │ 1. Load WTN_template.pdf      │
                  └───────────────┬───────────────┘
                                  ▼
                  ┌───────────────────────────────┐
                  │ 2. Query Job Details & Bins   │
                  └───────────────┬───────────────┘
                                  ▼
                  ┌───────────────────────────────┐
                  │ 3. Populate Interactive Forms │
                  │    - Set job details          │
                  │    - Write bin numbers        │
                  │    - Check waste type checkbox│
                  └───────────────┬───────────────┘
                                  ▼
                  ┌───────────────────────────────┐
                  │ 4. Inject Signatures (Base64) │
                  │    - Customer Signature       │
                  │    - Driver Signature         │
                  └───────────────┬───────────────┘
                                  ▼
                  ┌───────────────────────────────┐
                  │ 5. Flatten Form Fields        │
                  └───────────────┬───────────────┘
                                  ▼
                  ┌───────────────────────────────┐
                  │ 6. Write PDF & Trigger SMTP   │
                  └───────────────────────────────┘
```

### PDF Compilation Details
1. **Template Location**: Loads `WTN_template.pdf` from the Windows Server directory: `C:\inetpub\wwwroot\Transport-app\storage\pdfs\WTN_template.pdf`.
2. **Text Form Fields**: Interacts with form structures to write strings:
   * `job_id`, `job_date`, `company_name`, `vehicle_reg`, `site_name`, `address`, `sic_code`, `recieved_by`, `driver_name`, `driver_comment`, `bin_type`.
   * Formats bin descriptions relative to the type:
     * If **Exchange**: `collected_bins` gets collected string, `delivered_bins` gets delivered string.
     * If **Collect**: Only writes to `collected_bins`.
     * If **Deliver**: Only writes to `delivered_bins`.
     * If **Other**: Writes to `bin_numbers`.
3. **Waste Type Checkbox Ticking**: Ticks the check box associated with the dynamic `pdf_field_name` stored in the `waste_types` table matching this job.
4. **Signature Embedding**: Decodes Base64 data blocks (verifying JPEG or PNG prefixes). It embeds images into the page canvas at exact, predefined coordinate bounds using `pdfDoc.embedPng()` or `pdfDoc.embedJpg()`. Coordinates use point metrics ($1\text{ cm} \approx 28.35\text{ points}$).
5. **Flattening**: Calls `form.flatten()` which makes the text fields read-only and burns the content into the drawing canvas, rendering the document legally tamper-proof.
6. **File Storage**: Sanitizes the site name and saves the PDF using the pattern: `WTN_[SiteName]_[JobID]_[Date].pdf`.

### Email Notification Dispatch
Immediately following successful storage of the PDF, the server invokes `emailService.sendWTNEmail()`.
* **SMTP Config**: Nodemailer loads configuration details. In production, these are dynamically loaded from database parameters or process variables.
* **Recipients**: Sends a message to the customer's specified email, while attaching the fresh generated PDF. If the email transmission fails, the HTTP call still returns successfully since the physical PDF was successfully written.

---

## 6. Frontend Mobile Client (React Native / Expo)

The client is optimized for real-world field conditions, built with clear, high-contrast layouts.

### Screen-by-Screen Reference

#### 1. Login Screen (`screens/LoginScreen.tsx`)
Provides credentials forms. Upon authentication, stores the JWT token and serialized user object inside `AsyncStorage`. Decodes the JWT token payload's expiry timestamp (`exp`) on app cold start to prevent expired requests.

#### 2. Home Screen (`screens/HomeScreen.tsx`)
A list view displaying the driver's active jobs for today.
* **Auto-Polling**: Every 30 seconds, it silently triggers a background pull to refresh assignments.
* **Visual Helpers**: Badges represent priorities. `Priority >= 8` receives a red icon and red badge background; `Priority >= 5` receives orange; lower values receive green.

#### 3. Job Detail Screen (`screens/JobDetailScreen.tsx`)
Displays address coordinates, notes, bin configurations, and contact information. Provides a main action button:
* If the job status is `Open`, the button says **Start Task**, which updates the status to `In Progress` and opens the execution screen.
* If `In Progress`, allows jumping straight to execution.

#### 4. Start Task Screen (`screens/StartTaskScreen.tsx`)
The operational core.
* **Bin Inputting**: Drivers enter or edit bin numbers.
* **Scanning Module**: Built-in barcode/QR code reader via `expo-camera`. Triggers the scanner camera modal overlay, writes the string directly to the selected bin field, and queries the backend `/bins/check` API to verify the bin.
* **Type Constraints**: Skip/RORO validation is run instantly. If the job requires a "RORO" or "Skip" bin, the app matches the bin's database attributes to prevent errors.
* **Lug Locks Fitting**: Displays selectable lug locks matching the skip/RORO category, updating their assignment dynamically on execution.

#### 5. Signature Screen (`screens/SignatureScreen.tsx`)
The legal sign-off screen.
* **Form fields**: Input field for the contact's name, email, driver comments, and vehicle registration.
* **HTML5 Canvas Signature**: Integrates `react-native-signature-canvas` inside a WebView, permitting high-fidelity capture of hand signatures.
* **WTN Triggering**: On submit, updates job parameters, uploads the signature, then triggers the PDF rendering request.

#### 6. Bin Stock Screen (`screens/BinStockScreen.tsx`)
An asset management console for bulk operations outside of job flows.
* Drivers search for target customer sites.
* They scan or enter multiple container numbers simultaneously.
* Pressing **Update** relocates the containers' physical tags in the database, writing records to `binhistory` to maintain full chain of custody.

#### 7. Profile Screen (`screens/ProfileScreen.tsx`)
Driver settings page. Highlights logged-in metadata and allows the driver to register or update their permanent personal signature which gets automatically embedded into driver-signature slots on generated WTNs.

---

## 7. Setup & Installation Guide

Follow these steps to run the complete environment locally for development.

### Prerequisites
* **Node.js**: v18 or later
* **npm**: v9 or later
* **MySQL Server**: v8.0 or later
* **Expo Go**: Installed on iOS/Android device for testing

### 1. Database Setup
1. Log in to your MySQL terminal or administration tool.
2. Create the database:
   ```sql
   CREATE DATABASE transport_app;
   ```
3. Run the migration and seeding scripts found in the `backend/` folder:
   * Execute schema creation.
   * Populate initial tables using helper scripts:
     ```bash
     cd backend
     node seed_email_config.js
     node migrate_waste_types.js
     node migrate_signature.js
     node migrate_vehicle_reg.js
     ```

### 2. Backend Installation & Start
1. Move to backend folder and install libraries:
   ```bash
   cd backend
   npm install
   ```
2. Open `backend/server.js` and verify MySQL connection parameters:
   ```javascript
   const db = mysql.createPool({
     host: 'localhost',
     user: 'root',
     password: 'YOUR_DATABASE_PASSWORD',
     database: 'transport_app',
     port: 3306,
     connectionLimit: 10
   });
   ```
3. Run the development server:
   ```bash
   npm start
   ```
   The backend should print: `Connected to database` and `Server running on port 3003`.

### 3. Frontend Installation & Start
1. Return to the root folder and install mobile dependencies:
   ```bash
   npm install
   ```
2. Configure your local network server IP in `lib/config.ts`:
   ```typescript
   // Replace with your development machine's local IP address rather than localhost
   const Base_URL = 'http://192.168.1.XX:3003'; 
   export default Base_URL;
   ```
3. Boot the Expo bundler:
   ```bash
   npx expo start
   ```
4. Open **Expo Go** on your physical device and scan the displayed QR code to load the app.

---

## 8. Deployment and Windows Server Configuration

In production, the backend often runs as a service in **IIS** (Internet Information Services) on Windows Server.

### Directory Mapping
* **IIS Base Path**: `C:\inetpub\wwwroot\Transport-app\`
* **PDF Output Path**: `C:\inetpub\wwwroot\Transport-app\storage\pdfs\`
* **Template Path**: `C:\inetpub\wwwroot\Transport-app\storage\pdfs\WTN_template.pdf`

### Running Node behind IIS
1. Install **IIS Administration** and **URL Rewrite** module.
2. Install **iisnode** on the server machine.
3. Place a `web.config` file in the root backend folder to route all HTTP requests to `server.js`.
4. Ensure the system user running the IIS application pool (`DefaultAppPool` or `IIS_IUSRS`) has full **Write** permissions over the `storage/pdfs/` directory to prevent file creation access errors.
