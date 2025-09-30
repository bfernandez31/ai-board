# Database Setup Instructions

## Option 1: Docker Compose (Recommended)

### Prerequisites
- Docker Desktop installed and running

### Steps

1. Start PostgreSQL container:
```bash
docker compose up -d
```

2. Verify container is running:
```bash
docker compose ps
```

3. Run Prisma migration:
```bash
npx prisma migrate dev --name init-tickets
```

4. Generate Prisma client (if not already done):
```bash
npx prisma generate
```

### Database Access

- **Host**: localhost
- **Port**: 5432
- **Database**: ai_board
- **Username**: postgres
- **Password**: postgres

### Useful Commands

```bash
# View logs
docker compose logs postgres

# Stop database
docker compose down

# Stop and remove volumes (deletes all data)
docker compose down -v

# Access PostgreSQL shell
docker compose exec postgres psql -U postgres -d ai_board
```

## Option 2: Local PostgreSQL Installation

If you prefer to use a local PostgreSQL installation:

1. Install PostgreSQL 14+ (via Homebrew, official installer, etc.)

2. Start PostgreSQL service:
```bash
# macOS with Homebrew
brew services start postgresql@16

# Linux
sudo systemctl start postgresql
```

3. Create database:
```bash
createdb ai_board
```

4. Update `.env` with your local credentials:
```
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/ai_board?schema=public"
```

5. Run Prisma migration:
```bash
npx prisma migrate dev --name init-tickets
```

## Verification

After setup, verify the connection:

```bash
# Test Prisma connection
npx prisma db push

# View database schema
npx prisma studio
```

This will open Prisma Studio at http://localhost:5555 where you can view and manage your database data.

## Troubleshooting

### "Can't reach database server"
- Ensure Docker is running: `docker ps`
- Check container status: `docker compose ps`
- View container logs: `docker compose logs postgres`

### "Port 5432 already in use"
- Another PostgreSQL instance is running
- Stop local PostgreSQL: `brew services stop postgresql`
- Or change port in docker-compose.yml and .env

### Migration fails
- Ensure database exists: `docker compose exec postgres psql -U postgres -l`
- Reset migrations: `npx prisma migrate reset` (⚠️ deletes data)