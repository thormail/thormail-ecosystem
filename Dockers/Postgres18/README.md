# ThorMail PostgreSQL 18 with pg_partman

This image is based on the official `postgres:18-alpine` and pre-configured with the `pg_partman` extension and optimized settings for high-throughput delivery processing.

## Quick Start (Automated Setup)

The easiest way to get started without cloning the repository or manually configuring Docker. This script works on Linux/macOS and requires only `docker` and `curl` (or `wget`).

Run this command in your terminal:

```bash
curl -sL https://raw.githubusercontent.com/ThorMail/thormail-ecosystem/main/Dockers/Postgres18/setup.sh | bash
```

**Or using wget:**

```bash
wget -qO- https://raw.githubusercontent.com/ThorMail/thormail-ecosystem/main/Dockers/Postgres18/setup.sh | bash
```

This script will:

1. Download necessary configuration files (lightweight).
2. Build the Docker image locally.
3. Prompt you for a secure password.
4. Launch the container with persistent storage enabled.

## Deployment (Manual)

### Docker CLI

To run the container with a custom password and default settings:

```bash
docker run -d \
  --name thormail-postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -p 5432:5432 \
  thormail/postgres:18
```

### Docker Compose

```yaml
version: '3.8'
services:
  db:
    build: .
    environment:
      - POSTGRES_USER=thormail
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=thormail_ecosystem
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Data Persistence

To persist your database data (delivery logs, users, etc.) across container restarts, you must mount a volume to `/var/lib/postgresql/data`.

The official PostgreSQL image uses this directory by default. Our configuration preserves this behavior.

**Example:**
`-v /my/local/data:/var/lib/postgresql/data`

## Environment Variables

This image inherits all functionality from the official Postgres Docker image. You can use standard environment variables for initialization:

- **`POSTGRES_PASSWORD`**: (Required) Sets the superuser password.
- **`POSTGRES_USER`**: (Optional) Sets the superuser name. Defaults to `postgres`.
- **`POSTGRES_DB`**: (Optional) Creates a default database on startup. It is recommended to use `thormail_db` for this project.
- **`PGDATA`**: (Optional) data directory location (default: `/var/lib/postgresql/data`).

## Connection Examples

Depending on where your application is running, use the appropriate connection string:

- **Local Machine (Host):**
  `postgres://postgres:password@localhost:5432/thormail_db`
- **Remote Server:**
  `postgres://postgres:password@<SERVER_IP>:5432/thormail_db`
- **Other Docker Containers:**
  `postgres://postgres:password@thormail-postgres:5432/thormail_db`

## Configuration

The image comes with a custom `postgresql.conf` located at `/etc/postgresql/postgresql.conf` which is optimized for:

- High connection usage (Workers + API)
- SSD storage
- Aggressive Autovacuum settings for heavy write workloads (delivery queues)

To override settings, you can mount your own config setup or pass arguments via command line, but it is recommended to use the provided configuration as a baseline.
