# Skillforge

Team skill inventory + knowledge mapping platform. Tracks who knows what,
flags bus-factor risks, recommends staffing, and generates learning paths
with Claude.

Lives on the shared `khan-fluent` ECS cluster + RDS instance. Port `3003`
behind Cloudflare at `skillforge.khanfluent.digital`.

## Stack

- **Server**: Node 20, Express, Postgres (`pg`), `@anthropic-ai/sdk`
- **Client**: React 18 + Vite, Framer Motion, react-force-graph, D3
- **Infra**: ECR, ECS-on-EC2 (consumed via SSM coordinates), Postgres DB
  auto-bootstrapped on the shared `khan-fluent` RDS instance
- **Secrets**: SSM Parameter Store (SecureString) — free-tier safe

## Local dev

```bash
cd app/server && npm install && cp .env.example .env  # fill DB + ANTHROPIC_API_KEY
cd ../client && npm install
docker compose up                                       # or run server + client manually
```

## Deploy

GitOps. Push to `main`:
- `app/**` or `Dockerfile` change → `Deploy` workflow builds + rolls ECS service
- `terraform/**` change → `Infrastructure` workflow plans (PR) / applies (push)
