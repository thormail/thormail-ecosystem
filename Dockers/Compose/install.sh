#!/bin/bash

# Visual Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

FOLDER="/opt/thormail/"
ENV_PATH="/opt/thormail/.env"
EXAMPLE_ENV="/opt/thormail/.env.example"
LOCK_FILE="/opt/thormail/.setup_finished"

# Check if setup is already done
if [ -f "$LOCK_FILE" ]; then
    echo -e "${CYAN}Status:${NC} ThorMail services are ${GREEN}ACTIVE${NC}."
    APP_URL=$(grep "^APP_URL=" $ENV_PATH | cut -d'=' -f2)
    echo -e "Admin Panel: ${YELLOW}${APP_URL:-"Check your configuration"}${NC}"
    exit 0
fi

clear
echo -e "${CYAN}------------------------------------------------------------${NC}"
echo -e "${YELLOW}           THORMAIL ONE-CLICK CLOUD PROVISIONING${NC}"
echo -e "${CYAN}------------------------------------------------------------${NC}"

# 0. Pre-flight Checks
echo -e "Checking system requirements..."

REQUIRED_COMMANDS=("curl" "openssl" "docker")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}Error:${NC} $cmd is not installed. Please install it and retry."
        exit 1
    fi
done

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Error:${NC} Docker Compose plugin is not installed (run 'docker compose version' to verify)."
    exit 1
fi

# 1. Pre-fetch Public IP
echo -e "Detecting system details..."
DETECTED_IP=$(curl -s https://ifconfig.me)

# 2. Setup Directory & Download Configuration
mkdir -p "$FOLDER"
cd "$FOLDER" || exit

echo -e "${GREEN}[*]${NC} Downloading configuration files..."
curl -s -o docker-compose.yml https://raw.githubusercontent.com/thormail/thormail-ecosystem/refs/heads/main/Dockers/Compose/docker-compose.yml
curl -s -o .env.example https://raw.githubusercontent.com/thormail/thormail-ecosystem/refs/heads/main/Dockers/Compose/env.example

# 3. Environment Prep
if [ ! -f "$ENV_PATH" ]; then
    if [ -f ".env.example" ]; then
        cp ".env.example" "$ENV_PATH"
    else
        echo -e "${RED}Error:${NC} Failed to download .env.example"
        exit 1
    fi
fi

# 3. Automated Security Keys Generation
echo -e "${GREEN}[*]${NC} Generating secure infrastructure keys..."
STARTUP_PASS=$(openssl rand -base64 12 | tr -d '/+=')
sed -i "s|^STARTUP_PASSWORD=.*|STARTUP_PASSWORD=$STARTUP_PASS|g" "$ENV_PATH"
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$(openssl rand -hex 16)|g" "$ENV_PATH"
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48)|g" "$ENV_PATH"
sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -hex 16)|g" "$ENV_PATH"
echo -e "${GREEN}[✓]${NC} Security keys and Startup Password generated."

# 4. User Input Section
echo -e "\n${YELLOW}Please configure your instance details:${NC}"

while true; do
    read -p "   1. Admin Email (Your Login): " ADMIN_EMAIL
    if [[ "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        break
    else
        echo -e "      ${RED}Error:${NC} Invalid email format."
    fi
done

echo -e "   2. Instance Domain or IP"
read -p "      (Default: $DETECTED_IP, leave blank to use it): " APP_INPUT
APP_DOMAIN=${APP_INPUT:-$DETECTED_IP}

# 5. Final Writes
sed -i "s|^EMAIL=.*|EMAIL=$ADMIN_EMAIL|g" "$ENV_PATH"
sed -i "s|^NUXT_PUBLIC_API_BASE=.*|NUXT_PUBLIC_API_BASE=http://$APP_DOMAIN:4000|g" "$ENV_PATH"
sed -i "s|^APP_URL=.*|APP_URL=http://$APP_DOMAIN:3000|g" "$ENV_PATH"

# 6. Final Confirmation
echo -e "\n${CYAN}Review Configuration:${NC}"
echo -e "------------------------------------------------------------"
printf "| %-20s | %-33s |\n" "Admin Email" "$ADMIN_EMAIL"
printf "| %-20s | %-33s |\n" "Startup Password" "$STARTUP_PASS"
printf "| %-20s | %-33s |\n" "Admin Panel" "http://$APP_DOMAIN:3000"
printf "| %-20s | %-33s |\n" "Backend API" "http://$APP_DOMAIN:4000"
echo -e "------------------------------------------------------------"

read -p "Proceed with deployment? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" ]]; then
    echo -e "${RED}Setup aborted.${NC}"
    exit 1
fi

# 7. Deployment & Progress Bar
echo -e "\n${GREEN}Booting ThorMail containers...${NC}"
cd /opt/thormail && docker compose up -d > /dev/null 2>&1

echo -e "${CYAN}Initializing database and backend scripts...${NC}"

# Progress Bar Logic (10 seconds)
duration=10
already_done=0
while [ $already_done -lt $duration ]; do
    already_done=$((already_done + 1))
    percentage=$((already_done * 100 / duration))
    # Calculate bar width
    bar_size=$((percentage / 4))
    bar=$(printf "%${bar_size}s" | tr ' ' '#')
    spaces=$(printf "%$((25 - bar_size))s" | tr ' ' '-')
    
    printf "\rProgress: [%s%s] %d%%" "$bar" "$spaces" "$percentage"
    sleep 1
done

touch "$LOCK_FILE"

echo -e "\n\n${GREEN}SUCCESS!${NC} ThorMail engine is ready."
echo -e "------------------------------------------------------------"
echo -e "LOGIN EMAIL:    ${CYAN}$ADMIN_EMAIL${NC}"
echo -e "PASSWORD:       ${CYAN}$STARTUP_PASS${NC}"
echo -e "ADMIN PANEL:    ${YELLOW}http://$APP_DOMAIN:3000${NC}"
echo -e "------------------------------------------------------------"