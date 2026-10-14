# Transport Mobile App

An enterprise React Native / Expo mobile application and Node.js backend suite designed to assist transport drivers with real-time job synchronization, automated Waste Transfer Note (WTN) PDF generation, and bin asset tracking.

## 📖 Complete Documentation
For full developer documentation, architecture overview, database schema, REST API specifications, and detailed screen-by-screen guides, please refer to:
👉 **[DOCUMENTATION.md](./DOCUMENTATION.md)**

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v18+)
* [MySQL Server](https://dev.mysql.com/downloads/mysql/) (v8.0+)
* [Expo Go](https://expo.dev/client) app installed on your iOS/Android device for physical testing.

### 2. Database Configuration
1. Create a MySQL database named `transport_app`.
2. Seed the configurations and tables by running the following commands:
   ```bash
   cd backend
   node seed_email_config.js
   node migrate_waste_types.js
   node migrate_signature.js
   node migrate_vehicle_reg.js
   ```

### 3. Backend Setup
1. Move to the `backend/` directory and install libraries:
   ```bash
   cd backend
   npm install
   ```
2. Verify database connection credentials in `backend/server.js` matching your local MySQL installation.
3. Start the Express development server:
   ```bash
   npm start
   ```

### 4. Mobile Client Setup
1. Install client package dependencies at the root directory:
   ```bash
   npm install
   ```
2. Open `lib/config.ts` and set `Base_URL` to your local machine's IP address (e.g. `http://192.168.1.50:3003`). *Do not use `localhost` if testing on a physical phone.*
3. Boot the Expo development server:
   ```bash
   npx expo start
   ```
4. Scan the QR code using your phone's camera (iOS) or the Expo Go app (Android) to load the application.

---

## 🛠️ Key Technical Stack
* **Frontend**: React Native, Expo SDK 54, TypeScript, Bottom Tabs & Stack Navigation, Expo Camera, HTML5 Signature Canvas.
* **Backend**: Node.js, Express, MySQL 2 Pool, JWT Session Authentication, Bcrypt, PDF-Lib Template Filler, Nodemailer SMTP.
