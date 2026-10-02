"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";

/**
 * REALTIME REFRESHER — Mantiene el dashboard actualizado en vivo.
 * Se suscribe a los cambios de las tablas indicadas (INSERT/UPDATE/DELETE)
 * y refresca los datos del servidor con un pequeño debounce para no
 * saturar cuando llegan varios cambios juntos.
 * No renderiza nada visible.
 */
export function RealtimeRefresher({ tablas }: { tablas: string[] }) {
  const router = useRouter();
  const claveTablas = tablas.join(",");

  useEffect(() => {
    const supabase = createLfsClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refrescar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 600);
    };

    let canal = supabase.channel(`realtime-dash-${claveTablas}`);
    for (const tabla of claveTablas.split(",")) {
      canal = canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabla },
        refrescar
      );
    }
    canal.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(canal);
    };
  }, [router, claveTablas]);

  return null;
}
