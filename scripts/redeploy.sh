#!/usr/bin/env bash
#
# redeploy.sh — rebuild + restart de la app en UN SOLO TIRO.
#
# El túnel (cloudflared) NO se toca: enruta al :3000 sin importar qué versión
# corre ahí. Solo reconstruimos la app y reiniciamos el proceso que escucha
# el puerto.
#
# Uso:
#   ./scripts/redeploy.sh          # build + restart
#   PORT=3001 ./scripts/redeploy.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"

echo "▶ 1/3  Build de producción..."
pnpm build

# ── Producción: si existe el servicio systemd 'avicont', reiniciá eso y salí ──
if systemctl list-unit-files 2>/dev/null | grep -q '^avicont\.service'; then
  echo "▶ 2/3  Reiniciando servicio systemd 'avicont'..."
  sudo systemctl restart avicont
  echo "✓ Listo (logs: journalctl -u avicont -f)"
  exit 0
fi

# ── Local/demo: liberar el puerto y relanzar en foreground ──
echo "▶ 2/3  Liberando :$PORT (instancia anterior, si hay)..."
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti ":${PORT}" | xargs -r kill 2>/dev/null || true
fi
sleep 1

echo "▶ 3/3  Levantando en :$PORT (Ctrl+C para detener; el túnel sigue apuntando acá)..."
exec pnpm start
