# Docker Setup Guide

This guide explains how to run the Media Request application using Docker and Docker Compose.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start

1. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   - Set your `NEXTAUTH_SECRET` (generate a random string)
   - Add your `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`
   - Adjust database credentials if needed
   - Set `NEXTAUTH_URL` to your domain (e.g., `https://yourdomain.com`)

3. **Build and start services:**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations:**
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

   Or if migrations don't exist yet:
   ```bash
   docker-compose exec app npx prisma db push
   ```

5. **Access the application:**
   - Open `http://localhost:3000` in your browser

## Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### View logs
```bash
docker-compose logs -f app
```

### Rebuild after code changes
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Access database
```bash
docker-compose exec postgres psql -U postgres -d media_request
```

### Run Prisma commands
```bash
docker-compose exec app npx prisma studio
docker-compose exec app npx prisma migrate dev
```

## Environment Variables

Required environment variables (set in `.env` file):

- `DATABASE_URL` - Automatically set by docker-compose
- `NEXTAUTH_URL` - Your application URL
- `NEXTAUTH_SECRET` - Secret key for NextAuth (generate with `openssl rand -base64 32`)
- `TWITCH_CLIENT_ID` - Your Twitch OAuth Client ID
- `TWITCH_CLIENT_SECRET` - Your Twitch OAuth Client Secret

## Production Deployment

For production:

1. Use a reverse proxy (nginx, Traefik, etc.)
2. Set `NEXTAUTH_URL` to your production domain
3. Use strong passwords for PostgreSQL
4. Generate a secure `NEXTAUTH_SECRET`
5. Consider using Docker secrets for sensitive data
6. Set up SSL/TLS certificates

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL container is healthy: `docker-compose ps`
- Check database logs: `docker-compose logs postgres`

### Build failures
- Clear Docker cache: `docker-compose build --no-cache`
- Check Node.js version compatibility

### Volume issues
- Ensure Prisma schema is in the correct location
- Check file permissions

