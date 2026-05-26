# WOMAN for SMSi  
**Work Order Management Access Network**

## 1. Overview
The **Work Order Management Access Network (WOMAN)** is a web-based centralized ticketing system developed for **Solutions Management Systems Inc. (SMSi)**.

It is designed to manage, track, and monitor service requests from multiple client companies in a single platform. The system replaces informal request handling with a structured, organized, and trackable workflow to improve operational efficiency.

---

## 2. Core Features

### A. Ticketing / Work Order Module
The main component of the system.

- Generates a unique **Work Order ID**
- Stores:
  - Issue details
  - Priority level
  - Current status
- Tracks progress through statuses:
  - Submitted  
  - Assigned  
  - In Progress  
  - Resolved  
  - Closed  

✅ Ensures all requests are organized and traceable

---

### B. User and Role Management Module
Supports three main user roles:

**Administrator**
- Full system control  
- Assigns technicians  
- Manages users and clients  

**Technician**
- Handles assigned work orders  
- Updates status and logs activities  

**Client**
- Submits service requests  
- Tracks request status  

✅ Role-based access ensures security and proper task assignment

---

### C. Legacy Ticket Encoding (Key Feature)
Supports existing workflows by allowing:

- Administrators to create tickets on behalf of clients  
- Used for requests received via:
  - Email  
  - Chat  
  - Phone calls  

✅ Ensures:
- No request is lost  
- All data is centralized  
- Smooth transition from old system  

---

### D. Activity Logs and Communication Module
Tracks all system activities:

- Status updates  
- Technician actions  
- System changes  

Includes:
- Comments  
- File attachments  

✅ Improves transparency and accountability

---

### E. Monitoring and Reporting Module
Tracks system performance:

- Response time  
- Resolution time  

Allows administrators to evaluate technician performance.

✅ Helps improve service efficiency

---

## 3. System Architecture

The system follows a **multi-layer web architecture**:

- **Client Layer** – Web browser interface  
- **Application Layer** – Business logic and processing  
- **Data Layer** – Database storage  

**Flow:**
Client → HTTP Request → Backend Processing → Database → Response to UI

---

## 4. Technologies and Tools

### A. Frontend
- **HTML** – Structure  
- **CSS** – Design  
- **JavaScript** – Interactivity & API calls  

### B. Backend
- **Node.js** – Runtime environment  
- **Express.js** – API and routing framework  

Handles:
- Request processing  
- Business logic  
- API endpoints  

---

### C. Database
- **MySQL** (Relational Database)

Stores:
- Users  
- Clients  
- Work Orders  
- Logs and comments  

---

### D. Development Tools
- **Visual Studio Code** – Code editor  
- **Git** – Version control  
- **GitHub** – Repository & collaboration  

---

### E. Testing
- **Postman** – API testing  

---

### F. Deployment
- **Render** – Backend hosting  
- **Vercel** – Frontend hosting  

---

## 5. Summary
The WOMAN system provides a centralized and structured solution for managing service requests. By integrating ticketing, role-based access, activity tracking, and legacy request encoding, it enhances efficiency, transparency, and scalability for SMSi.

Modern web technologies and cloud deployment ensure the system is reliable, accessible, and ready for future expansion.

---

## 6. How To: Reset `woman_db` (Docker + VSCode PowerShell)

Use this when you want a clean database and need to reinitialize schema + seed data.

### A. Drop and recreate the database
```powershell
docker compose exec db mysql -u root -p -e "DROP DATABASE IF EXISTS woman_db; CREATE DATABASE woman_db;"
```

### B. Load base schema (`database.sql`) from PowerShell
PowerShell does not support `< file.sql` redirection like bash/cmd, so use piping:

```powershell
Get-Content .\backend\database.sql -Raw | docker exec -e MYSQL_PWD=YOUR_ROOT_PASSWORD -i smis-woman-db-1 mysql -u root woman_db
```

Replace `YOUR_ROOT_PASSWORD` with `MYSQL_ROOT_PASSWORD` from `backend/.env`.

### C. Run migrations and seed
```powershell
docker exec -it smis-woman-backend-1 node scripts/run_migrations.js
docker exec -it smis-woman-backend-1 node scripts/seed.js
```

### D. Common issue
If you see `Table 'woman_db.users' doesn't exist`, the base schema has not been imported yet. Run step **B** first, then **C**.
