# ThorMail PostgreSQL 18 with pg_partman

[![Docker Hub](https://img.shields.io/docker/v/thormail/postgres-thormail?label=Docker%20Hub&logo=docker)](https://hub.docker.com/r/thormail/postgres-thormail)
[![Image Size](https://img.shields.io/docker/image-size/thormail/postgres-thormail/latest?label=Size)](https://hub.docker.com/r/thormail/postgres-thormail)

This image is based on the official `postgres:18-alpine` and pre-configured with the `pg_partman` extension and optimized settings for high-throughput delivery processing.

## Why PostgreSQL 18?

We have chosen PostgreSQL 18 for this project to leverage its advanced high-performance features, which are critical for a high-volume delivery system like ThorMail:

* **Asynchronous I/O (AIO)**: A game-changer for I/O-heavy workloads. It allows the database to handle multiple read/write operations concurrently, drastically reducing latency during high-volume delivery bursts.
* **Parallel `COPY FROM`**: Significantly speeds up bulk data ingestion, which represents a massive performance boost when importing large contact lists or logs.
* **Optimized `VACUUM`**: Crucial for our queue system. The new lazy pruning and internal improvements reduce the overhead of cleaning up dead tuples in our highly transactional tables.
* **Native UUIDv7 Support**: Provides timestamp-ordered UUIDs natively, improving B-tree index locality and insertion performance compared to random UUIDs.

## Quick Start

Pull the image from Docker Hub and run:

```bash
docker pull thormail/postgres-thormail:latest

docker run -d \
  --name thormail-postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=thormail_db \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  thormail/postgres-thormail:latest
```

## Docker Compose

```yaml
version: '3.8'
services:
  db:
    image: thormail/postgres-thormail:latest
    environment:
      - POSTGRES_USER=thormail
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=thormail_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  postgres_data:
```

## Features

| Feature | Description |
|---------|-------------|
| **pg_partman 5.2.0** | Automatic table partitioning for time-series data |
| **Health Check** | Built-in container health monitoring |
| **Optimized Config** | Tuned for high-throughput delivery workloads |
| **Alpine-based** | Minimal image size (~108MB) |

## Data Persistence

To persist your database data (delivery logs, users, etc.) across container restarts, mount a volume to `/var/lib/postgresql/data`.

**Example:**

```bash
-v /my/local/data:/var/lib/postgresql/data
```

## Environment Variables

This image inherits all functionality from the official Postgres Docker image. You can use standard environment variables for initialization:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | ✅ Yes | Sets the superuser password |
| `POSTGRES_USER` | No | Superuser name (default: `postgres`) |
| `POSTGRES_DB` | No | Default database (recommended: `thormail_db`) |
| `PGDATA` | No | Data directory (default: `/var/lib/postgresql/data`) |

## Configuration

The image comes with a custom `postgresql.conf` located at `/etc/postgresql/postgresql.conf` which is optimized for:

* High connection usage (Workers + API)
* SSD storage
* Aggressive Autovacuum settings for heavy write workloads (delivery queues)

To override settings, you can mount your own config or pass arguments via command line, but it is recommended to use the provided configuration as a baseline.

## More Information

For documentation, support, and more details about the ThorMail ecosystem, visit **[thormail.io](https://thormail.io)**.

## License

This image is based on the official PostgreSQL Docker image and pg_partman, both licensed under the PostgreSQL License.
