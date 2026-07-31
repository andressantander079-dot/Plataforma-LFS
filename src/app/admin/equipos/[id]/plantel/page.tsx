"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users, ArrowLeft, Plus, CheckCircle, AlertCircle, FileText, Settings, Badge } from "lucide-react";

// Mock de Jugadores
const MOCK_PLAYERS = [
  {
    id: "p1",
    dni: "44111222",
    firstName: "Lucas",
    lastName: "Aravena",
    status: "Activo",
    categories: ["Primera", "Sub-18"],
    documents: { medical: true, ddjj: true, photo: true },
  },
  {
    id: "p2",
    dni: "45222333",
    firstName: "Bautista",
    lastName: "Roldán",
    status: "Activo",
    categories: ["Sub-18"],
    documents: { medical: true, ddjj: false, photo: true },
  },
  {
    id: "p3",
    dni: "46333444",
    firstName: "Mateo",
    lastName: "García",
    status: "Inactivo",
    categories: ["Sub-16"],
    documents: { medical: false, ddjj: false, photo: true },
  },
];

export default function ClubPlantelAdmin() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;

  // En una app real, buscaríamos los datos del club e integrantes desde Supabase
  const clubName = "Club Camioneros Ushuaia";

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/admin/equipos")}
            className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
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

        <Link
          href={`/admin/equipos/${clubId}/plantel/agregar`}
          id="btn-add-player"
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-[#F97316]/20 text-xs self-stretch sm:self-auto text-center justify-center"
        >
          <Plus className="w-4 h-4" />
          Inscribir Jugador
        </Link>
      </section>

      {/* Tabla de Jugadores */}
      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 overflow-x-auto">
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
            {MOCK_PLAYERS.map((player) => (
              <tr key={player.id} className="hover:bg-slate-50/50 transition">
                <td className="py-4 px-3 font-bold text-[#1A2A44] text-sm">
                  {player.lastName}, {player.firstName}
                </td>
                <td className="py-4 px-3 font-mono text-slate-500 text-xs">{player.dni}</td>
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
                <td className="py-4 px-3 text-center">
                  {player.documents.medical ? (
                    <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 inline-block" />
                  )}
                </td>
                <td className="py-4 px-3 text-center">
                  {player.documents.ddjj ? (
                    <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 inline-block" />
                  )}
                </td>
                <td className="py-4 px-3 text-center">
                  {player.documents.photo ? (
                    <CheckCircle className="w-5 h-5 text-green-600 inline-block" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 inline-block" />
                  )}
                </td>
                <td className="py-4 px-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    player.status === "Activo"
                      ? "bg-green-50 text-green-650"
                      : "bg-slate-100 text-slate-550"
                  }`}>
                    {player.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Info Box sobre Límites */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
          <FileText className="w-4 h-4 text-[#F97316]" />
          <p>
            Límite de planilla reglamentaria: Mínimo 12 y máximo 25 jugadores activos habilitados por categoría.
          </p>
        </div>
      </section>

    </div>
  );
}
