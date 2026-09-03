# Arquitectura y convenciones — Plataforma LFS

## Estructura del repo

```
src/
  app/
    (public)/         → fixture, posiciones, estadísticas (reales) · noticias, descargas (MOCK)
    admin/            → panel federación (dashboard y agenda MOCK; equipos, competencias,
                        tesorería, trámites, mensajería REALES; tribunal/designaciones/colegio MOCK)
    club/             → panel club (dashboard, partidos, finanzas, trámites, mensajería REALES;
                        planteles, estadísticas, configuración, descargas MOCK → Paso 10 los hace reales)
    arbitro/          → planillas y designaciones REALES; resto MOCK
    firmar-pase/[token]/ → pública, firma profesional del pase (9B)
    login/
  components/         → admin/, club/, competencias/, mensajeria/, pases/, planilla/, tesoreria/, ui/
  lib/
    actions/          → server actions ("use server" implícito por archivo): equipos, competencias,
                        planilla, tesoreria, pases, mensajeria, documentos
    core/rules/       → funciones puras testeables (categoryRules, pasesRules, jugadoresRules)
    core/competencias/→ fixture, tabla, playoff (puros)
    core/tesoreria/   → money.ts
    infrastructure/supabase/ → server.ts (createLfsServerClient), admin.ts (createLfsAdminClient
                        service-role), client.ts
    security/         → adminGuard.ts
  tests/              → vitest; IMPORTS RELATIVOS ("../lib/core/rules/..."), NO alias "@/"
  proxy.ts            → guard por rol: /admin→admin (+tesorero en /admin/tesoreria),
                        /club→club+admin, /arbitro→arbitro+admin
```

## Supabase: patrones

- **Clientes:** server component/action → `await createLfsServerClient()`; service-role (bypass RLS, solo lógica privilegiada) → `createLfsAdminClient()`.
- **Helpers SQL:** `public.is_admin()` y `public.mi_club_id()` (SECURITY DEFINER, creados en el hotfix de seguridad). Usarlos en policies.
- **RLS:** toda tabla tiene policies por rol; al agregar escritura para un rol nuevo, crear policy con `with check` (ej.: `club_id = public.mi_club_id()`).
- **Storage:** buckets con políticas por carpeta (`foldername(name)[1] = club_id`). Buckets: `documentos` (fichas jugadores), `documentos-pases` (privado; subcarpeta `firma/`), `fotos-jugadores` (PÚBLICO, 5MB, carpeta = club_id, desde 9B), `comprobantes` (tesorería).
- **RPCs públicos** (`security definer`, datos mínimos): `obtener_pase_firma(p_token)`, `firmar_pase_9b(...)`, `rechazar_pase_jugador(...)`, `pases_publicos()`, `club_actualizar_jugador(...)`.
- **Notificaciones internas:** mensajería (Paso 5); se notifica best-effort con el admin client.

## Trampas conocidas (YA resueltas — no repetir el error)

1. **supabase-js SIN tipos Database:** las props de filas pueden ser `unknown` → cadenas JSX `&&` con operandos unknown rompen tsc ("Type 'unknown' is not assignable to type 'ReactNode'"). Solución: normalizar a consts tipadas antes del JSX o usar `!!`.
2. **Vitest no tiene alias `@/`:** imports relativos en tests.
3. **Next 16:** `params` y `searchParams` son `Promise<...>` → `await`.
4. **/tmp se borra** entre mensajes e incluso entre tool calls → staging en `/mnt/agents/output/` SIEMPRE.
5. **No romper exports:** al reescribir un archivo, conservar todas las exportaciones (wrapper `@deprecated` si aplica). Ej.: `firmarPasePublico` quedó como wrapper que llama al RPC viejo `firmar_pase`.
6. **`cargo_pase_uniq`:** unique index en `treasury_charges(transfer_id)` → solo UN cargo puede llevar `transfer_id`; cargos asociados al pase pero secundarios (deuda modo cobrar) NO lo setean.
7. **`transfer_status` es ENUM Postgres:** no agregar valores; reusar existentes + `metadata` jsonb (ej.: rechazo del jugador = `8_RECHAZADO` + `metadata.rechazado_por='jugador'`).
8. **pg_cron puede no existir** en el plan del usuario → envolver `cron.schedule` en DO con exception handler + autocuración: `procesarAutomaticosPases()` se llama al cargar páginas de Trámites.
9. **`.env.local` placeholder para compilar en sandbox:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
   SUPABASE_SERVICE_ROLE_KEY=placeholder-service-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   Borrarlo antes de empaquetar (nunca va al ZIP).

## Estilo de código

- Comentarios de cabecera en español explicando QUÉ hace el archivo en lenguaje de negocio.
- Server actions con validación de rol al inicio (`requireAdmin...`, `requireClub...`) y mensajes de error en español rioplatense, accionables.
- Componentes cliente con `useTransition` para acciones, `Loader2` de lucide, confirmaciones con `window.confirm` para acciones destructivas.
- Clases Tailwind con los colores de marca; inputs: `rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60`.
