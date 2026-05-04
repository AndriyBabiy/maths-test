# Deployment runbook

Deploys the Next.js web UI (`apps/web`) to a shared Hetzner VPS as a single Docker container behind the host's existing nginx. The diagnostic and study-plan agents run in-process inside the same container — there is no separate agent service to deploy.

**Target host:** `maths-test.andriybabiy.com` → `78.47.89.101` (Hetzner Default project, `studyie-vps`)
**Tenant pattern:** matches `studyie`, `movie-generator`, `teamwork-board.andriybabiy.com` etc. — host nginx fronts everything, each app binds 127.0.0.1:`<port>`.

---

## What this deploy gives you

- One Docker container running `next start` on `127.0.0.1:8088` (loopback only). The container itself listens on `:3000`; the host port is `8088` because port `3000` on this box is already taken by `studyie-grafana`.
- The box's existing host nginx terminates TLS and proxies to `127.0.0.1:8088`.
- TLS via the shared **Cloudflare Origin Certificate** for `*.andriybabiy.com` (15-year validity, no certbot, no Let's Encrypt rate-limit risk). Already on disk at `/etc/nginx/andriybabiy-origin.{pem,key}`.
- Manual deploy from your laptop via `scripts/deploy.sh` (no CI deploy — kept off the critical path so a bad CI run can't take prod down).

---

## One-time setup

### 1. Cloudflare DNS + proxy

Create an A record on `andriybabiy.com`:

```
maths-test  →  78.47.89.101   (Proxied / orange cloud)
```

**Cloudflare must be in "Full (Strict)" SSL mode** (project default for andriybabiy.com — already set). The Origin Cert authenticates the box to Cloudflare; orange-cloud routes user traffic through Cloudflare's edge.

Verify resolution from your laptop with `dig maths-test.andriybabiy.com` — proxied records resolve to a Cloudflare IP (104.x.x.x or 172.x.x.x), **not** the origin IP.

### 2. VPS prerequisites (already satisfied for `studyie-vps`)

SSH should work as the `deploy` user:

```bash
ssh -i ~/.ssh/studyie_vps deploy@78.47.89.101 'docker --version; nginx -v; ls /etc/nginx/andriybabiy-origin.*'
```

Expected: Docker present, nginx present, both Origin Cert files present.

If your home IP rotated and SSH refuses, the SSH rule on the project firewall is `Any IPv4` (no allowlist) — so connection refused means sshd or the server itself, not the firewall. Check the Hetzner console for a reboot in progress.

### 3. Repo + env on the box

```bash
ssh -i ~/.ssh/studyie_vps deploy@78.47.89.101
mkdir -p /home/deploy/maths-test
cd /home/deploy/maths-test
git clone https://github.com/AndriyBabiy/maths-test.git .
cp .env.example .env
nano .env                 # fill OPENROUTER_API_KEY (from openrouter.ai → Account → Keys)
chmod 600 .env
```

`.env` lives only on the box — never committed.

### 4. First Docker build

```bash
cd /home/deploy/maths-test
docker compose up -d --build
docker compose ps         # web should be Up (healthy) on 127.0.0.1:3000
curl -fsSI http://127.0.0.1:8088 | head -1   # 200 OK
```

### 5. Install the nginx vhost (one-time, needs real root)

The `deploy` user can `sudo nginx -t` and `sudo systemctl reload nginx` (NOPASSWD) but **cannot** `sudo cp` into `/etc/nginx/conf.d/`. Ask the box's root for this once:

```bash
# as root on 78.47.89.101:
cp /home/deploy/maths-test/apps/web/deploy/nginx/maths-test.andriybabiy.com.conf \
   /etc/nginx/conf.d/maths-test.andriybabiy.com.conf
chown deploy:deploy /etc/nginx/conf.d/maths-test.andriybabiy.com.conf
nginx -t && systemctl reload nginx
```

After the `chown`, future edits to the vhost can be done by the `deploy` user with no further root involvement (overwrite the file, then `sudo nginx -t && sudo systemctl reload nginx`).

### 6. Smoke-test the public URL

```bash
# From your laptop:
curl -fsSI https://maths-test.andriybabiy.com | head -8
```

Should return `HTTP/2 200`. The certificate the browser sees is **Cloudflare's edge cert**, not the Origin Cert (Cloudflare re-encrypts to the user).

---

## Subsequent deploys

From your laptop:

```bash
./scripts/deploy.sh
```

The script:
1. Refuses if the working tree is dirty or if the current branch isn't `main`.
2. Pushes `main` to GitHub.
3. SSHes to the box, `git fetch + reset --hard origin/main`, `docker compose build --pull`, `docker compose up -d --remove-orphans`.
4. Prunes dangling images, then tails web logs for 10s to catch a startup crash.

To deploy a non-main branch (debug-only):

```bash
DEPLOY_BRANCH=$(git rev-parse --abbrev-ref HEAD) ./scripts/deploy.sh
```

If the nginx vhost itself changes, after the deploy:

```bash
ssh -i ~/.ssh/studyie_vps deploy@78.47.89.101 \
  'cp /home/deploy/maths-test/apps/web/deploy/nginx/maths-test.andriybabiy.com.conf \
     /etc/nginx/conf.d/maths-test.andriybabiy.com.conf && \
   sudo nginx -t && sudo systemctl reload nginx'
```

(Works only because step 5 above transferred ownership of the installed conf to `deploy`.)

---

## Rollback

```bash
ssh -i ~/.ssh/studyie_vps deploy@78.47.89.101
cd /home/deploy/maths-test
git log --oneline -10              # find last good SHA
git checkout <sha>
docker compose up -d --build
```

The previous container image stays in Docker's local cache for `docker image prune` to reclaim, so rollback restarts are usually <30s if the prior image hasn't been pruned yet.

---

## Updating env vars

```bash
ssh -i ~/.ssh/studyie_vps deploy@78.47.89.101
cd /home/deploy/maths-test
nano .env
docker compose up -d                  # recreates the web container with new env
```

No rebuild — env is read at container start.

---

## Logs and ops

```bash
# Container
docker compose logs -f web
docker compose ps

# nginx (host-level — ALL tenants share these logs in /var/log/nginx/)
sudo tail -f /var/log/nginx/maths-test.andriybabiy.access.log
sudo tail -f /var/log/nginx/maths-test.andriybabiy.error.log

# Disk
docker system df
```

---

## Why no CI deploy?

GitHub Actions runs typecheck + tests + Next.js build on every push, but does **not** push the build to the VPS. Deploys are manual via `scripts/deploy.sh` so a green CI run can't auto-roll a regression onto production. The deploy script does the rebuild on the box itself, so the only secret on the box is the OpenRouter API key in `.env` — there's no SSH key sitting in GitHub Actions.

---

## Security notes

- `.env` on the box has 0600 permissions — set them with `chmod 600 .env` after editing.
- The Next.js container binds to `127.0.0.1:3000` only, so it's not reachable except via host nginx.
- Docker container runs as non-root (UID 1001 `nextjs`, see `apps/web/Dockerfile`).
- TLS uses the shared Cloudflare Origin Cert; the cert/key files at `/etc/nginx/andriybabiy-origin.*` are owned by `root:root` mode `0640` and are read by nginx workers via the `www-data` group.
- The host firewall (Hetzner Cloud Firewall `studyie-vps-allow-web-ssh`) allows 22/TCP, 80/TCP, 443/TCP from any IPv4 — port 3000 is **not** exposed publicly because it's bound to loopback.
