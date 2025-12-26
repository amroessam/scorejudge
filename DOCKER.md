# Docker Setup for ScoreJudge

## Build the Docker Image

```bash
docker build -t scorejudge .
```

## Run the Container

```bash
docker run -d \
  --name scorejudge \
  -p 3000:3000 \
  -e GOOGLE_CLIENT_ID=your_google_client_id \
  -e GOOGLE_CLIENT_SECRET=your_google_client_secret \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e NEXTAUTH_SECRET=your_nextauth_secret \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  scorejudge
```

## View Logs

```bash
docker logs -f scorejudge
```

## Stop the Container

```bash
docker stop scorejudge
```

## Remove the Container

```bash
docker rm scorejudge
```

## Restart the Container

```bash
docker restart scorejudge
```

## Access the Application

Once running, access at: **http://localhost:3000**

## One-Line Commands

**Build and run:**
```bash
docker build -t scorejudge . && docker run -d --name scorejudge -p 3000:3000 -e GOOGLE_CLIENT_ID=your_google_client_id -e GOOGLE_CLIENT_SECRET=your_google_client_secret -e NEXTAUTH_URL=http://localhost:3000 -e NEXTAUTH_SECRET=your_nextauth_secret -e NODE_ENV=production -e PORT=3000 -e HOSTNAME=0.0.0.0 scorejudge
```

**Stop and remove:**
```bash
docker stop scorejudge && docker rm scorejudge
```
