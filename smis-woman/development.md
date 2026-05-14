# WOMAN System Development Configurations

This document outlines the environment configuration and Docker deployment strategy for the **Work Order Management Access Network (WOMAN)**.

---

## Architecture Overview

The application is fully dockerized and orchestrated using **Docker Compose**. It is split into three main services:

* **Frontend (`frontend`)**
  Served via Nginx on port `3000`.

* **Backend (`backend`)**
  A Node.js API running on port `5000`, containing a dedicated storage volume.

* **Database (`db`)**
  A MySQL 8.0 instance running on port `3307` (host mapped).

---

## Environment Variables (`.env`)

Environment variables are decoupled from the `docker-compose.yml` file to ensure security and flexibility.

### Backend (`backend/.env`)

This file is shared between the backend and database services to keep database credentials synchronized.

* **Node.js Variables:**
  `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`

* **MySQL Container Variables:**
  `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`

* **Storage:**
  `STORAGE_PATH` defines where the backend will save static assets, file uploads, or session data.

---

### Frontend (`frontend/.env`)

Contains variables such as:

* `API_BASE_URL` – points to the backend API.

> **Note:**
> Since the frontend is currently pure HTML/JS, environment variables passed to the Nginx container are not automatically injected into the browser runtime.
> This `.env` file serves as a reference for `js/config.js` or future bundlers like Vite or Webpack.

---

## Data Storage & Persistence

The system uses Docker volumes to prevent data loss when containers restart or are rebuilt:

* **`db_data`**
  Preserves MySQL tables and records.

* **`backend_storage`**
  Preserves files managed by the backend (located at `/app/storage` inside the container).

---

## Quick Start Guide

1. Ensure Docker and Docker Compose are installed on your machine.

2. Verify that the `.env` files exist in their respective directories:

   * `./backend`
   * `./frontend`

3. Run the following command in the root directory:

```bash
docker-compose up --build
```

4. Access the services:

   * Frontend: http://localhost:3000
   * Backend API: http://localhost:5000

---
