# Docker and MySQL Command Reference

## 1. Docker Commands

### Start all services

```bash
docker compose up --build
```

### Start all services in detached mode

```bash
docker compose up -d
```

### Stop all services

```bash
docker compose down
```

### Stop all services and remove volumes (full database reset)

```bash
docker compose down -v
```

---

## 2. Restart Services

### Restart backend

```bash
docker compose restart backend
```

### Restart database

```bash
docker compose restart db
```

### Restart frontend

```bash
docker compose restart frontend
```

---

## 3. View Running Containers

```bash
docker ps
```

---

## 4. View Logs

### All services

```bash
docker compose logs -f
```

### Backend logs

```bash
docker compose logs -f backend
```

### Database logs

```bash
docker compose logs -f db
```

---

## 5. Access Containers

### Backend container shell

```bash
docker exec -it group-a-smsi-backend-1 sh
```

### MySQL container shell

```bash
docker exec -it group-a-smsi-db-1 mysql -u root -p
```

---

## 6. MySQL Commands (Inside Container)

### Select database

```sql
USE woman_db;
```

### Show all databases

```sql
SHOW DATABASES;
```

### Show all tables

```sql
SHOW TABLES;
```

### View all users

```sql
SELECT * FROM users;
```

### View companies

```sql
SELECT * FROM companies;
```

### View tickets

```sql
SELECT * FROM tickets;
```

---

## 7. Run Backend Scripts

### Run seed script

```bash
docker exec -it group-a-smsi-backend-1 node scripts/seed.js
```

### Run any script

```bash
docker exec -it group-a-smsi-backend-1 node <path-to-script>
```

---

## 8. Full System Reset 
> Use this when you make changes to schemas

```bash
docker compose down -v
docker compose up --build
```

---

## 10. Recommended Workflow

```bash
docker compose down -v
docker compose up --build
docker ps
docker exec -it group-a-smsi-db-1 mysql -u root -p
USE woman_db;
SHOW TABLES;
SELECT * FROM users;
```