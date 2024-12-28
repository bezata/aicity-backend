module.exports = {
  apps: [
    {
      name: "docker-frontend",
      script: "bash",
      args: `-c "docker rm -f aicity-frontend || true && docker run -d \
          --restart unless-stopped \
          --memory=4g \
          --memory-reservation=3g \
          --memory-swap=6g \
          --cpus=1.2 \
          --cpu-shares=1200 \
          -p 3000:3000 \
          --env-file ./.env.local \
          --name aicity-frontend \
          -e NEXT_PUBLIC_API_URL=https://backend.neurova.fun/api \
          -e NEXT_PUBLIC_WS_URL=wss://backend.neurova.fun/ws \
          aicity-frontend"`,
      autorestart: true,
      watch: false,
      max_memory_restart: "4G",
    },
    {
      name: "docker-backend",
      script: "bash",
      args: `-c "docker rm -f aicity-backend || true && docker run -d \
          --restart unless-stopped \
          --memory=8g \
          --memory-reservation=6g \
          --memory-swap=12g \
          --cpus=2 \
          --cpu-shares=2048 \
          -p 3001:3001 \
          -p 3002:3002 \
          --env-file ./backend/aicity-backend/.env \
          --name aicity-backend \
          -e CORS_ORIGIN=https://neurova.fun \
          -e WS_ORIGIN=https://neurova.fun \
          aicity-backend"`,
      autorestart: true,
      watch: false,
      max_memory_restart: "8G",
    },
    {
      name: "docker-nginx",
      script: "bash",
      args: `-c "docker rm -f aicity-nginx || true && docker run -d \
          --restart unless-stopped \
          --memory=2g \
          --memory-reservation=1g \
          --memory-swap=4g \
          --cpus=0.8 \
          --cpu-shares=800 \
          -p 80:80 \
          -p 443:443 \
          --name aicity-nginx \
          -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
          -v /etc/letsencrypt:/etc/letsencrypt:ro \
          nginx:alpine"`,
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
    },
  ],
};
