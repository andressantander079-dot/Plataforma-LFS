# Base de datos Supabase — Plataforma LFS (por paso)

Los SQL viven en la raíz del repo (hasta 8A) y en los ZIPs de cada paso (8B, 9, 9B — pendiente commitearlos). Todos son idempotentes y terminan con SELECT de verificación.

## Esquema base (`supabase_schema.sql`, Pasos 1-2)

- `profiles(id, full_name, email, role, club_id, created_at)` — roles: `admin`, `tesorero`, `club`, `arbitro`, `arbitro_asistente`.
- `clubs(id, name, ...)`
- `players(id, dni UNIQUE, first_name, last_name, status, documents jsonb)` — documents: mapa tipo→path en bucket `documentos`.
- `categories(id, name, level_hierarchy UNIQUE, gender)`
- `player_categories(player_id, category_id, club_id, PK(player_id, category_id))`
- `matches`, `match_sheets`, `transfers`, `audit_logs`

## Paso 3 — Storage (`supabase_paso3_storage.sql`)

Bucket `documentos` + policies por carpeta (club sube solo a su carpeta).

## Paso 4 — Representantes y usuarios (`supabase_paso4_representantes_y_usuarios.sql`)

Credenciales de club: el admin crea el usuario desde el panel (auth.admin.createUser en `equipos.actions.crearUsuarioClub`).

## Hotfix seguridad (`supabase_hotfix_seguridad.sql`)

`is_admin()`, `mi_club_id()` SECURITY DEFINER. Policies: players select = admin / su club / árbitro designado; escritura players y player_categories = SOLO admin (Paso 10 agrega inserción del club). audit_logs solo admin escribe.

## Paso 5 — Mensajería (`supabase_paso5_mensajeria.sql`)

Conversaciones, mensajes, tickets; badge de no leídos.

## Paso 6 — Competencias (`supabase_paso6_competencias.sql`)

`competitions(id, name, season, category_id, format, status)`, `teams(id, club_id, competition_id)`, canchas, fixture (matches con home/away team, fecha, cancha, referee_id).

## Paso 7A/7B/7C — Planillas, disciplina, playoffs

Planilla digital del árbitro (eventos, goles, tarjetas), tabla de goleadores, suspensiones automáticas **por torneo** (`competition_id`), llaves de playoff (4 formatos).

## Paso 8A/8B — Tesorería

`treasury_settings(id=1 CHECK)`, `treasury_charges(id, club_id, competition_id, tipo CHECK incl 'derecho_pase','otro', transfer_id, monto, estado...)`, pagos con comprobante, recibos, gastos, cierres de caja, rol `tesorero`. Index único `cargo_pase_uniq` en `treasury_charges(transfer_id)`.

## Paso 9 — Pases (`supabase_paso9_pases.sql`)

- `transfers` (status ENUM `transfer_status`: `1_INIT_CLUB_A`, `2_FVF_REVIEW`, `3_NOTIFY_CLUB_B`, `4_CLUB_B_DECISION`, `5_PLAYER_SIGNATURE`, `6_FINAL_AUDIT`, `7_COMPLETED`, `8_RECHAZADO`, `9_CANCELADO`) + `metadata jsonb` (firma_token, firma_enviada_at, notificado_at, nro_pase, historico, etc.).
- `transfer_windows` (ventanas de mercado; nadie inicia pases fuera de ventana, ni admin).
- Funciones: `asignar_numero_pase`, `dar_baja_jugador`, `firmar_pase` (vieja, solo DNI), `obtener_pase_firma`.
- Bucket `documentos-pases` (privado).

## Paso 9B — Pases Premium (`supabase_paso9b_pases.sql`)

- `players` + `fecha_nacimiento date`, `foto_path text`. Bucket PÚBLICO `fotos-jugadores` (carpeta = club_id).
- `categories` + `anio_desde int`, `anio_hasta int` (rangos editables por la liga; inscripción bloquea con sugerencia "Podría jugar en Sub-…").
- `pase_settings(id=1 CHECK, tenencia_anios=1, recargo_rescision=0, alerta_trabado_horas=48, cancelacion_trabado_horas=72, aviso_retorno_horas=72)`.
- `transfer_fees(id, category_id, competition_id NULL, tipo CHECK definitivo|prestamo, monto)` + unique `(category_id, coalesce(competition_id,'00000000-…'), tipo)`. El derecho de pase lo cobra la FEDERACIÓN.
- `transfers` + `tipo_pase` (definitivo|prestamo), `fecha_retorno`, `competition_id`, `deuda_monto`, `deuda_modo` (cobrar|bloqueante), `deuda_descripcion`, `deuda_saldada`.
- Funciones: `obtener_pase_firma` (extendida: dni_ultimos3, es_menor, tipo_pase, torneo, motivo), `firmar_pase_9b` (10 params, tutor si es menor), `rechazar_pase_jugador`, `procesar_pases_automaticos` (trabados 48h alerta / 72h cancela, aviso y retorno de préstamos; pg_cron opcional + autocuración), `dar_baja_jugador` (con tenencia), `pases_publicos` (para /transferencias), `club_actualizar_jugador`.

## Paso 10 — Club autogestión (`supabase_paso10_club_plantel.sql`)

- Policies INSERT para rol club: `players` y `player_categories` (`club_id = public.mi_club_id()`).

## Paso 10B — Planteles por categoría (`supabase_paso10b_planteles.sql`)

- `club_planteles(id uuid pk, club_id → clubs cascade, category_id → categories cascade, created_at, UNIQUE(club_id, category_id))` + RLS: select/insert/delete `is_admin() or club_id = mi_club_id()`.
- Backfill: `insert ... select distinct club_id, category_id from player_categories on conflict do nothing` (jugadores previos quedan con plantel).
- Storage `documentos-jugadores` (privado): 3 policies club por carpeta `(storage.foldername(name))[1] = mi_club_id()::text` (insert/select/update). Path: `{club_id}/{player_id}/{clave}.{ext}`; claves: `dni`, `cemad_medico`, `cemad_autorizacion`, `comprobante_federacion`. `players.documents` jsonb guarda `{clave: ruta}`.
- `club_actualizar_jugador` recreada con 4 params (`p_player_id, p_fecha_nacimiento, p_foto_path, p_documents`); definer; permiso: admin, club dueño de algún vínculo, o rol club si el jugador aún no tiene vínculos (alta nueva); hace `documents = coalesce(documents,'{}'::jsonb) || p_documents`.

## Reglas de negocio confirmadas por Andrés (no cambiar sin pedirlo)

- Jugador: fecha de nacimiento y foto OBLIGATORIAS (foto la sube el club; ícono 3D `public/jugador-default.png` si no hay).
- **Inscripción al plantel: SOLO la categoría exacta de su año** (10B endureció la regla: ni más grande ni más chica; `validarCategoriasPorAnio` estricta). Jugar "para arriba" sigue valiendo SOLO en planilla de partido, nunca para inscribir.
- Inscripción exige 4 documentos: DNI, CEMAD médico, CEMAD de autorización, comprobante de federación (constante `DOCUMENTOS_INSCRIPCION`).
- `es_menor` = <18 al día de hoy.
- Préstamo: `fecha_retorno` futura obligatoria; retorno automático al club origen; aviso 72h antes; rescisión SOLO del club destino CON RECARGO.
- Deuda del club origen al dictaminar: `cobrar` (la paga el destino con el pase) o `bloqueante` (frena el pase hasta que la liga la marque saldada; el jugador puede pagar por fuera).
- Firma: documento de conformidad + firma dibujada (canvas) + foto DNI en el momento; menor → bloque tutor completo; jugador puede RECHAZAR con motivo visible.
- Trabados: 48h sin dictamen → alerta a la liga; 72h → auto-cancela.
- Tenencia: 1 año corrido desde el 1/1 del alta (configurable) antes de permitir baja.
- Público /transferencias: solo pases efectivos, SIN montos, badge "Préstamo" sin duración. Admin mercado: CON montos.
- Históricos en papel: SOLO año anterior, carga el admin, no mueve jugador ni cobra.
