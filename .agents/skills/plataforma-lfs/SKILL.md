---
name: plataforma-lfs
description: Contexto, arquitectura, estado y flujo de trabajo del proyecto "Plataforma LFS" (Liga de Fútsal de Ushuaia, Argentina) — SaaS de gestión de liga en Next.js 16 + Supabase del usuario Andrés. Usar SIEMPRE que el usuario trabaje sobre este repositorio o mencione Plataforma LFS, la liga de fútsal, pasos numerados del proyecto (Paso 1, 2, ... 9B, 10...), módulos como pases/transferencias, tesorería, planillas, competencias, planteles, mensajería, o pida continuar el proyecto, generar un ZIP de archivos, una guía de instalación o analizar el avance.
---

# Plataforma LFS — Liga de Fútsal de Ushuaia

SaaS de gestión de liga de fútsal. Usuario: **Andrés** (Ushuaia, Argentina), programador principiante. Responder siempre en **español rioplatense**, tono claro y didáctico, sin jerga innecesaria.

## Datos clave del proyecto

- **Repo:** https://github.com/andressantander079-dot/Plataforma-LFS.git — rama de trabajo: `feature/31-7-inicio-de-LFS` (TODO se commitea ahí).
- **Ruta local del usuario (Windows):** `C:\Users\rocio\OneDrive\Escritorio\Andres\Plataforma LFS`
- **Stack:** Next.js 16.2.12 (Turbopack) · React 19 · TypeScript 5 · Tailwind 4 · lucide-react · Vitest 4 (`npm test` = `vitest run`) · Supabase (@supabase/ssr, RLS, storage).
- **Colores de marca:** azul marino `#1A2A44`, naranja `#F97316`. UI en español, mensajes de error amigables ("Cargá la fecha…", "Avisame y lo vemos").

## Antes de trabajar: leer referencias

1. `references/estado-y-roadmap.md` — qué está construido (paso por paso), qué es mock, qué sigue. **Actualizarlo al terminar cada paso.**
2. `references/arquitectura.md` — convenciones técnicas, trampas conocidas y cómo resolverlas (OBLIGATORIO antes de escribir código).
3. `references/base-de-datos.md` — esquema Supabase por paso, tablas, columnas, RLS, buckets y funciones SQL.

## Flujo de trabajo OBLIGATORIO (así trabaja Andrés)

1. **Restaurar el repo en el sandbox:** bajar tarball de la rama con codeload (`https://codeload.github.com/andressantander079-dot/Plataforma-LFS/tar.gz/refs/heads/feature/31-7-inicio-de-LFS`) — NO confiar en copias viejas de /tmp: **/tmp se borra entre mensajes y a veces entre llamadas**. Crear `.env.local` placeholder (ver arquitectura.md) y `npm install`.
2. **Staging persistente:** escribir/sincronizar TODOS los archivos nuevos o modificados en `/mnt/agents/output/pasoXX-staging/` (sobrevive a los wipes) apenas se escriben, nunca solo en /tmp.
3. **Verificar antes de entregar (nunca saltear):** `npx tsc --noEmit` limpio → `npm test` todo en verde → `npm run build` OK.
4. **Entregar:** ZIP desde el staging con nombre humano en español (`Plataforma LFS - Paso XX - Nombre.zip`, contenido en raíz: `src/...`, `supabase_pasoXX_*.sql`, `public/...`) + guía `Guía Paso XX - Nombre.md` en español con: requisitos previos, paso SQL en Supabase (con salida de verificación esperada), comandos robocopy, verificación con `Test-Path -LiteralPath` (para rutas con `[id]`/`[token]`), qué probar, commit/push. NUNCA incluir `.env.local` ni `node_modules` en el ZIP.
5. **SQL idempotente:** todo script con `drop ... if exists` / `create or replace` / `if not exists`, y SELECT de verificación final que el usuario compara con la guía.
6. Andrés NO sabe programar: explicar cada paso como receta, anticipar errores comunes, nunca pedirle que edite código a mano.

## Reglas de oro del proyecto

- **Nunca romper lo que ya funciona:** al reemplazar un archivo, mantener TODAS las exportaciones previas (si algo deja de usarse, wrapper `@deprecated` de compatibilidad).
- **Las reglas de negocio van en `src/lib/core/rules/`** como funciones puras + tests en `src/tests/` (imports RELATIVOS, sin alias `@/`).
- **Seguridad:** toda escritura valida rol en la server action Y en RLS; las páginas públicas usan RPCs `security definer` con datos mínimos.
- Sin excepciones de negocio "solo para el admin" salvo que Andrés lo pida explícitamente (ej.: nadie inicia pases fuera de ventana, ni la liga).
