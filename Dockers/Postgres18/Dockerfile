# ThorMail PostgreSQL Image
# Docker Hub: thormail/postgres-thormail
# Based on Alpine Linux for a lightweight footprint
FROM postgres:18-alpine

# Add metadata for better image management
LABEL maintainer="ThorMail Team" \
    org.opencontainers.image.title="postgres-thormail" \
    org.opencontainers.image.description="PostgreSQL 18 with pg_partman extension for ThorMail Ecosystem" \
    org.opencontainers.image.version="1.0.3" \
    org.opencontainers.image.source="https://github.com/thormail/thormail-ecosystem" \
    org.opencontainers.image.licenses="PostgreSQL"

# Install build dependencies, compile pg_partman, and clean up in a single layer
# This reduces the final image size significantly
# Using pg_partman v5.2.0 for reproducible builds
RUN apk add --no-cache --virtual .build-deps \
    git \
    make \
    gcc \
    musl-dev \
    clang19 \
    llvm19 \
    && git clone --branch v5.2.0 --depth 1 https://github.com/pgpartman/pg_partman.git /tmp/pg_partman \
    && cd /tmp/pg_partman \
    && make \
    && make install \
    && rm -rf /tmp/pg_partman \
    && apk del .build-deps

# Copy custom configuration files
# postgresql.conf: Optimized settings for high-throughput delivery processing
# pg_hba.conf: Connection security settings
COPY config/postgresql.conf /etc/postgresql/postgresql.conf
COPY config/pg_hba.conf /etc/postgresql/pg_hba.conf

# Expose the standard PostgreSQL port
EXPOSE 5432

# Health check to monitor database availability
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD pg_isready -U ${POSTGRES_USER:-postgres} || exit 1

# Start PostgreSQL using our custom configuration file
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
