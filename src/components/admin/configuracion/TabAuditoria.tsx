"use client";

import { History, Shield, Calendar, User } from "lucide-react";
import type { ConfigAuditLogItem } from "@/lib/core/rules/configuracionRules";

interface TabAuditoriaProps {
  logs: ConfigAuditLogItem[];
}

export function TabAuditoria({ logs }: TabAuditoriaProps) {
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const formatActionName = (action: string) => {
    return action
      .replace(/^UPDATE_CONFIG_/, "Actualización ")
      .replace(/^CREATE_/, "Alta ")
      .replace(/^UPDATE_/, "Modificación ")
      .replace(/^DELETE_/, "Baja ")
      .replace(/^ENABLE_/, "Habilitación ")
      .replace(/^DISABLE_/, "Desactivación ")
      .replace(/_/g, " ");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex items-start gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold shrink-0">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-serif text-base font-bold">Registro de Auditoría de Configuración</h3>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
            Trazabilidad inmutable de todas las mutaciones realizadas en parámetros institucionales, categorías, sponsors y sedes de la LFS.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Shield className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            No hay registros de cambios recientes en el módulo de configuración.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50/70 transition flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-[#1A2A44] font-bold rounded text-[10px] uppercase tracking-wider">
                      {formatActionName(log.action)}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">Módulo: {log.module}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {log.user_id ? `Admin (${log.user_id.slice(0, 8)})` : "Sistema"}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-slate-600">
                      <Calendar className="w-3 h-3" /> {formatDate(log.created_at)}
                    </span>
                  </div>
                </div>

                {/* Preview de Datos */}
                {log.new_data ? (
                  <details className="text-[11px] text-slate-600 cursor-pointer">
                    <summary className="font-semibold text-[#F97316] hover:underline">
                      Ver detalle de datos registrados
                    </summary>
                    <pre className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl overflow-x-auto text-[10px] font-mono leading-relaxed">
                      {JSON.stringify(log.new_data, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
