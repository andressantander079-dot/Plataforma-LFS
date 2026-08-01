"use client";

import { useCallback, useEffect, useState } from "react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import { contarNoLeidos } from "@/lib/actions/mensajeria.actions";

/**
 * BADGE DE MENSAJES NO LEÍDOS
 * Muestra la cantidad de mensajes sin leer del usuario actual
 * y se actualiza en tiempo real. Si no hay, no muestra nada.
 * Pensado para el menú lateral del admin y el encabezado del club.
 */
export function BadgeMensajeria() {
  const [cantidad, setCantidad] = useState(0);

  const refrescar = useCallback(async () => {
    setCantidad(await contarNoLeidos());
  }, []);

  useEffect(() => {
    refrescar();

    const supabase = createLfsClient();
    const canal = supabase
      .channel("badge-mensajes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        refrescar
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        refrescar
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [refrescar]);

  if (cantidad === 0) return null;

  return (
    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center shadow">
      {cantidad > 99 ? "99+" : cantidad}
    </span>
  );
}
