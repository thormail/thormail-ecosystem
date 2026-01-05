#!/bin/bash

# ThorMail PostgreSQL Setup Script
# This script allows you to easily pull, build, and run the ThorMail PostgreSQL container
# without cloning the entire monorepo and without needing Git installed.

set -e

# Configuration
RAW_BASE_URL="https://raw.githubusercontent.com/ThorMail/thormail-ecosystem/main/Dockers/Postgres18"
IMAGE_NAME="thormail/postgres:18"
CONTAINER_NAME="thormail-postgres"
DEFAULT_PORT=5432

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ThorMail PostgreSQL Setup ===${NC}"

# Check dependencies
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed."
    exit 1
fi

# Define download function
download_file() {
    local url=$1
    local output=$2
    if command -v curl &> /dev/null; then
        curl -fsSL "$url" -o "$output"
    elif command -v wget &> /dev/null; then
        wget -q "$url" -O "$output"
    else
        echo "Error: Neither curl nor wget is installed."
        exit 1
    fi
}

# Ask for credentials
read -p "Enter database password [secret]: " DB_PASSWORD
DB_PASSWORD=${DB_PASSWORD:-secret}

read -p "Enter port to expose [${DEFAULT_PORT}]: " DB_PORT
DB_PORT=${DB_PORT:-$DEFAULT_PORT}

echo -e "\n${BLUE}Step 1: Fetching Docker configuration...${NC}"
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/config"

echo "Downloading Dockerfile..."
download_file "$RAW_BASE_URL/Dockerfile" "$TEMP_DIR/Dockerfile"

echo "Downloading postgresql.conf..."
download_file "$RAW_BASE_URL/config/postgresql.conf" "$TEMP_DIR/config/postgresql.conf"

echo "Downloading pg_hba.conf..."
download_file "$RAW_BASE_URL/config/pg_hba.conf" "$TEMP_DIR/config/pg_hba.conf"

cd "$TEMP_DIR"

echo -e "\n${BLUE}Step 2: Building Docker image...${NC}"
echo "This might take a minute..."
docker build -t $IMAGE_NAME .

echo -e "\n${BLUE}Step 3: Starting container...${NC}"
# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Removing existing container..."
    docker rm -f $CONTAINER_NAME
fi

docker run -d \
    --name $CONTAINER_NAME \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB="thormail_db" \
    -p "${DB_PORT}:5432" \
    -v thormail_pg_data:/var/lib/postgresql/data \
    --restart unless-stopped \
    $IMAGE_NAME

# Clean up
cd
rm -rf "$TEMP_DIR"

echo -e "\n${GREEN}=== Success! ===${NC}"
echo "PostgreSQL is running on port $DB_PORT"
echo -e "\n${BLUE}Connection Strings:${NC}"
echo "  - From Host:      postgres://postgres:*******@localhost:$DB_PORT/thormail_db"
echo "  - From Remote:    postgres://postgres:*******@YOUR_SERVER_IP:$DB_PORT/thormail_db"
echo "  - From Docker:    postgres://postgres:*******@$CONTAINER_NAME:5432/thormail_db"
echo -e "\nTo view logs: docker logs -f $CONTAINER_NAME"
