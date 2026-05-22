# Runbook — Correr AvicontAI local + exponer con Cloudflare Tunnel

Cómo levantar el sistema en tu máquina (WSL2) y mostrarlo en internet vía
`avicontai.mattbits.com`, **sin deployar a la nube**. La DB nunca se expone:
solo sale el HTTP de la app por el túnel.

---

## Arquitectura

```
Cliente (navegador, cualquier lado)
   │  HTTPS
   ▼
Cloudflare Edge   →  https://avicontai.mattbits.com
   │  túnel SALIENTE (no se abre ningún puerto del router)
   ▼
cloudflared       →  corre en WSL2
   │  http://localhost:3000
   ▼
next start        →  modo PRODUCCIÓN (NO `next dev`), en WSL2
   │
   ▼
Postgres (Docker, local)   →  NUNCA expuesto
```

Regla de oro: **`cloudflared` y `next start` ambos dentro de WSL2** para que
`localhost:3000` se vea entre ellos. Si corrés cloudflared en Windows, tenés que
apuntar a la IP de WSL2, no a `localhost`.

---

## Por qué modo producción y NO `next dev`

| | `next dev` | `next build` + `next start` |
|---|---|---|
| Bundler | Turbopack, compila **lazy** (on-demand) | compila **TODO** al build (AOT) |
| Rutas | se registran al pegarlas → **manifest puede quedar stale** | todas desde el arranque |
| Estabilidad | frágil para una demo | sólida |
| Cambios de código | HMR (recarga sola) | requiere **re-build** |

Para mostrar el sistema usá SIEMPRE producción. El bug de "rutas dinámicas que
devuelven 404" (ver Troubleshooting #1) es exclusivo de `next dev`.

---

## Setup del túnel (una sola vez)

```bash
cloudflared tunnel login                                      # autoriza la zona mattbits.com
cloudflared tunnel create avicont                             # crea túnel + credenciales JSON
cloudflared tunnel route dns avicont avicontai.mattbits.com   # crea el CNAME proxied
```

Config en `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/marko2570/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: avicontai.mattbits.com
    service: http://localhost:3000
  - service: http_status:404        # catch-all obligatorio
```

Validar la config (no levanta nada, solo chequea):

```bash
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://avicontai.mattbits.com   # debe matchear → localhost:3000
```

---

## Arrancar el sistema (cada vez)

```bash
# 1. Base de datos
docker compose up -d db

# 2. Migraciones — deploy, NUNCA "migrate dev" en este flujo
pnpm prisma migrate deploy

# 3. Build de producción (hornea env NEXT_PUBLIC_* y serverActions.allowedOrigins)
pnpm build

# 4. Servir
pnpm start                       # http://localhost:3000

# 5. Túnel (otra terminal)
cloudflared tunnel run avicont
```

Probar de punta a punta: entrar a `https://avicontai.mattbits.com`, loguearse, y
**generar un reporte de contabilidad** (Balance General, Estado de Resultados).
Esos usan Server Actions — si cargan por el túnel, el `allowedOrigins` está OK.

---

## Configuración que el túnel exige (ya aplicada)

### `next.config.ts` — Server Actions
```ts
experimental: {
  serverActions: {
    allowedOrigins: ['avicontai.mattbits.com'],
  },
},
```
Next compara el `origin` del request contra el host para prevenir CSRF. Detrás
del túnel difieren → sin esto los Server Actions se **rechazan en silencio**.
**Cualquier cambio a `next.config.ts` requiere `pnpm build` para tomar efecto.**

### Clerk
Agregar `avicontai.mattbits.com` a los allowed origins en el dashboard de Clerk.
- Demo rápida → instancia **dev** (`pk_test`), suele andar sin trámite.
- Producción real → instancia **prod** (`pk_live`), exige dominio verificado con DNS.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` se hornea en el build (es `NEXT_PUBLIC_`).

---

## Troubleshooting — qué puede fallar

| # | Síntoma | Causa | Fix |
|---|---------|-------|-----|
| 1 | "No hay documentos pendientes" pese a que el cliente debe / rutas API dinámicas (`[id]`) dan 404 | **Solo en `next dev`**: manifest de Turbopack stale, no compila los route handlers dinámicos | Reiniciar `pnpm dev`; si persiste `rm -rf .next && pnpm dev`. En producción NO pasa |
| 2 | Reportes/forms no cargan o "fallan sin error" detrás del túnel | Falta `serverActions.allowedOrigins`, **o** tocaste `next.config.ts` y no rebuildeaste | Agregar dominio + `pnpm build` + `pnpm start` |
| 3 | Clerk no deja loguear en el dominio del túnel | Dominio no permitido / instancia mal | Agregar origin en dashboard Clerk; usar `pk_test` para demo |
| 4 | `502 Bad Gateway` en la URL pública | `next start` no está corriendo, o cloudflared no alcanza `localhost:3000` | Verificar app levantada y que **ambos** estén en WSL2 |
| 5 | Cambié código y no se refleja | Producción no tiene HMR | `pnpm build` de nuevo, reiniciar `pnpm start` |
| 6 | `prisma migrate deploy` falla | DB no levantada o `DATABASE_URL` mal | `docker compose up -d db`; verificar conexión |
| 7 | `EADDRINUSE :3000` | Puerto ocupado (el dev server u otra instancia) | Matar el proceso, o `PORT=3001 pnpm start` + ajustar ingress |
| 8 | `NEXT_PUBLIC_*` no toma el valor nuevo | Se hornean en el build | Rebuild |
| 9 | `WRN Your version ... is outdated` | cloudflared viejo | Upgrade opcional, no bloquea |
| 10 | El dominio no resuelve | Falta/no propaga el CNAME | Verificar en Cloudflare dashboard que el registro proxied exista (lo crea `route dns`) |

---

## Comandos de referencia rápida

```bash
# Levantar todo (resumen)
docker compose up -d db && pnpm prisma migrate deploy && pnpm build && pnpm start
cloudflared tunnel run avicont          # otra terminal

# Estado
docker compose ps                       # ¿DB arriba?
cloudflared tunnel list                 # ¿túnel existe?
cloudflared tunnel info avicont         # conexiones activas

# Bajar
# Ctrl+C en next start y en cloudflared
docker compose down                     # detener DB (los datos persisten en el volume)
```
