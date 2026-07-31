import { createBrowserClient } from "@supabase/ssr";

/**
 * Crea un cliente de Supabase seguro para su uso en componentes del lado del cliente (Browser Client).
 */
export function createLfsClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Error de Configuración: Falta configurar las variables de entorno de Supabase."
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
