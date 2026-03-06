# CoinRisqLab — Deployment Guide

Quick reference for deploying changes on the production server.

## Prerequisites

- SSH access to the server
- `sudo` permissions for `systemctl`

## Frontend only

```bash
cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-front
npm run build
sudo systemctl restart coinrisqlab-front
```

## Backend only

```bash
sudo systemctl restart coinrisqlab-back
```

## Both

```bash
cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-front
npm run build
sudo systemctl restart coinrisqlab-back coinrisqlab-front
```

## Verify

```bash
sudo systemctl status coinrisqlab-back coinrisqlab-front
```

Check logs if something goes wrong:

```bash
sudo journalctl -u coinrisqlab-front -n 50 --no-pager
sudo journalctl -u coinrisqlab-back -n 50 --no-pager
```

## Important

- **Always use `systemctl`** to manage services. Never kill processes manually (`kill`, `fuser -k`) — this can leave orphan processes blocking the port.
- The frontend **must be built** (`npm run build`) before restarting. `systemctl restart` only restarts the server, it does not rebuild.
- The backend does **not** need a build step — `systemctl restart` is sufficient.
