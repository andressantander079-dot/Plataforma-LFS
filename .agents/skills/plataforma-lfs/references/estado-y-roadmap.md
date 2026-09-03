# Estado y Roadmap — Plataforma LFS

## Estado Actual del Proyecto (Paso por Paso)

- **Paso 1 y 2: Esquema Base y Roles**
  - Autenticación con Supabase (`profiles`), roles: `admin`, `club`, `arbitro`, `arbitro_asistente`.
  - Tablas: `clubs`, `players`, `categories`, `player_categories`, `matches`, `audit_logs`.
- **Paso 3: Documentación y Storage**
  - Bucket privado `documentos-jugadores` para fichas médicas, DNI y fotos.
- **Paso 4: Clubes y Representantes**
  - Alta de clubes, presidentes, tesoreros y usuarios de acceso vinculados.
- **Paso 5: Mensajería Interna Oficial**
  - Bandeja de entrada entre federación y clubes con PIN de seguridad y confirmaciones de lectura.
- **Paso 6: Competencias, Fixtures y Sedes**
  - Creación de torneos (liga, eliminación, grupos + playoffs), generación automática de fixture, canchas (`venues`).
- **Paso 7A, 7B y 7C: Planillas, Disciplina y Playoffs**
  - Planilla digital de partido táctil con registro de goles, tarjetas, firmas y cálculo automático de tablas.
  - Sanciones automáticas por tarjetas y cómputo de fechas. Cruces eliminatorios de playoffs.
- **Paso 8A y 8B: Módulo de Tesorería**
  - Gestión contable federativa: ingresos, egresos, aranceles, multas automáticas con PIN 00T00.
- **Paso 9, 9B y 9C: Pases, Transferencias e Inscripción de Planteles**
  - Circuito de pases federativos en 7 estados, reglas de tenencia y rescisión (`pasesRules.ts`).
  - RPC `inscribir_jugador_club` con validación estricta de edad y categoría base (`jugadoresRules.ts`).
- **Hotfix de Seguridad (Agosto 2026)**
  - Cierre de políticas RLS públicas en DNI y teléfonos; validación estricta de planteles por club.
- **Paso 10: Panel de Configuración Integral (Completado)**
  - Identidad institucional, logotipo oficial con subida a bucket `league-assets`.
  - Gestión de categorías con Soft-Deactivate (`is_active`) y preservación histórica.
  - Patrocinadores comerciales (`sponsors`) por tiers (Main, Platino, Oro, etc.).
  - Canchas y escenarios deportivos de Ushuaia.
  - Parámetros de juego, disciplina y libro de pases con Singleton `league_settings`.

## Roadmap / Siguientes Pasos
- Puesta a punto final del portal público y páginas de fixture/posiciones con datos de sponsors dinámicos.
- Conexión de reportes imprimibles en PDF para actas y fichas de club.
