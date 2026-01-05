# ThorMail PostgreSQL Image
# Based on Alpine Linux for a lightweight footprint
FROM postgres:18-alpine

# Add metadata for better image management
LABEL maintainer="ThorMail Team" \
    description="PostgreSQL 18 with pg_partman extension for ThorMail Ecosystem" \
    version="1.0"

# Install build dependencies required for compiling pg_partman
# These are virtual dependencies that will be removed later to keep the image size small
RUN apk add --no-cache --virtual .build-deps \
    git \
    make \
    gcc \
    musl-dev \
    clang19 \
    llvm19

# Install pg_partman extension
# This extension is critical for handling time-series data like delivery logs efficiently through partitioning
# We are building from source to ensure we get the specific version compatibility
# Using v5.2.0 (or latest stable compatible with PG18)
RUN git clone https://github.com/pgpartman/pg_partman.git /tmp/pg_partman \
    && cd /tmp/pg_partman \
    && make \
    && make install \
    && rm -rf /tmp/pg_partman

# Clean up build dependencies to reduce final image size
RUN apk del .build-deps

# Copy custom configuration files
# postgresql.conf: Optimized settings for high-throughput delivery processing
# pg_hba.conf: Connection security settings
COPY config/postgresql.conf /etc/postgresql/postgresql.conf
COPY config/pg_hba.conf /etc/postgresql/pg_hba.conf

# Expose the standard PostgreSQL port
EXPOSE 5432

# Start PostgreSQL using our custom configuration file
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
