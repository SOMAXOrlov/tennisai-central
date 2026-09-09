# Moving to a real domain

The app answers on `46-225-83-85.sslip.io` — genuine HTTPS, no DNS setup, and
it will keep working after you move. This is the checklist for pointing a domain
you own at the same server.

`README.md` has the three-line version. This file exists for the details that
decide whether it takes five minutes or an afternoon.

## The one thing worth knowing first

**No rebuild is needed.** The web image bakes in exactly one build-time value,
`VITE_API_BASE_URL=/api` (`Dockerfile.web`), which is a relative path — the
browser resolves it against whatever host it loaded the page from. The API's
`APP_URL`, which appears in e-mail links, is read at *runtime* from
`SITE_ADDRESS`. So a domain change is a config edit and a restart, not a deploy.

## This server

| | |
|---|---|
| IPv4 | `46.225.83.85` |
| IPv6 | `2a01:4f8:1c19:b6aa::1` |
| Current `SITE_ADDRESS` | `46-225-83-85.sslip.io` |

## 1. DNS, before touching the server

At your registrar, for `example.com` (substitute your name):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `46.225.83.85` | 300 |
| AAAA | `@` | `2a01:4f8:1c19:b6aa::1` | 300 |
| A | `www` | `46.225.83.85` | 300 |
| AAAA | `www` | `2a01:4f8:1c19:b6aa::1` | 300 |

Add the AAAA records or leave them off, but be consistent: a name with an AAAA
record pointing somewhere else will fail for IPv6 visitors only, which is the
kind of fault that looks like "the site is down for some people".

Use a short TTL (300) until you are happy, then raise it.

**Wait for it to resolve before step 2.** Caddy asks Let's Encrypt for a
certificate the moment you restart it, and Let's Encrypt checks the name
resolves to this server. If DNS has not propagated the request fails, and
**failed attempts count against a rate limit of 5 per hostname per hour**. That
is the one mistake here that costs real time.

```bash
dig +short example.com A
dig +short example.com AAAA
# both must print the addresses above
```

## 2. Change the hostname on the server

```bash
cd /opt/tennisai/deploy/hetzner
cp .env .env.bak-$(date +%F)
sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=example.com/' .env
grep '^SITE_ADDRESS' .env
docker compose up -d
```

`docker compose up -d` recreates the web and api containers because their
environment changed. The database is untouched.

Caddy fetches the certificate on first request to the new name. Give it a few
seconds, then:

```bash
docker compose logs --tail 30 web | grep -iE "certificate|obtain|error"
```

## 3. Verify

```bash
curl -fsS https://example.com/api/health          # {"ok":true,...}
curl -o /dev/null -sS -w '%{http_code}\n' https://example.com/
curl -sSI https://example.com | grep -iE "x-frame|nosniff"   # security headers present
```

**HSTS is not sent yet, by design.** Caddy does not add it on its own (an earlier
version of this file assumed it did), and once a browser has seen it, that browser
refuses plain HTTP to the host for `max-age` — fine for a domain you keep, wrong
for the throwaway sslip.io name. After the new domain has served HTTPS correctly
for a few days, add this line inside the `header { }` block of the Caddyfile:

```
Strict-Transport-Security "max-age=31536000; includeSubDomains"
```

The Caddyfile is baked into the web image, so rebuild that one service and
confirm the header:

```bash
docker compose up -d --build web
curl -sSI https://example.com | grep -i strict-transport
```

Then open the site and sign in. If sign-in works, the same-origin assumption
held and there is nothing else to check.

## 4. Afterwards

- **`www` is not served yet.** The Caddyfile matches `{$SITE_ADDRESS}` only, so
  `www.example.com` gets a certificate error rather than a redirect. If you
  added the `www` records, add the redirect too:

  ```
  www.example.com {
      redir https://example.com{uri} permanent
  }
  ```

- **E-mail links change** with `APP_URL`, so verification and password-reset
  links sent before the change point at the old hostname. They still work —
  the sslip.io name continues to resolve — but a link sent tomorrow will use
  the new domain.

- **Monitoring**: `deploy/hetzner/monitoring/` references the hostname in its
  sample monitor and README. Update whatever you actually configured.

- **The old hostname keeps working** and keeps its own certificate. Leave it as
  a fallback, or add a redirect to the new name once you trust it.

- **Nothing in the legal pages names a hostname**, so they need no edit. The
  company details in `src/lib/legal/companyDetails.ts` are a separate task and
  still unresolved.

## Rolling back

```bash
cd /opt/tennisai/deploy/hetzner
cp .env.bak-<date> .env
docker compose up -d
```

Under a minute, and the old certificate is still cached.
