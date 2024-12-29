# Docker and EC2 Development Guide

# Important Note

When stopping the backend service:

1. Running `pm2 stop aicity-backend` does not stop the Docker container
2. Always check if container is still running with `docker ps`
3. If container is still active, stop it with:
   ```bash
   docker stop aicity-backend
   ```
4. **Warning**: If container remains running, it will continue to incur Together API costs

## EC2 File Structure

```
/home/ec2-user/apps/
├── ecosystem.config.js
├── backend/
│   └── aicity-backend/
│       ├── src/
│       ├── .env
│       └── Dockerfile
└── frontend/
    └── aicity-front/
        ├── src/
        ├── .env.local
        └── Dockerfile
```

## Navigation Commands

```bash
# Quick navigation aliases (add to ~/.bashrc)
alias cdapps='cd /home/ec2-user/apps'
alias cdback='cd /home/ec2-user/apps/backend/aicity-backend'
alias cdfront='cd /home/ec2-user/apps/frontend/aicity-front'

# List directory contents
ls -la

# Navigate to parent directory
cd ..

# Navigate to home
cd ~

# Show current path
pwd
```

## Common Commands

### PM2 with Ecosystem

```bash
# Navigate to apps directory where ecosystem.config.js is located
cd /home/ec2-user/apps

# Start all applications
pm2 start ecosystem.config.js

# Restart all applications
pm2 restart ecosystem.config.js

# Stop all applications
pm2 stop ecosystem.config.js

# Start specific application
pm2 start ecosystem.config.js --only aicity-backend
pm2 start ecosystem.config.js --only aicity-front

# Restart specific application
pm2 restart ecosystem.config.js --only aicity-backend

# Show ecosystem status
pm2 status

# Monitor processes
pm2 monit

# View logs
pm2 logs aicity-backend
pm2 logs aicity-front

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

### Ecosystem Configuration

The `ecosystem.config.js` file in the apps directory configures both frontend and backend:

```javascript
// /home/ec2-user/apps/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "aicity-backend",
      cwd: "/home/ec2-user/apps/backend/aicity-backend",
      script: "npm",
      args: "start",
      watch: true,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "aicity-front",
      cwd: "/home/ec2-user/apps/frontend/aicity-front",
      script: "npm",
      args: "start",
      watch: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
```

Key configurations:

- `name`: Process name for PM2
- `cwd`: Working directory for the application
- `script`: Entry point
- `watch`: Auto restart on file changes
- `env`: Environment variables

### Docker Commands

```bash
# List all running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Build container
docker build -t aicity-backend .  # for backend
docker build -t aicity-front .    # for frontend

# Start container
docker run --name aicity-backend --network aicity-network -p 3001:3001 -p 3002:3002 --env-file .env -d aicity-backend
docker run --name aicity-front --network aicity-network -p 3000:3000 --env-file .env.local -d aicity-front

# Stop container
docker stop aicity-backend
docker stop aicity-front

# Restart container
docker restart aicity-backend
docker restart aicity-front

# View container logs
docker logs aicity-backend
docker logs aicity-front

# View container logs continuously
docker logs -f aicity-backend
docker logs -f aicity-front
```

## Quick Start for New Developers

1. SSH into EC2:

```bash
ssh ec2-user@<EC2_IP>
```

2. Navigate to project directory:

```bash
# For backend
cd /home/ec2-user/apps/backend/aicity-backend

# For frontend
cd /home/ec2-user/apps/frontend/aicity-front
```

3. Pull latest changes:

```bash
git pull origin master
```

4. Rebuild and restart container:
   NAVIGATE FILES BEFORE DOING THAT GO TO DIRECTORIES AT REPOS

```bash

# Backend
docker build -t aicity-backend . && docker restart aicity-backend

# Frontend
docker build -t aicity-front . && docker restart aicity-front
```

## Troubleshooting

### Container Won't Start

```bash
# Check if container exists
docker ps -a | grep aicity

# Remove old container if needed
docker rm -f aicity-backend  # or aicity-front

# Check logs for errors
docker logs aicity-backend  # or aicity-front
```

### Network Issues

```bash
# Check if network exists
docker network ls | grep aicity-network

# Create network if missing
docker network create aicity-network

# Inspect network
docker network inspect aicity-network
```

### Resource Usage

```bash
# Check container resource usage
docker stats aicity-backend aicity-front

# Check disk space
df -h
```

## Important Notes

1. Always check `.env` and `.env.local` files are present before building
2. The containers use a shared network `aicity-network`
3. Backend runs on ports 3001 and 3002
4. Frontend runs on port 3000
5. Use `docker logs` to debug issues
6. Always pull latest changes before rebuilding
