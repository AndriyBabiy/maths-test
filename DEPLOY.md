# Deployment runbook

Deploys the Next.js web UI (`apps/web`) to a Hetzner VPS as a single Docker container behind a Caddy reverse proxy. Lua agent itself runs on Lua's platform — see the README for `lua push --auto-deploy`.

**Target host:** `maths-test.andriybabiy.com` → Hetzner VPS

---

## What this deploy gives you

- One Docker container running `next start` on port 3000.
- One Caddy container fronting it on 80/443 with auto-TLS via Let's Encrypt.
- Manual deploy from your laptop via `scripts/deploy.sh` (no CI deploy — kept off the critical path so a bad CI run can't take prod down).

---

## One-time setup

### 1. DNS

Create an A record:

```
maths-test.andriybabiy.com  →  <hetzner VPS public IPv4>
```

Verify with `dig +short maths-test.andriybabiy.com` before continuing — Caddy needs DNS to resolve to the box for the ACME HTTP-01 challenge to succeed.

### 2. VPS prerequisites

SSH into the box and confirm Docker + docker-compose plugin are installed:

```bash
ssh root@maths-test.andriybabiy.com
docker --version
docker compose version
```

If absent, install via `apt-get install docker.io docker-compose-plugin` or use Hetzner's "Docker CE" snapshot.

### 3. Repo + env on the box

```bash
ssh root@maths-test.andriybabiy.com
mkdir -p /opt/maths-test
cd /opt/maths-test
git clone https://github.com/AndriyBabiy/maths-test.git .
cp .env.example .env
nano .env       # fill in LUA_AGENT_ID, LUA_API_KEY, DOMAIN, ACME_EMAIL
```

`.env` lives only on the box — never committed.

### 4. First deploy

From the box:

```bash
cd /opt/maths-test
docker compose up -d --build
```

Wait ~60s for Caddy to obtain a cert. Check:

```bash
docker compose logs caddy | tail -50
docker compose logs web | tail -50
curl -I https://maths-test.andriybabiy.com
```

---

## Subsequent deploys

From your laptop:

```bash
./scripts/deploy.sh
```

The script:
1. Pushes the current branch to `origin/main` (you must commit first).
2. SSHes to the box, `git pull`, `docker compose up -d --build`.
3. Tails web + caddy logs for 10s to confirm healthy startup.

To deploy a non-main branch, edit `DEPLOY_BRANCH` at the top of the script.

---

## Rollback

```bash
ssh root@maths-test.andriybabiy.com
cd /opt/maths-test
git log --oneline -10            # find last good commit
git checkout <sha>
docker compose up -d --build
```

---

## Updating env vars

```bash
ssh root@maths-test.andriybabiy.com
cd /opt/maths-test
nano .env
docker compose up -d              # picks up the new env (recreates the web container)
```

No rebuild needed — env is read at container start.

---

## Logs and ops

```bash
# tail
docker compose logs -f web
docker compose logs -f caddy

# disk
docker system df

# restart only one service
docker compose restart web
```

---

## Why no CI deploy?

This repo's GitHub Actions workflow runs typecheck + tests + lint on every push, but does **not** push the build to the VPS. Deploys are manual via `scripts/deploy.sh` so a green CI run can't auto-roll a regression onto production. The deploy script does the rebuild on the box itself, so the only secret on the box is the Lua API key in `.env` — there's no SSH key sitting in GitHub Actions.

---

## Security notes

- `.env` on the box has 0600 permissions — set them with `chmod 600 .env` after editing.
- The Caddy admin endpoint is bound to localhost only.
- Docker containers run as non-root (see `Dockerfile`).
- The Next.js container is the only port-bound service to the public Caddy network.
