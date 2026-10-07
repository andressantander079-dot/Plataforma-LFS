"use client";

import { useEffect, useState } from "react";
import { Loader2, CircleAlert } from "lucide-react";
import { obtenerConfigMercado, type ConfigMercado } from "@/lib/actions/tramites.actions";
import { EditorMercadoPases } from "@/components/tramites/EditorMercadoPases";

/**
 * TAB "PASES & FICHAJES" — Configuración LFS (Paso 15).
 * Ahora es la ÚNICA puerta de edición del mercado de pases:
 * reglas, ventanas, años por categoría y tarifas, todo sobre la fuente
 * única (pase_settings + transfer_windows + categories + transfer_fees).
 * En Trámites → Configuración se ve lo mismo en solo lectura y en vivo.
 *
 * Las props viejas (initialTransfers / onSaveTransfers / setDirtySection)
 * se conservan opcionales para no romper PanelConfiguracion.
 */
interface TabPasesProps {
  initialTransfers?: unknown;
  onSaveTransfers?: (data: never) => Promise<boolean>;
  setDirtySection?: (section: "transfers", isDirty: boolean) => void;
}

export function TabPases(_props: TabPasesProps) {
  const [config, setConfig] = useState<ConfigMercado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerConfigMercado()
      .then(setConfig)
      .catch(() => setError("No se pudo cargar la configuración del mercado."));
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <CircleAlert className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm font-bold text-red-700">{error}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm font-semibold">Cargando configuración del mercado…</span>
      </div>
    );
  }

  return <EditorMercadoPases config={config} />;
}
