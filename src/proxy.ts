import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * PROXY LFS — Protección de rutas (hotfix de seguridad)
 *
 * Antes este archivo no hacía nada: cualquiera podía abrir /admin, /club
 * o /arbitro y solo el RLS de la base frenaba los datos. Ahora el proxy
 * verifica sesión y rol ANTES de renderizar cualquier página privada:
 *
 *   /admin/*   → solo federación (admin)
 *   /club/*    → clubes (y la federación, para soporte)
 *   /arbitro/* → árbitros (y la federación)
 *
 * Sin sesión → /login. Con rol equivocado → a su propio panel.
 */

// OJO: "/admin/tesoreria" va ANTES que "/admin": el proxy toma la primera
// sección que coincide, y el tesorero solo puede entrar a ese módulo.
const SECCIONES: Record<string, string[]> = {
  "/admin/tesoreria": ["admin", "tesorero"],
  "/admin": ["admin"],
  "/club": ["club", "admin"],
  "/arbitro": ["arbitro", "arbitro_asistente", "admin"],
};

function panelDelRol(role: string): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "tesorero") return "/admin/tesoreria/movimientos";
  if (role === "club") return "/club/dashboard";
  if (role === "arbitro" || role === "arbitro_asistente") return "/arbitro/dashboard";
  return "/login";
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const seccion = Object.keys(SECCIONES).find((s) => pathname.startsWith(s));
  if (!seccion) return NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role ?? "") as string;
  if (!SECCIONES[seccion].includes(role)) {
    const url = request.nextUrl.clone();
    url.pathname = panelDelRol(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/club/:path*", "/arbitro/:path*"],
};
