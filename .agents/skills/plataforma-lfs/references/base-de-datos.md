# Base de Datos y Supabase — Plataforma LFS

## Tablas Principales

| Tabla | Propósito | RLS / Políticas |
|---|---|---|
| `profiles` | Perfiles de usuario vinculados a `auth.users` (`role`, `full_name`, `club_id`). | Lectura para autenticados; update propio. |
| `clubs` | Clubes afiliados, datos de presidente y tesorero. | Lectura: federación y propio club. |
| `players` | Jugadores con DNI único, fecha nacimiento, foto. | Lectura: federación, propio club y árbitro asignado. |
| `categories` | Categorías de la liga (`level_hierarchy`, `gender`, `anio_desde`, `anio_hasta`, `is_active`). | Lectura pública; escritura solo admin. |
| `player_categories` | Relación M:M jugador, categoría y club. | Control de planteles por club. |
| `competitions` | Torneos y campeonatos por categoría. | Lectura pública; escritura solo admin. |
| `teams` | Equipos por club y categoría (ej: HAF A, HAF B). | Lectura pública; escritura solo admin. |
| `venues` | Escenarios y gimnasios (Favale, Lasserre, Petrina) con `surface` y `capacity`. | Lectura pública; escritura solo admin. |
| `matches` | Partidos, fixture, árbitros asignados y resultados. | Lectura pública; carga por árbitro y federación. |
| `match_sheets` | Planillas digitales de arbitraje con hash y firmas. | Modificación por árbitro asignado y admin. |
| `transfers` | Trámites de pases interclubes en 7 estados. | Visibilidad para clubes intervinientes y federación. |
| `league_settings` | Singleton (`id = 1`) con parámetros institucionales, disciplina y pases. | Lectura pública; escritura solo admin vía RPC. |
| `sponsors` | Patrocinadores oficiales de la liga con logos y tiers. | Lectura pública; escritura solo admin. |
| `audit_logs` | Trazabilidad inmutable de acciones críticas. | Lectura admin; inserción autenticados. |

## Buckets de Storage
- `documentos-jugadores`: Privado (5 MB máx, PDF/JPG/PNG).
- `mensajeria-adjuntos`: Privado para adjuntos oficiales.
- `league-assets`: Público (2 MB máx, PNG/JPG/WebP/SVG) para logos, sponsors y banners.

## Funciones SQL RPC Críticas
- `public.is_admin()`: Retorna boolean verificando si el usuario actual tiene rol `admin` en `profiles`.
- `public.inscribir_jugador_club(...)`: RPC con seguridad definer que inscribe jugadores validando DNI, club y categoría base por año de nacimiento.
- `public.actualizar_configuracion_path(p_path TEXT[], p_valores JSONB)`: RPC atómico que actualiza subnodos de `league_settings` con `jsonb_set` e inserta en `audit_logs`.
