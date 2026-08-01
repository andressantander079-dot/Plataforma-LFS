import { createClient } from "@supabase/supabase-js";

/**
 * CLIENTE ADMINISTRADOR DE SUPABASE (service_role)
 *
 * ⚠️ SOLO PARA USO EN SERVIDOR (Server Actions).
 * Esta clave pasa por encima de TODAS las políticas RLS.
 * Nunca importar este archivo desde un componente "use client".
 *
 * Se usa para operaciones que el usuario común no puede hacer,
 * como crear usuarios de acceso para los clubes.
 */
export function createLfsAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Error de Configuración: Falta SUPABASE_SERVICE_ROLE_KEY en el archivo .env.local"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
