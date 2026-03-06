# CoinRisqLab — Deployment Guide

Quick reference for deploying changes on the production server.

## Prerequisites

- SSH access to the server
- `pm2` installed globally (`sudo npm install -g pm2`)

## Frontend only

```bash
cd /home/ubuntu/coinrisqlab/coinrisqlab
git pull
cd coinrisqlab-front
npm run build
pm2 restart coinrisqlab-front
```

## Backend only

```bash
cd /home/ubuntu/coinrisqlab/coinrisqlab
git pull
sudo systemctl restart coinrisqlab-back
```

## Both

```bash
cd /home/ubuntu/coinrisqlab/coinrisqlab
git pull
cd coinrisqlab-front
npm run build
pm2 restart coinrisqlab-front
sudo systemctl restart coinrisqlab-back
```

## Verify

```bash
pm2 status
sudo systemctl status coinrisqlab-back
```

Check logs if something goes wrong:

```bash
pm2 logs coinrisqlab-front --lines 50
sudo journalctl -u coinrisqlab-back -n 50 --no-pager
```

## Important

- The frontend runs via **pm2** (`ecosystem.config.js`). Use `pm2 restart` / `pm2 stop` / `pm2 start` to manage it.
- The frontend **must be built** (`npm run build`) before restarting. `pm2 restart` only restarts the server, it does not rebuild.
- The backend runs via **systemctl** — `sudo systemctl restart coinrisqlab-back` is sufficient (no build step).
- If the port is stuck, check with `ss -tlnp | grep 3000` and kill the orphan PID before restarting.
