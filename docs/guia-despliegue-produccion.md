# Guía de despliegue productivo — AvicontAI en internet (de manera correcta)

Esta guía es para dejar el sistema **corriendo 24/7 en internet**, no para una
demo. La diferencia clave con el runbook de demo:

| | Demo (`runbook-demo-local-cloudflare.md`) | Producción (este doc) |
|---|---|---|
| Cómo corre | `pnpm start` + `cloudflared run` a mano | **servicios** que arrancan solos y reinician |
| Sobrevive reinicio/cierre de terminal | no | **sí** |
| Clerk | instancia dev (`pk_test`) | instancia **prod** (`pk_live`) |
| Máquina | tu PC de dev (WSL2) | máquina **que queda prendida** (server/VPS) |
| Backups DB | no | **sí** |

---

## 0. Decisión de arquitectura

| Opción | Cuándo | Tradeoff |
|---|---|---|
| **Self-hosted + Cloudflare Tunnel** (recomendado para vos) | Ya tenés `mattbits.com` y una máquina con otros sistemas tuneleados | Vos administrás la máquina; control total; costo casi cero |
| Cloud (Vercel + Postgres gestionado como Neon/Supabase) | Si no querés administrar máquina | Más simple de operar; costos mensuales; menos control |

El resto de la guía asume **self-hosted + tunnel**, porque encaja con tu infra
actual. La sección final tiene la variante cloud resumida.

> ⚠️ **WSL2 no es para producción permanente.** WSL2 no arranca solo al prender
> la PC y systemd ahí requiere config extra. Para "en internet de manera
> correcta" usá una **máquina Linux que quede encendida** (un mini-server, una
> PC dedicada, o un VPS). Puede ser la misma "otra computadora" donde ya corrés
> tus otros sistemas.

---

## 1. Si va en la máquina que YA tiene tu túnel → solo agregás un ingress

Si desplegás avicont en la **misma máquina** donde corre el cloudflared de tus
otros sistemas, **no creás un túnel nuevo**: agregás una regla al `config.yml`
existente (ese cloudflared ya puede alcanzar el `localhost` de esa máquina).

```yaml
# ~/.cloudflared/config.yml (o /etc/cloudflared/config.yml) en ESA máquina
ingress:
  - hostname: sistema1.mattbits.com
    service: http://localhost:PUERTO_1
  - hostname: avicontai.mattbits.com      # ← nuevo
    service: http://localhost:3000
  - service: http_status:404
```
Y el DNS:
```bash
cloudflared tunnel route dns <tunnel-existente> avicontai.mattbits.com
```
Reiniciás el servicio de cloudflared y listo. Si en cambio va en una máquina
nueva, seguí con el túnel propio (sección 4).

---

## 2. Preparar la máquina servidor

```bash
# Node + pnpm + Docker + cloudflared instalados
node -v && pnpm -v && docker -v && cloudflared -v

git clone git@github.com:Marco-T2/avicont-ia.git
cd avicont-ia
pnpm install --frozen-lockfile
```

---

## 3. Base de datos productiva (con backups)

```bash
docker compose up -d db
pnpm prisma migrate deploy        # aplica migraciones, NO migrate dev
```

**Backups** (obligatorio en prod) — cron diario con `pg_dump`:
```bash
# /etc/cron.d/avicont-backup  → 03:00 cada día
0 3 * * * marco docker exec avicont-db pg_dump -U avicont avicont | gzip > /home/marco/backups/avicont-$(date +\%F).sql.gz
```
Guardá los backups **fuera de la máquina** (otro disco / nube) periódicamente.

---

## 4. Variables de entorno de producción

`.env` en la máquina servidor (NUNCA commiteado), con secrets **reales**:
```bash
DATABASE_URL=postgresql://avicont:<password-fuerte>@localhost:5432/avicont
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...     # instancia PROD de Clerk
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# ...resto de keys (BLOB, GEMINI, CEREBRAS) con valores de prod
```
> `NEXT_PUBLIC_*` se hornean en el `pnpm build`. Si cambian, hay que rebuildear.

### Clerk en producción (el paso "de manera correcta")
La instancia **dev** (`pk_test`) muestra banner de "development" y tiene límites.
Para producción:
1. En el dashboard de Clerk, creá/activá la **instancia de producción**.
2. Configurá el dominio `avicontai.mattbits.com` → Clerk te da unos **CNAME**
   (clerk., accounts., etc.) que cargás en Cloudflare DNS.
3. Esperá la verificación del dominio.
4. Usá las keys `pk_live_...` / `sk_live_...` en el `.env`.

---

## 5. Build + correr la app como SERVICIO (systemd)

```bash
pnpm build        # build de producción
```

`/etc/systemd/system/avicont.service`:
```ini
[Unit]
Description=AvicontAI (Next.js prod)
After=network.target docker.service

[Service]
Type=simple
User=marco
WorkingDirectory=/home/marco/avicont-ia
EnvironmentFile=/home/marco/avicont-ia/.env
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now avicont        # arranca y se habilita al boot
sudo systemctl status avicont
```
(Alternativa más simple: `pm2 start "pnpm start" --name avicont && pm2 save && pm2 startup`.)

---

## 6. Túnel como SERVICIO (arranca solo al boot)

Si es túnel propio en esta máquina:
```bash
cloudflared tunnel login
cloudflared tunnel create avicont
cloudflared tunnel route dns avicont avicontai.mattbits.com
# config.yml en /etc/cloudflared/config.yml (ver runbook de demo)
sudo cloudflared service install         # lo instala como servicio systemd
sudo systemctl enable --now cloudflared
```
Así cloudflared levanta solo al prender la máquina — no dependés de una terminal.

---

## 7. Seguridad (lo que hace que esté "bien" desplegado)

| Tema | Estado |
|---|---|
| HTTPS | ✅ lo termina Cloudflare automáticamente |
| Headers de seguridad | ✅ ya configurados en `next.config.ts` (CSP-lite, X-Frame-Options, etc.) |
| DB expuesta | ❌ NO — solo sale el HTTP por el túnel; Postgres queda en localhost |
| Secrets | `.env` fuera del repo, permisos `600` |
| Server Actions | `allowedOrigins` con el dominio (ya configurado) |
| Gate extra (opcional) | **Cloudflare Access** (Zero Trust) delante del subdominio si querés exigir login Cloudflare antes de ver la app |
| WAF / rate-limit | el plan free de Cloudflare ya da protección básica de borde |

---

## 8. Flujo de re-deploy (cuando cambiás código)

```bash
cd /home/marco/avicont-ia
git pull
pnpm install --frozen-lockfile
pnpm prisma migrate deploy        # si hay migraciones nuevas
pnpm build
sudo systemctl restart avicont
```
Logs en vivo: `journalctl -u avicont -f`

---

## 9. Checklist "está desplegado correctamente"

- [ ] La app responde en `https://avicontai.mattbits.com` con HTTPS válido
- [ ] Podés loguear con Clerk **prod** (sin banner de development)
- [ ] Un reporte de contabilidad (Server Action) carga por el túnel
- [ ] `systemctl status avicont` y `cloudflared` = **active (running)**
- [ ] Reiniciás la máquina y **todo vuelve solo** (servicios `enabled`)
- [ ] Hay un backup de la DB del día
- [ ] El `.env` no está en git (`git status` limpio)

---

## Variante cloud (resumen)

Si preferís no administrar máquina:
1. **Postgres gestionado**: Neon / Supabase → te dan un `DATABASE_URL`.
2. **App en Vercel**: conectás el repo de GitHub; Vercel hace `build` en cada push.
3. Cargás las env vars (Clerk prod, DATABASE_URL) en el panel de Vercel.
4. `prisma migrate deploy` como build/release step.
5. Dominio: apuntás `avicontai.mattbits.com` a Vercel (CNAME) en vez del túnel.

Tradeoff: operación más simple, pero costo mensual y dependés del proveedor.
Acá NO necesitás `serverActions.allowedOrigins` porque el dominio = el host real.
