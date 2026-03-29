# CoinRisqLab — Deployment Guide

Quick reference for deploying changes on the production server.

## Prerequisites

- SSH access to the server
- `pm2` installed globally (`sudo npm install -g pm2`)

## Frontend only

```bash
cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-front
npm run build
pm2 stop coinrisqlab-front
sleep 1
sudo fuser -k 3000/tcp 2>/dev/null
sleep 1
pm2 start coinrisqlab-front
```

## Backend only

```bash
cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back
pm2 restart coinrisqlab-back
```

## Both

```bash
cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-front
npm run build

cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back
pm2 restart coinrisqlab-back

pm2 stop coinrisqlab-front
sleep 1
sudo fuser -k 3000/tcp 2>/dev/null
sleep 1
pm2 start coinrisqlab-front
```

## Verify

```bash
pm2 status
curl -s http://localhost:3001/ | head -1
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
```

Check logs if something goes wrong:

```bash
pm2 logs coinrisqlab-front --lines 50 --nostream
pm2 logs coinrisqlab-back --lines 50 --nostream
```

## Important

- **Both frontend and backend run via pm2.** The old `systemctl` service for the backend is disabled.
- The frontend **must be built** (`npm run build`) before restarting. `pm2 restart` only restarts the server, it does not rebuild.
- The backend has **no build step** — `pm2 restart coinrisqlab-back` is sufficient.
- **Port 3000 stuck fix:** Always stop pm2 first, then kill the orphan process with `sudo fuser -k 3000/tcp`, then start pm2. Never just `pm2 restart coinrisqlab-front` — this can leave orphan Node processes holding the port.
- If the frontend shows `EADDRINUSE` errors in logs, run: `pm2 stop coinrisqlab-front && sudo fuser -k 3000/tcp && pm2 start coinrisqlab-front`
