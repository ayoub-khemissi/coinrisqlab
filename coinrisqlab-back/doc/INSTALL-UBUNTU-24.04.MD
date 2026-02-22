# CoinRisqLab — Installation Guide for Ubuntu 24.04 LTS

This guide walks you through a full production-ready installation of CoinRisqLab on a fresh Ubuntu 24.04 LTS server.

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [System Preparation](#2-system-preparation)
3. [Install Node.js](#3-install-nodejs)
4. [Install MySQL](#4-install-mysql)
5. [Create the Database](#5-create-the-database)
6. [Clone the Repository](#6-clone-the-repository)
7. [Backend Setup](#7-backend-setup)
8. [Frontend Setup](#8-frontend-setup)
9. [Run the Application](#9-run-the-application)
10. [Production Deployment](#10-production-deployment)
    - [Systemd Services](#systemd-services)
    - [Nginx Reverse Proxy](#nginx-reverse-proxy)
    - [Scheduled Tasks (Cron)](#scheduled-tasks-cron)
11. [Firewall Configuration](#11-firewall-configuration)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. System Requirements

| Component | Minimum           |
| --------- | ----------------- |
| OS        | Ubuntu 24.04 LTS  |
| CPU       | 1 vCPU            |
| RAM       | 2 GB              |
| Disk      | 20 GB             |
| Node.js   | v20+              |
| MySQL     | 8.0+              |

## 2. System Preparation

Update the system and install basic utilities:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

## 3. Install Node.js

Install Node.js 20.x via the NodeSource repository:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify the installation:

```bash
node -v   # should print v20.x.x
npm -v    # should print 10.x.x
```

## 4. Install MySQL

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
```

Secure the installation:

```bash
sudo mysql_secure_installation
```

Create a dedicated database user:

```bash
sudo mysql
```

```sql
CREATE USER 'coinrisqlab'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
CREATE DATABASE coinrisqlab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON coinrisqlab.* TO 'coinrisqlab'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 5. Create the Database

Initialize the schema from the SQL init script shipped with the backend:

```bash
sudo mysql coinrisqlab < /opt/coinrisqlab/coinrisqlab-back/sql/init.sql
```

> **Note:** Adjust the path if you cloned the repository somewhere else (see next step).

## 6. Clone the Repository

```bash
sudo mkdir -p /opt/coinrisqlab
sudo chown $USER:$USER /opt/coinrisqlab
git clone <repository-url> /opt/coinrisqlab
cd /opt/coinrisqlab
```

## 7. Backend Setup

```bash
cd /opt/coinrisqlab/coinrisqlab-back
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
nano .env
```

Key variables to configure:

```dotenv
# Log configuration (1 = debug, 2 = info, 3 = warning, 4 = error)
COINRISQLAB_LOG_LEVEL="2"
COINRISQLAB_LOG_DIRECTORY_PATH="log"

# Frontend configuration
COINRISQLAB_FRONT_DOMAIN="your-domain.com"
COINRISQLAB_FRONT_HOSTNAME="your-domain.com"
COINRISQLAB_FRONT_PORT="443"
COINRISQLAB_FRONT_HTTPSECURE="true"

# API configuration
COINRISQLAB_API_HOSTNAME="0.0.0.0"
COINRISQLAB_API_PORT="3001"
COINRISQLAB_API_HTTPSECURE="false"
COINRISQLAB_API_JWT_SECRET="GENERATE_A_LONG_RANDOM_STRING"

# Cookie configuration
COINRISQLAB_COOKIES_SAME_SITE="lax"

# Database configuration
COINRISQLAB_DB_HOST="localhost"
COINRISQLAB_DB_PORT="3306"
COINRISQLAB_DB_USER="coinrisqlab"
COINRISQLAB_DB_PASSWORD="YOUR_STRONG_PASSWORD"
COINRISQLAB_DB_DATABASE="coinrisqlab"

# External API keys
COINMARKETCAP_API_KEY="your-cmc-api-key"
COINGECKO_API_KEY="your-coingecko-api-key"
```

Create the log directory:

```bash
mkdir -p /opt/coinrisqlab/coinrisqlab-back/log
```

## 8. Frontend Setup

```bash
cd /opt/coinrisqlab/coinrisqlab-front
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
nano .env
```

```dotenv
NEXT_PUBLIC_COINRISQLAB_API_PORT="3001"
NEXT_PUBLIC_COINRISQLAB_API_HOSTNAME="your-domain.com"
NEXT_PUBLIC_COINRISQLAB_API_HTTPSECURE="true"
```

Build the production bundle:

```bash
npm run build
```

## 9. Run the Application

### Quick start (development)

In two separate terminals:

```bash
# Terminal 1 — Backend
cd /opt/coinrisqlab/coinrisqlab-back
npm run dev

# Terminal 2 — Frontend
cd /opt/coinrisqlab/coinrisqlab-front
npm run dev
```

### Initial data population

After first start, populate the database by running these commands in order:

```bash
cd /opt/coinrisqlab/coinrisqlab-back

npm run fetch-crypto-data
npm run fetch-crypto-metadata
npm run fetch-global-metrics
npm run fetch-fear-and-greed
npm run calculate-log-returns
npm run calculate-crypto-volatility
npm run calculate-portfolio-volatility
npm run calculate-index
```

Or run everything at once:

```bash
npm run update-all
```

## 10. Production Deployment

### Systemd Services

#### Backend service

Create `/etc/systemd/system/coinrisqlab-back.service`:

```ini
[Unit]
Description=CoinRisqLab Backend API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/coinrisqlab/coinrisqlab-back
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### Frontend service

Create `/etc/systemd/system/coinrisqlab-front.service`:

```ini
[Unit]
Description=CoinRisqLab Frontend (Next.js)
After=network.target coinrisqlab-back.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/coinrisqlab/coinrisqlab-front
ExecStart=/usr/bin/npx next start -p 3000
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start both services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now coinrisqlab-back coinrisqlab-front
```

Check status:

```bash
sudo systemctl status coinrisqlab-back
sudo systemctl status coinrisqlab-front
```

### Nginx Reverse Proxy

Install Nginx:

```bash
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/coinrisqlab`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/coinrisqlab /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

#### SSL with Certbot (recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot will automatically configure HTTPS and set up auto-renewal.

### Scheduled Tasks (Cron)

Set up cron jobs to keep data up to date. Edit the crontab:

```bash
sudo crontab -u www-data -e
```

Add the following entries:

```cron
# Fetch market data every 5 minutes
*/5 * * * * cd /opt/coinrisqlab/coinrisqlab-back && /usr/bin/node commands/fetchCryptoMarketData.js >> /opt/coinrisqlab/coinrisqlab-back/log/cron.log 2>&1

# Fetch global metrics every 15 minutes
*/15 * * * * cd /opt/coinrisqlab/coinrisqlab-back && /usr/bin/node commands/fetchGlobalMetrics.js >> /opt/coinrisqlab/coinrisqlab-back/log/cron.log 2>&1

# Fetch Fear & Greed Index every hour
0 * * * * cd /opt/coinrisqlab/coinrisqlab-back && /usr/bin/node commands/fetchFearAndGreed.js >> /opt/coinrisqlab/coinrisqlab-back/log/cron.log 2>&1

# Fetch cryptocurrency metadata once a day at 02:00
0 2 * * * cd /opt/coinrisqlab/coinrisqlab-back && /usr/bin/node commands/fetchCryptoMetadata.js >> /opt/coinrisqlab/coinrisqlab-back/log/cron.log 2>&1

# Calculate log returns, volatility, and index daily at 03:00
0 3 * * * cd /opt/coinrisqlab/coinrisqlab-back && /usr/bin/node commands/updateAll.js >> /opt/coinrisqlab/coinrisqlab-back/log/cron.log 2>&1
```

## 11. Firewall Configuration

If you are using `ufw`:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

> Do **not** expose ports 3000 and 3001 directly — Nginx handles all external traffic.

## 12. Troubleshooting

### Backend won't start

- Check logs: `journalctl -u coinrisqlab-back -f`
- Verify MySQL is running: `sudo systemctl status mysql`
- Test database connection: `mysql -u coinrisqlab -p coinrisqlab -e "SHOW TABLES;"`

### Frontend build fails

- Ensure Node.js v20+: `node -v`
- Clear the Next.js cache: `rm -rf .next && npm run build`

### Cron jobs not running

- Check cron log: `tail -f /opt/coinrisqlab/coinrisqlab-back/log/cron.log`
- Verify crontab: `sudo crontab -u www-data -l`
- Ensure `www-data` has read/write access: `sudo chown -R www-data:www-data /opt/coinrisqlab`

### MySQL connection refused

- Verify MySQL is listening: `sudo ss -tlnp | grep 3306`
- Check MySQL user credentials: `mysql -u coinrisqlab -p`
