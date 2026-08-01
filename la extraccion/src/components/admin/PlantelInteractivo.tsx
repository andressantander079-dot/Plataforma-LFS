"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, ArrowLeft, Plus, FileText, KeyRound, UserRound } from "lucide-react";
import { PanelInscribirJugador } from "@/components/admin/PanelInscribirJugador";
import { PanelCredencialesClub } from "@/components/admin/PanelCredencialesClub";
import { CeldaDocumento } from "@/components/admin/CeldaDocumento";

/**
 * PLANTEL INTERACTIVO
 * La tabla, el panel de inscripción y el de credenciales viven
 * en la misma pantalla: nada te lleva a otra página.
 */

export interface JugadorPlantel {
  id: string;
  dni: string;
  fullName: string;
  status: "activo" | "inactivo";
  categories: string[];
  documents: Record<string, string>;
}

export interface UsuarioClub {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  level_hierarchy: number;
}

interface Props {
  clubId: string;
  clubName: string;
  jugadores: JugadorPlantel[];
  categories: Category[];
  usuarios: UsuarioClub[];
  abrirPanelInicial: boolean;
}

const DOCS = [
  { tipo: "medical" as const, titulo: "Ficha Médica" },
  { tipo: "ddjj" as const, titulo: "Declaración Jurada" },
  { tipo: "photo" as const, titulo: "Foto DNI" },
];

export function PlantelInteractivo({
  clubId,
  clubName,
  jugadores,
  categories,
  usuarios,
  abrirPanelInicial,
}: Props) {
  const [panelJugador, setPanelJugador] = useState(abrirPanelInicial);
  const [panelCredenciales, setPanelCredenciales] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/equipos"
            className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
              <Users className="w-7 h-7 text-[#F97316]" />
              Plantel - {clubName}
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Administración de fichajes, documentación de salud y categorías autorizadas.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPanelJugador(true)}
          id="btn-add-player"
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-[#F97316]/20 text-xs self-stretch sm:self-auto text-center justify-center"
        >
          <Plus className="w-4 h-4" />
          Inscribir Jugador
        </button>
      </section>

      {/* Tabla de Jugadores */}
      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 overflow-x-auto">
        {jugadores.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-10">
            <Users className="w-8 h-8 text-slate-300" />
            <p className="text-slate-500 text-sm">
              Este club todavía no tiene jugadores inscriptos.
            </p>
            <button
              type="button"
              onClick={() => setPanelJugador(true)}
              className="text-[#F97316] font-bold text-xs hover:underline"
            >
              Inscribir el primer jugador →
            </button>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-150 text-left">
                <th className="py-3 px-3">Jugador</th>
                <th className="py-3 px-3">DNI</th>
                <th className="py-3 px-3">Categorías</th>
                <th className="py-3 px-3 text-center">Ficha Médica</th>
                <th className="py-3 px-3 text-center">DDJJ</th>
                <th className="py-3 px-3 text-center">Foto DNI</th>
                <th className="py-3 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {jugadores.map((player) => (
                <tr key={player.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-3 font-bold text-[#1A2A44] text-sm">
                    {player.fullName}
                  </td>
                  <td className="py-4 px-3 font-mono text-slate-500 text-xs">
                    {player.dni}
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex flex-wrap gap-1">
                      {player.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded-full bg-[#1A2A44]/5 text-[#1A2A44] text-[9px] font-bold"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  {DOCS.map((doc) => (
                    <td key={doc.tipo} className="py-4 px-3 text-center">
                      <CeldaDocumento
                        clubId={clubId}
                        playerId={player.id}
                        tipo={doc.tipo}
                        ruta={player.documents[doc.tipo] ?? null}
                        titulo={doc.titulo}
                      />
                    </td>
                  ))}
                  <td className="py-4 px-3 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        player.status === "activo"
                          ? "bg-green-50 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {player.status === "activo" ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Info Box */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
          <FileText className="w-4 h-4 text-[#F97316]" />
          <p>
            Límite de planilla reglamentaria: Mínimo 12 y máximo 25 jugadores activos habilitados por categoría.
            Plantel actual: {jugadores.length} jugador{jugadores.length === 1 ? "" : "es"}.
            Tocá el ícono rojo de una casilla para subir el documento.
          </p>
        </div>
      </section>

      {/* Acceso al sistema del club */}
      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#F97316]" />
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1A2A44]">
                Acceso al Sistema
              </h3>
              <p className="text-slate-400 text-[11px]">
                Usuarios autorizados para entrar al panel de este club.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPanelCredenciales(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-[#1A2A44] hover:bg-[#1A2A44]/90 text-white transition text-[11px]"
          >
            <Plus className="w-4 h-4" />
            Asignar Credenciales
          </button>
        </div>

        {usuarios.length === 0 ? (
          <p className="text-slate-400 text-xs italic">
            Este club todavía no tiene usuarios con acceso. Asigná las primeras
            credenciales para que puedan entrar a su panel.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {usuarios.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-full bg-[#1A2A44]/5 flex items-center justify-center">
                  <UserRound className="w-4 h-4 text-[#1A2A44]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1A2A44] truncate">{u.full_name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{u.email ?? "Sin email"}</p>
                </div>
                <span className="text-[9px] text-slate-400 font-bold shrink-0">
                  Alta: {new Date(u.created_at).toLocaleDateString("es-AR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Paneles laterales */}
      <PanelInscribirJugador
        clubId={clubId}
        clubName={clubName}
        categories={categories}
        abierto={panelJugador}
        onCerrar={() => setPanelJugador(false)}
      />
      <PanelCredencialesClub
        clubId={clubId}
        clubName={clubName}
        abierto={panelCredenciales}
        onCerrar={() => setPanelCredenciales(false)}
      />
    </div>
  );
}
