# Estado del proyecto y roadmap — Plataforma LFS

> **ACTUALIZAR ESTE ARCHIVO AL TERMINAR CADA PASO** (fecha, qué se entregó, qué quedó pendiente).

Última actualización: 2026-09-03 (Paso 10B entregado).
Último commit visto: `de85c159` — "Paso 9B Parte 1…" (2026-08-23). (Después el usuario commiteó Pasos 10 y 10B desde su PC.)
Avance estimado para lanzar: **~80%**.

## Pasos entregados (todos verificados: tsc + tests + build)

| Paso | Contenido | Estado |
|---|---|---|
| 1 | Login y roles | ✅ en repo |
| 2 | Equipos y jugadores (base) | ✅ |
| 3 | Panel lateral y documentos (storage) | ✅ |
| 4 | Representantes, credenciales y panel del club | ✅ |
| 5 | Mensajería premium | ✅ |
| 6 | Competencias (núcleo: torneos, equipos, fixture) | ✅ |
| 7A | Planilla digital del árbitro | ✅ |
| 7B | Goleadores y disciplina (suspensiones por torneo) | ✅ |
| 7C | Llaves de playoff (4 formatos) | ✅ |
| Hotfix | Seguridad: proxy por rol + RLS + helpers | ✅ |
| 8A | Tesorería: cargos, pagos, recibos, multas, rol tesorero | ✅ |
| 8B | Tesorería: gastos, reportes, export Excel, cierre de caja | ✅ |
| 9 | Pases: circuito completo, ventanas, firma online simple, nro de pase | ✅ |
| 9B Parte 1 | Motor pases premium: préstamos, firma profesional (documento+canvas+foto DNI+tutor), deudas, derecho de pase por categoría/torneo, históricos en papel, tenencia, trámites automáticos, inscripción con fecha de nacimiento y validación por año | ✅ (commit `de85c159`) |
| 10 | Club autogestión: `club/planteles` real, `inscribirJugador` doble rol (admin/club dueño), policies INSERT club en players/player_categories, ficha jugador (foto + fecha) | ✅ (verificado en producción por el usuario) |
| 10B | Planteles por categoría (`club_planteles` + RLS + backfill), inscripción SOLO en plantel existente, regla de edad ESTRICTA (solo su categoría por año; ni más alta ni más chica — planilla de juego sigue permitiendo citar para arriba), 4 documentos obligatorios al inscribir (DNI, CEMAD médico, CEMAD autorización, comprobante federación — bucket `documentos-jugadores` con policies club), foto obligatoria, fix `bodySizeLimit: 30mb` en next.config.ts (error "Body exceeded 1 MB"), ficha con checklist de docs, admin gestiona planteles (`GestionPlanteles`) y solo inscribe en categorías con plantel | ✅ entregado 2026-09-03 |

Tests actuales: **81 en verde** (6 archivos en `src/tests/`).

## Mocks pendientes (pantallas con datos falsos)

- Admin: dashboard, agenda, reglamento, estadísticas, configuración, tribunal, designaciones, colegio de árbitros.
- Club: estadísticas, configuración, descargas.
- Público: noticias, descargas.
- Árbitro: dashboard, calendario, perfil, estadísticas, mensajería.

## Roadmap acordado

1. **Paso 10 — El club se autogestiona**: ✅ hecho (10 + 10B, ver arriba).
2. **Paso 11 — 9B Parte 2** (SIGUIENTE): página admin config de pases (rangos + fees + settings), trámites admin con alertas de trabados/mercado con montos, `/transferencias` pública estilo FIFA (sin montos), historial del jugador con períodos, página admin pase/[id] con evidencia de firma (`!!meta.tutor` por trampa unknown), club/tramites con rescisión.
3. **Paso 12** — Convertir mocks admin/públicos en reales (priorizar tribunal con datos de disciplina 7B, noticias, descargas).
4. **Paso 13** — Deploy a producción (Vercel + Supabase prod, env vars, datos iniciales).

## Desconexiones detectadas (análisis 2026-09-02)

- ~~El club no podía cargar jugadores~~ → RESUELTO en Pasos 10/10B (acción doble rol + RLS club + pantalla real con planteles).
- Componentes 9B sin pantalla aún (config, evidencia, foto) → Paso 11.
- SQLs 8B/9/9B no commiteados en el repo → quedan en la raíz del proyecto del usuario (los incluye su commit del Paso 10).

## Reglas de negocio confirmadas por el usuario (NO cambiar sin preguntar)

- **Inscripción al plantel = estricta por año de nacimiento**: ni categoría más grande ni más chica. Validado en `validarCategoriasPorAnio` (jugadoresRules.ts) con tests.
- **Planilla de juego = flexible**: se puede citar jugadores de categorías inferiores para un partido (GestionPlantelClub NO se tocó).
- **Documentos obligatorios de inscripción (4)**: DNI, CEMAD médico, CEMAD de autorización, comprobante de pago de federación. Constante `DOCUMENTOS_INSCRIPCION` en jugadoresRules.ts.
- **Foto obligatoria** al inscribir (≤5MB, imagen).
- **El DNI es la clave única del jugador** (no hay ID manual).
- Un plantel solo se elimina si está vacío.
- `next.config.ts` lleva `experimental.serverActions.bodySizeLimit: "30mb"` — NO borrar (sin esto las subidas >1MB fallan).
