# Arquitectura y Convenciones Técnicas — Plataforma LFS

## Stack Tecnológico
- **Next.js 16.2.12 (Turbopack, App Router)**
- **React 19**
- **TypeScript 5**
- **Tailwind CSS v4**
- **Lucide React** (iconografía)
- **Vitest 4** (`npm test` = `vitest run`)
- **Supabase** (`@supabase/ssr`, PostgreSQL, Storage, RLS)

## Reglas de Oro de Arquitectura
1. **Reglas de Negocio Puras:** Se ubican en `src/lib/core/rules/` (ej: `pasesRules.ts`, `jugadoresRules.ts`, `configuracionRules.ts`). Deben ser funciones puras probadas con Vitest en `src/tests/` usando imports relativos (sin alias `@/`).
2. **Server Actions Seguras:** En `src/lib/actions/`. Cada acción verifica sesión activa y rol (`requireAdmin()` o validación por club) antes de interactuar con la base de datos.
3. **Manejo de Errores Estandarizado:** Retornar siempre `ActionResponse<T>` (`{ success: boolean, data?: T, error?: string, code?: string }`).
4. **Caché Granular en Next.js:** Consultas envueltas en `unstable_cache` con tags específicos (`league-identity`, `league-sponsors`, `league-categories-active`, etc.) y purga mediante `revalidateTag(tag, "default")` y `revalidatePath`.
5. **Colores Institucionales:**
   - Azul Marino LFS: `#1A2A44`
   - Naranja LFS: `#F97316`
   - UI en español rioplatense, mensajes didácticos y comprensibles.

## Variables de Entorno (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
*(Nota: Nunca incluir `.env.local` en zips ni repositorios públicos).*
