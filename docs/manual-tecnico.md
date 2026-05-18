---
title: "Manual Técnico"
subtitle: "Sistema de Información Contable — Asociación Mixta de Productores Agro-Avícola Conda Arriba"
author: "Equipo de desarrollo"
date: "2026"
lang: es
toc: true
toc-depth: 3
numbersections: true
geometry: margin=2.5cm
fontsize: 11pt
documentclass: report
---

\newpage

# Prólogo

## Propósito

Este documento describe los aspectos técnicos del **Sistema de Información Contable** desarrollado para la **Asociación Mixta de Productores Agro-Avícola Conda Arriba**. Su objetivo es proporcionar al administrador de sistemas, al desarrollador encargado del mantenimiento y al responsable de despliegue toda la información necesaria para:

- Instalar el sistema desde cero en un entorno nuevo.
- Configurar los servicios externos requeridos (autenticación, almacenamiento, IA).
- Desplegar el sistema a un entorno productivo.
- Realizar tareas de mantenimiento (backups, actualizaciones, monitoreo).
- Diagnosticar y resolver problemas comunes.

## Audiencia

Este manual asume conocimientos básicos de:

- Sistemas operativos Linux y línea de comandos.
- Bases de datos relacionales (PostgreSQL).
- Gestión de paquetes Node.js (npm/pnpm).
- Conceptos de despliegue web (variables de entorno, DNS, HTTPS).
- Git para gestión de código fuente.

No es un manual de uso operativo del sistema; para eso, consulte el **Manual de Usuario** (`manual-usuario.docx`).

## Convenciones

| Notación | Significa |
|---|---|
| `código` | Comando, ruta o nombre de variable. |
| **Negrita** | Nombre de servicio o componente. |
| ⚠️ | Operación crítica o irreversible. |
| 💡 | Buena práctica o sugerencia. |
| `[completar]` | Valor a definir por el equipo durante la implementación. |

\newpage

# Arquitectura general

## Stack tecnológico

El sistema está construido sobre las siguientes tecnologías. Las versiones exactas se mantienen pinned en `package.json`.

| Componente | Tecnología | Versión actual | Rol |
|---|---|---|---|
| Lenguaje | TypeScript | 5.9.3 | Tipado estático. |
| Framework | Next.js | 16.2.1 | App Router, Server Components, API routes. |
| UI | React | 19.2.4 | Componentes cliente. |
| Estilos | Tailwind CSS | 4 | Utility-first CSS. |
| Componentes | shadcn / Radix UI | 4.1.0 | Biblioteca de componentes accesibles. |
| Íconos | Lucide React | 1.0.1 | Set de íconos SVG. |
| Base de datos | PostgreSQL + pgvector | 17 + último | Persistencia + embeddings RAG. |
| ORM | Prisma | 7.5.0 | Acceso a datos. |
| Autenticación | Clerk | 7.0.7 | Login, sesiones, multi-organización. |
| Almacenamiento | Vercel Blob | 2.3.1 | Archivos binarios (logos). |
| IA — primario | Google Gemini | (latest) | Asistente conversacional. |
| IA — alternativo | Cerebras | (latest) | Procesamiento contable asistido. |
| Cálculo monetario | decimal.js | 10.6.0 | Precisión decimal exacta. |
| Exportación PDF | pdfmake / pdfjs-dist | 0.3.7 / 5.6.205 | Generación e indexación. |
| Exportación Excel | exceljs | 4.4.0 | Generación de reportes XLSX. |
| Validación | Zod | 4.3.6 | Schemas de runtime. |
| Tests | Vitest | 4.1.4 | Runner de pruebas. |
| Linter | ESLint | 9 | Validación de estilo. |
| Package manager | pnpm | 10.24.0 | Gestión de dependencias (obligatorio). |

## Modelo lógico de componentes

```
                  ┌─────────────────────────────┐
                  │       Navegador (cliente)    │
                  │   React + shadcn + Tailwind  │
                  └──────────────┬──────────────┘
                                 │  HTTPS
                                 ▼
┌──────────────────────────────────────────────────────────┐
│                Aplicación Next.js                         │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐   │
│   │  App Router  │  │   API Routes │  │ Middleware  │   │
│   │  (RSC + UI)  │  │  (handlers)  │  │   (Clerk)   │   │
│   └──────┬───────┘  └──────┬───────┘  └──────┬──────┘   │
└──────────┼─────────────────┼──────────────────┼─────────┘
           │                 │                  │
           ▼                 ▼                  ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │  PostgreSQL  │  │  Vercel Blob │  │     Clerk    │
   │  + pgvector  │  │  (archivos)  │  │    (auth)    │
   └──────────────┘  └──────────────┘  └──────────────┘
           │
           ▼
   ┌──────────────┐
   │   Gemini /   │
   │   Cerebras   │
   │     (IA)     │
   └──────────────┘
```

## Características arquitectónicas

- **Multi-tenant**: cada organización (`Organization`) tiene su propio plan de cuentas, períodos, asientos y datos. Los datos se aíslan por `organizationId` en todas las consultas.
- **RBAC** (Role-Based Access Control): los permisos se gestionan mediante roles del sistema (administrador, contador, operador, granjero, observador) más roles personalizados.
- **Server Components** (Next.js App Router): la mayoría del renderizado ocurre en el servidor; el cliente recibe HTML pre-renderizado y solo hidrata componentes interactivos.
- **Decimal.js** para todos los cálculos monetarios: evita los errores de precisión flotante de JavaScript.
- **pgvector** para embeddings: el módulo RAG almacena vectores de 768 dimensiones en PostgreSQL para búsqueda semántica.

\newpage

# Requisitos del entorno

## Sistema operativo

El sistema es agnóstico al sistema operativo del servidor. Las opciones validadas son:

| Entorno | Estado |
|---|---|
| Linux (Ubuntu 22.04+, Debian 12+) | Recomendado para producción. |
| macOS (13+) | Soportado para desarrollo. |
| Windows con WSL2 | Soportado para desarrollo. |
| Windows nativo | No probado; se recomienda WSL2. |

## Software prerrequisito

| Software | Versión mínima | Notas de instalación |
|---|---|---|
| Node.js | 18.18.0 | Requerido por Next.js 16. Recomendado: usar `nvm` o `volta`. |
| pnpm | 10.0.0 | **Obligatorio**: el proyecto declara `packageManager: pnpm@10.24.0` y no funciona con npm/yarn directamente. Instalación: `npm install -g pnpm`. |
| PostgreSQL | 15.0 | Requerido por la extensión pgvector. Recomendado: PostgreSQL 17. |
| pgvector | última | Extensión obligatoria para el módulo RAG. |
| Docker + Docker Compose | 24+ / 2.20+ | Recomendado para desarrollo local (levanta BD y herramientas de admin). |
| Git | 2.30+ | Para clonar y mantener el repositorio. |

## Cuentas en servicios externos

El sistema depende de cuatro servicios externos. Antes de instalar, asegúrese de tener credenciales válidas para cada uno:

| Servicio | Para qué | Cómo obtener |
|---|---|---|
| **Clerk** | Autenticación, gestión de usuarios y organizaciones. | Crear cuenta en `clerk.com` → nueva aplicación tipo Next.js. |
| **Vercel Blob** | Almacenamiento de logos y archivos binarios. | Crear cuenta en `vercel.com` → habilitar Storage → Blob → generar token. |
| **Google Gemini** | Asistente de IA principal. | `aistudio.google.com` → API key. |
| **Cerebras** | IA alternativa para tareas contables. | `cloud.cerebras.ai` → API key. |

> 💡 Los servicios IA (Gemini y Cerebras) son opcionales en entornos donde el asistente no es prioritario; el resto del sistema funciona sin ellos, pero el módulo de IA quedará deshabilitado.

## Recursos de hardware (servidor productivo)

Valores orientativos para una organización de hasta 50 usuarios activos:

| Recurso | Mínimo | Recomendado |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disco | 20 GB SSD | 50 GB SSD |
| Ancho de banda | 100 Mbps | 1 Gbps |

\newpage

# Instalación

Este capítulo describe la instalación paso a paso desde cero. Asume un servidor Linux con los prerrequisitos del capítulo anterior instalados.

## Resumen de pasos

1. Clonar el repositorio.
2. Instalar dependencias.
3. Configurar variables de entorno.
4. Levantar la base de datos.
5. Aplicar migraciones.
6. Ejecutar seeds.
7. Arrancar el servidor de desarrollo (verificación).

## Paso 1 — Clonar el repositorio

```bash
git clone [URL del repositorio]
cd avicont-ia
```

> 💡 La URL del repositorio depende de dónde esté hospedado el código (GitHub, GitLab, repositorio interno). Consultar con el equipo de desarrollo.

## Paso 2 — Instalar dependencias

```bash
pnpm install
```

Este comando descarga e instala todas las dependencias listadas en `package.json` (≈ 300 paquetes). Genera el cliente de Prisma automáticamente en el postinstall.

⚠️ **No utilizar `npm install` ni `yarn install`**. El proyecto declara `pnpm` como package manager obligatorio y los lockfiles son incompatibles.

## Paso 3 — Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto a partir de la plantilla:

```bash
cp .env.example .env
```

Editar `.env` y completar con valores reales. El capítulo siguiente detalla cada variable.

## Paso 4 — Levantar la base de datos

### Opción A — Docker (recomendado para desarrollo)

```bash
docker compose up -d
```

Este comando levanta dos contenedores:

- `db`: PostgreSQL 17 con extensión pgvector preinstalada. Puerto: **5432**. Credenciales por defecto: usuario `avicont`, contraseña `avicont`, base `avicont`.
- `dbgate`: interfaz web para administrar la base. Puerto: **3010**. Acceso: `http://localhost:3010`.

Verificar que ambos servicios están saludables:

```bash
docker compose ps
```

### Opción B — PostgreSQL externo

Si ya cuenta con una instancia de PostgreSQL:

1. Crear una base de datos vacía.
2. Crear un usuario con privilegios sobre esa base.
3. Habilitar la extensión pgvector:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

4. Actualizar `DATABASE_URL` en `.env` con la cadena de conexión.

## Paso 5 — Aplicar migraciones

```bash
pnpm prisma migrate deploy
```

Este comando aplica las 54 migraciones existentes en `prisma/migrations/`, creando todas las tablas, índices y constraints del esquema.

> 💡 Para desarrollo iterativo se usa `pnpm prisma migrate dev`, que además genera el cliente. En producción se usa `migrate deploy` que no genera prompts interactivos.

## Paso 6 — Ejecutar seeds

El sistema requiere dos seeds para quedar operativo:

### 6.1 Roles del sistema

```bash
pnpm seed:system-roles
```

Crea los cinco roles base por cada organización registrada (administrador, contador, operador, granjero, observador) y mapea los permisos. Es idempotente: puede ejecutarse múltiples veces sin efectos colaterales.

### 6.2 Datos por organización

```bash
pnpm seed:org [ID_DE_LA_ORGANIZACIÓN]
```

Crea el plan de cuentas y los tipos de comprobante para la organización indicada. Requiere conocer el `organizationId` (valor que se obtiene tras crear la organización en Clerk y que queda registrado en la tabla `organizations`).

> ⚠️ Este seed debe ejecutarse **una vez por cada organización nueva**.

## Paso 7 — Arrancar el servidor

```bash
pnpm dev
```

El servidor de desarrollo levanta en `http://localhost:3000` con hot reload. Si necesita exponerlo en otro puerto:

```bash
pnpm dev -- --port 4000
```

## Verificación de la instalación

Una vez arrancado el servidor:

1. Abrir `http://localhost:3000` en un navegador.
2. Debería ver la pantalla de login de Clerk.
3. Crear una cuenta de prueba (o usar una existente).
4. Tras autenticarse, debería ver la pantalla de selección de organización.

Si los tres puntos funcionan, la instalación está completa.

\newpage

# Variables de entorno

El sistema utiliza variables de entorno para toda configuración sensible o dependiente del entorno. **Nunca commitear archivos `.env` con valores reales al repositorio.**

## Tabla completa de variables

### Base de datos

| Variable | Obligatoria | Formato | Notas |
|---|---|---|---|
| `DATABASE_URL` | Sí | `postgresql://usuario:password@host:puerto/basedatos?schema=public` | Cadena de conexión PostgreSQL. Usar el prefijo `postgresql://` (no `postgres://`). Para producción, agregar `?sslmode=require`. |

### Autenticación (Clerk)

| Variable | Obligatoria | Visibilidad | Notas |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Sí | Pública (cliente) | Empieza con `pk_test_` (sandbox) o `pk_live_` (producción). Se obtiene del dashboard de Clerk. |
| `CLERK_SECRET_KEY` | Sí | Privada (servidor) | Empieza con `sk_test_` o `sk_live_`. **No exponer en frontend bajo ninguna circunstancia.** |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | Pública | Ruta de la página de login. Por defecto: `/sign-in`. |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | No | Pública | Ruta de la página de registro. Por defecto: `/sign-up`. |

### Almacenamiento (Vercel Blob)

| Variable | Obligatoria | Notas |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Sí en producción | Token de lectura/escritura sobre el bucket de Vercel Blob. Empieza con `vercel_blob_rw_...`. Se obtiene del dashboard de Vercel → Storage. |

### IA (proveedores externos)

| Variable | Obligatoria | Notas |
|---|---|---|
| `GEMINI_API_KEY` | Sí si se usa IA | API key de Google AI Studio. Empieza con `AIzaSy...`. |
| `CEREBRAS_API_KEY` | Sí si se usa IA | API key de Cerebras Cloud. Empieza con `csk-...`. |

## Plantilla de `.env.example`

```ini
# Base de datos
DATABASE_URL="postgresql://avicont:avicont@localhost:5432/avicont?schema=public"

# Clerk (autenticación)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Vercel Blob (almacenamiento)
BLOB_READ_WRITE_TOKEN=

# IA — Google Gemini
GEMINI_API_KEY=

# IA — Cerebras
CEREBRAS_API_KEY=
```

## Buenas prácticas

- ⚠️ **Nunca** commitear el archivo `.env` real al repositorio. Verificar que `.env` esté listado en `.gitignore`.
- Mantener actualizado el archivo `.env.example` cada vez que se agregue una variable nueva.
- En producción, usar el sistema de gestión de secretos del proveedor (Vercel Environment Variables, AWS Secrets Manager, etc.) en lugar de un archivo `.env` físico.
- Generar credenciales distintas para desarrollo y producción.

\newpage

# Base de datos

## Visión general

El sistema utiliza PostgreSQL con la extensión **pgvector** como única base de datos. Se gestiona mediante el ORM **Prisma** con el adaptador `@prisma/adapter-pg`.

El esquema completo está definido en `prisma/schema.prisma` y contiene aproximadamente **52 modelos**.

## Modelos por dominio

| Dominio | Modelos representativos | Función |
|---|---|---|
| **Core / multi-tenant** | `User`, `Organization`, `OrganizationMember`, `CustomRole` | Multi-tenant, RBAC. |
| **Contabilidad** | `Account`, `JournalEntry`, `JournalLine`, `FiscalPeriod`, `FiscalYear`, `VoucherTypeCfg`, `AccountBalance` | Plan de cuentas, asientos, períodos. |
| **Operacional** | `Sale`, `SaleDetail`, `Purchase`, `PurchaseDetail`, `Dispatch`, `DispatchDetail`, `Payment`, `PaymentAllocation` | Documentos comerciales. |
| **Avícola** | `ChickenLot`, `Expense`, `MortalityLog` | Lotes, gastos asociados, mortalidad. |
| **Tesorería** | `Contact`, `AccountsReceivable`, `AccountsPayable`, `OrgSettings`, `OrgProfile` | Contactos, saldos, configuración. |
| **RAG / Documentos** | `Document`, `DocumentChunk`, `DocumentTag`, `Tag`, `DocumentSignatureConfig` | Almacenamiento vectorial, metadatos. |
| **Auditoría** | `AuditLog` | Trazabilidad de cambios. |
| **Control de uso** | `AgentRateLimit`, `ChatMessage` | Rate limiting del agente IA, historial de chat. |

## Migraciones

Las migraciones residen en `prisma/migrations/` y se aplican secuencialmente. Al momento de redactar este manual existen **54 migraciones**, desde la inicial (`20260324012608_init`) hasta el último índice de performance (`20260518144204_add_journalline_contactid_index`).

### Comandos relevantes

```bash
# Aplicar migraciones pendientes (producción)
pnpm prisma migrate deploy

# Crear una migración nueva (desarrollo)
pnpm prisma migrate dev --name nombre_descriptivo

# Inspeccionar estado actual
pnpm prisma migrate status

# Generar el cliente Prisma manualmente
pnpm prisma generate
```

### Reglas de oro

- ⚠️ **Nunca** editar una migración ya aplicada en producción. Crear una nueva migración que ajuste el cambio.
- ⚠️ **Nunca** usar `prisma migrate reset` en producción: borra todos los datos.
- Verificar siempre `migrate status` antes de un despliegue para detectar migraciones pendientes.

## Extensión pgvector

El módulo RAG (Retrieval-Augmented Generation) almacena vectores de embeddings de **768 dimensiones** en el campo `embedding` de la tabla `document_chunks`.

### Instalación

En Docker Compose, la extensión se crea automáticamente al inicializar el volumen, mediante el script `docker/initdb/01-pgvector.sql`.

En PostgreSQL externo, ejecutar manualmente:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Validación

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

Debe retornar una fila.

## Seeds

| Script | Comando | Para qué |
|---|---|---|
| Roles del sistema | `pnpm seed:system-roles` | Crea los 5 roles base por cada organización. Idempotente. |
| Catálogos por organización | `pnpm seed:org [orgId]` | Crea plan de cuentas y tipos de comprobante para una organización. Ejecutar una vez por organización nueva. |

## Acceso administrativo a la base

En desarrollo, el contenedor `dbgate` ofrece una interfaz web en `http://localhost:3010`.

En producción, usar `psql` o cualquier cliente PostgreSQL (DBeaver, TablePlus, pgAdmin) con las credenciales de `DATABASE_URL`.

\newpage

# Configuración de servicios externos

## Clerk (autenticación)

### Pasos en el dashboard de Clerk

1. Iniciar sesión en `clerk.com` con la cuenta institucional.
2. Pulsar **Create Application**.
3. Elegir tipo **Next.js**.
4. Configurar nombre, logo y dominios permitidos.
5. En **API Keys**, copiar:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` del `.env`.
   - **Secret key** → `CLERK_SECRET_KEY` del `.env`.
6. En **Configure → Organizations**, **habilitar la funcionalidad de organizaciones**. El sistema requiere multi-tenant.
7. Configurar los **identificadores** habilitados:
   - Correo electrónico + contraseña (mínimo).
   - Opcionalmente: Google, Microsoft (login social).
   - Opcionalmente: enlace mágico al correo.
8. Configurar la página de redirección post-login: `/select-org`.

### URLs requeridas en Clerk

| Tipo | Valor sugerido |
|---|---|
| Sign-in URL | `/sign-in` |
| Sign-up URL | `/sign-up` |
| Después de sign-in | `/select-org` |
| Después de sign-out | `/sign-in` |

### Sincronización de organizaciones

Actualmente el sistema **no implementa webhooks de Clerk**. La sincronización entre Clerk (organizaciones, miembros) y la base de datos local se realiza manualmente mediante el script:

```bash
pnpm tsx scripts/sync-org.ts [organizationId]
```

> 💡 Si se desea sincronización automática en tiempo real, implementar endpoints de webhook en `app/api/webhooks/clerk/` siguiendo la documentación oficial de Clerk.

## Vercel Blob (almacenamiento)

### Pasos

1. En el dashboard de Vercel, ir a **Storage → Create Database**.
2. Elegir **Blob**.
3. Asignar nombre al store y región (preferentemente cercana al servidor productivo).
4. En **Settings → Tokens**, generar un token **Read & Write**.
5. Copiar el valor al `.env` como `BLOB_READ_WRITE_TOKEN`.

### Uso en el sistema

El sistema utiliza Vercel Blob para:

- Logos de organización (subidos desde Configuración → Perfil de Empresa).

Restricciones aplicadas por la aplicación:

| Restricción | Valor |
|---|---|
| Tipos MIME permitidos | `image/png`, `image/jpeg`, `image/webp` |
| Tamaño máximo | ≈ 2 MB |
| Ruta interna | `organizations/{orgId}/logo/{filename}` |

> 💡 Los documentos del módulo RAG **no** se almacenan en Vercel Blob; sus metadatos están en PostgreSQL y los embeddings en pgvector.

## Google Gemini

1. Acceder a `aistudio.google.com`.
2. Iniciar sesión con la cuenta institucional de Google.
3. **Create API Key** → copiar el valor.
4. Pegarlo en `.env` como `GEMINI_API_KEY`.

> 💡 Google Gemini ofrece una capa gratuita generosa. Para producción, monitorear el consumo y considerar plan de pago si se supera el límite.

## Cerebras

1. Crear cuenta en `cloud.cerebras.ai`.
2. En **API Keys**, generar una clave nueva.
3. Pegarla en `.env` como `CEREBRAS_API_KEY`.

\newpage

# Build y despliegue

## Build local

```bash
pnpm build
```

Compila la aplicación para producción. Genera la carpeta `.next/` con los assets optimizados.

Para servir el build localmente:

```bash
pnpm start
```

Arranca un servidor de producción en `http://localhost:3000`.

## Despliegue en Vercel (recomendado)

Vercel es el proveedor recomendado: ofrece integración nativa con Next.js, Clerk y Vercel Blob, además de HTTPS automático y escalado transparente.

### Pasos

1. Crear cuenta en `vercel.com`.
2. **Import Project** → conectar con el repositorio (GitHub, GitLab, Bitbucket).
3. Configurar el **Framework Preset**: Next.js (autodetectado).
4. En **Environment Variables**, agregar todas las variables del `.env` (capítulo 5).
5. Pulsar **Deploy**.

Vercel construye y despliega automáticamente. En despliegues sucesivos, cada `git push` a la rama configurada dispara un nuevo deploy.

### Configuración recomendada en Vercel

| Setting | Valor |
|---|---|
| Build Command | `pnpm build` |
| Install Command | `pnpm install --frozen-lockfile` |
| Output Directory | `.next` (autodetectado) |
| Node.js Version | 20.x |

## Despliegue alternativo (Docker, Railway, Fly.io)

El sistema no incluye un `Dockerfile` específico para producción, pero es trivial construir uno basado en `node:20-alpine`.

### Ejemplo de Dockerfile productivo

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["pnpm", "start"]
```

> 💡 En despliegues fuera de Vercel será necesario contratar PostgreSQL externo (AWS RDS, Supabase, Neon) y mantener el token de Vercel Blob (o sustituirlo por otra solución de storage como AWS S3 + cambio en el código).

## Migraciones en despliegue

El comando `pnpm prisma migrate deploy` debe ejecutarse **antes** de iniciar la aplicación cada vez que haya migraciones nuevas. En Vercel, esto se configura como **Build Command compuesto**:

```bash
pnpm prisma migrate deploy && pnpm build
```

\newpage

# Operación y mantenimiento

## Backups

### Estrategia recomendada

| Componente | Frecuencia | Método |
|---|---|---|
| Base de datos | Diaria | `pg_dump` + almacenamiento externo. |
| Archivos en Vercel Blob | Continua | Replicación nativa de Vercel (3 copias en distintas zonas). |
| Variables de entorno | Al cambiar | Backup manual a gestor de secretos (1Password, Bitwarden, Vault). |
| Código fuente | Continua | Git (repositorio remoto). |

### Backup manual de la base de datos

```bash
pg_dump -U avicont -h localhost avicont > avicont_$(date +%Y%m%d_%H%M%S).sql
```

En Docker:

```bash
docker compose exec db pg_dump -U avicont avicont > backup_$(date +%Y%m%d).sql
```

### Backup automatizado con cron

Ejemplo de cron diario a las 02:00:

```cron
0 2 * * * pg_dump -U avicont -h localhost avicont | gzip > /backups/avicont_$(date +\%Y\%m\%d).sql.gz && find /backups -name "avicont_*.sql.gz" -mtime +30 -delete
```

> 💡 Almacenar los backups fuera del servidor de aplicación (S3, Backblaze, NAS). Un backup en el mismo disco no protege contra fallas físicas.

## Restore

### Restore completo

```bash
psql -U avicont -h localhost -d avicont < backup_20260518.sql
```

En Docker:

```bash
docker compose exec -T db psql -U avicont avicont < backup_20260518.sql
```

⚠️ **El restore borra y reemplaza los datos existentes.** Antes de restaurar en producción:

1. Confirmar por escrito con el responsable del sistema.
2. Hacer un backup adicional del estado actual antes de restaurar.
3. Probar el restore en un entorno de staging cuando sea posible.

## Logs

### Estado actual

El sistema **no integra** un servicio externo de logs (Sentry, Datadog, New Relic) en su estado actual. La salida estándar (`console.log`, `console.error`) se captura según el entorno:

| Entorno | Dónde ver los logs |
|---|---|
| Desarrollo (`pnpm dev`) | Terminal donde se ejecutó el comando. |
| Producción Vercel | `vercel logs [deployment-url]` o dashboard web. |
| Producción Docker | `docker compose logs -f app`. |

### Recomendaciones

- Para producción se sugiere integrar **Sentry** (capa gratuita disponible para organizaciones sin fines de lucro) para captura de errores.
- Para métricas de rendimiento, considerar **Vercel Analytics** o **Datadog APM**.
- Estructurar los logs con un logger como `pino` o `winston` facilita el parseo posterior.

## Actualización del sistema

Cuando el equipo de desarrollo publique una versión nueva:

1. Pull del código actualizado.

   ```bash
   git pull origin main
   ```

2. Instalar dependencias nuevas (si las hay).

   ```bash
   pnpm install
   ```

3. Aplicar migraciones nuevas.

   ```bash
   pnpm prisma migrate deploy
   ```

4. Re-construir y reiniciar.

   ```bash
   pnpm build
   pnpm start
   ```

   En Vercel, esto ocurre automáticamente con cada `git push`.

5. Verificar que el sistema responde correctamente con una prueba humo (login + un par de operaciones críticas).

> ⚠️ Antes de actualizar producción, hacer **backup** y validar la actualización en staging.

\newpage

# Testing y calidad

## Suite de tests

El sistema usa **Vitest** como runner. Los tests viven en directorios `__tests__/` cercanos al código que prueban.

### Comandos

```bash
# Correr toda la suite una vez
pnpm test

# Correr en modo watch (desarrollo)
pnpm exec vitest

# Correr un archivo específico
pnpm exec vitest path/to/file.test.ts

# Correr con coverage
pnpm exec vitest --coverage
```

### Configuración

El archivo `vitest.config.ts` define dos entornos:

| Entorno | Patrón | Para qué |
|---|---|---|
| `node` | `**/__tests__/**/*.test.ts` | Lógica de dominio (cálculos, validaciones, etc.). |
| `jsdom` | `components/**/__tests__/**/*.test.tsx` | Componentes React (con `@testing-library/react`). |

La variable `TZ=America/La_Paz` se fija en la configuración para que los tests de fecha usen la zona horaria de Bolivia (UTC-4).

## Linting

```bash
pnpm lint
```

Ejecuta ESLint 9 con la configuración Next.js. Las reglas viven en `eslint.config.mjs`.

## Convenciones de calidad

- ⚠️ **Antes de cada commit**: el código debe pasar `pnpm test` y `pnpm lint` sin errores.
- Para cambios contables o de cálculos monetarios, los tests son obligatorios.
- Las migraciones de Prisma deben venir acompañadas de un nombre descriptivo (`pnpm prisma migrate dev --name descripcion_clara`).

\newpage

# Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `pnpm install` falla con error de lockfile | Versión incorrecta de pnpm. | Verificar `pnpm --version`; instalar la versión declarada en `package.json` (`packageManager` field). |
| `Cannot find module '@prisma/client'` | El cliente Prisma no se generó. | Ejecutar `pnpm prisma generate`. |
| `relation "..." does not exist` al arrancar | Faltan migraciones. | Correr `pnpm prisma migrate deploy`. |
| `extension "vector" is not available` | pgvector no instalado en la BD. | Conectarse a la BD y ejecutar `CREATE EXTENSION IF NOT EXISTS vector;`. |
| Login muestra pantalla en blanco | Variables de Clerk mal configuradas. | Verificar que `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY` correspondan a la misma aplicación de Clerk. |
| Selección de organización vacía | Falta sincronización Clerk ↔ BD local. | Ejecutar `pnpm tsx scripts/sync-org.ts [orgId]`. |
| Subida de logo falla con 401 | Token de Vercel Blob inválido. | Regenerar el token en Vercel Dashboard y actualizar `BLOB_READ_WRITE_TOKEN`. |
| Asistente IA no responde | API key de Gemini/Cerebras vencida o sin cuota. | Verificar las claves y el consumo en los respectivos dashboards. |
| `Error: getaddrinfo ENOTFOUND db` (Docker) | El contenedor `db` no está corriendo. | Ejecutar `docker compose up -d` y verificar `docker compose ps`. |
| Tests fallan por zona horaria | El runner no aplicó `TZ=America/La_Paz`. | Verificar `vitest.config.ts`; ejecutar `TZ=America/La_Paz pnpm test`. |
| El build falla en Vercel por memoria | Build excede el límite de RAM del plan. | Subir el plan de Vercel o ajustar `NODE_OPTIONS=--max-old-space-size=4096`. |

\newpage

# Anexos

## Anexo A — Archivos de configuración

| Archivo | Para qué |
|---|---|
| `package.json` | Dependencias, scripts y `packageManager` obligatorio. |
| `pnpm-lock.yaml` | Lockfile de dependencias. **Commitear siempre.** |
| `tsconfig.json` | Configuración de TypeScript. Alias `@/*` apunta a la raíz. |
| `next.config.ts` | Configuración de Next.js. Incluye headers de seguridad OWASP y redirects de compatibilidad. |
| `eslint.config.mjs` | Reglas de ESLint 9 (flat config). |
| `vitest.config.ts` | Configuración de Vitest (entornos `node` y `jsdom`, zona horaria). |
| `prisma/schema.prisma` | Esquema de la base de datos. |
| `prisma.config.ts` | Configuración del cliente Prisma. |
| `proxy.ts` | Configuración del proxy de desarrollo (si aplica). |
| `docker-compose.yml` | Servicios de desarrollo local (Postgres + dbgate). |
| `docker/initdb/` | Scripts de inicialización de la BD en Docker (pgvector). |
| `components.json` | Configuración de shadcn. |
| `postcss.config.mjs` | Configuración de PostCSS (Tailwind). |
| `knip.json` | Configuración de Knip (detector de código muerto). |
| `.env.example` | Plantilla de variables de entorno. |

## Anexo B — Estructura de carpetas

```
avicont-ia/
├── app/                       # Next.js App Router
│   ├── (auth)/                # Rutas de autenticación (sign-in, sign-up)
│   ├── (dashboard)/           # Rutas autenticadas
│   │   ├── [orgSlug]/         # Rutas por organización
│   │   └── select-org/        # Selección de organización
│   ├── api/                   # API routes
│   └── layout.tsx             # Layout raíz (Clerk Provider)
├── components/                # Componentes React reutilizables
│   ├── sidebar/               # Sidebar principal
│   └── ui/                    # Componentes shadcn
├── features/                  # Lógica de dominio (hexágonos)
├── modules/                   # Módulos de negocio
├── lib/                       # Utilidades compartidas
├── prisma/
│   ├── schema.prisma          # Esquema de la BD
│   ├── migrations/            # Migraciones (54 al momento)
│   ├── seed.ts                # Seed de organización
│   └── seed-system-roles.ts   # Seed de roles
├── scripts/                   # Scripts administrativos
├── docs/                      # Documentación (manuales, ADRs, arquitectura)
├── public/                    # Assets estáticos
├── __tests__/                 # Tests globales
├── docker/                    # Configuración Docker
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
└── .env.example
```

## Anexo C — Comandos de uso frecuente

```bash
# Desarrollo
pnpm install                       # Instalar dependencias
pnpm dev                           # Arrancar dev server (puerto 3000)
pnpm build                         # Compilar para producción
pnpm start                         # Servir build de producción
pnpm lint                          # Linter
pnpm test                          # Tests

# Base de datos
docker compose up -d               # Levantar BD + dbgate (desarrollo)
pnpm prisma migrate deploy         # Aplicar migraciones (producción)
pnpm prisma migrate dev --name X   # Crear nueva migración (desarrollo)
pnpm prisma generate               # Regenerar cliente Prisma
pnpm prisma studio                 # UI web de Prisma para inspeccionar datos

# Seeds
pnpm seed:system-roles             # Crear roles del sistema
pnpm seed:org [orgId]              # Crear plan de cuentas y voucher types

# Scripts administrativos
pnpm tsx scripts/sync-org.ts [id]  # Sincronizar org con Clerk
pnpm tsx scripts/seed-audit-fixtures.ts   # Datos de prueba de auditoría

# Backups
pg_dump -U avicont -h localhost avicont > backup.sql
docker compose exec db pg_dump -U avicont avicont > backup.sql
```

## Anexo D — Contacto y soporte

Para incidentes técnicos, solicitudes de cambio o consultas sobre operación:

- **Equipo de desarrollo**: `[completar correo]`
- **Repositorio del código**: `[completar URL]`
- **Sistema de tickets**: `[completar plataforma — Jira, Linear, GitHub Issues, etc.]`
- **Horario de soporte**: `[completar]`

### Información a incluir en un reporte técnico

1. Descripción del problema y pasos para reproducirlo.
2. Versión del sistema (`git rev-parse HEAD`).
3. Variables de entorno (sin valores reales) que estén configuradas.
4. Logs relevantes del momento del incidente.
5. Capturas de pantalla cuando apliquen.

---

*Fin del Manual Técnico — Sistema de Información Contable.*
*Asociación Mixta de Productores Agro-Avícola Conda Arriba.*
