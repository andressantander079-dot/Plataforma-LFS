"use client";

import Link from "next/link";
import { Users, Plus, ShieldCheck, Phone, CheckCircle, XCircle, AlertCircle, Eye } from "lucide-react";

const MOCK_CLUBS = [
  {
    id: "club-1",
    name: "Club Camioneros Ushuaia",
    president: "Guillermo Vargas",
    presidentPhone: "+54 2901 442211",
    treasurer: "Roberto Gómez",
    status: "Habilitado",
    color: "border-green-500",
  },
  {
    id: "club-2",
    name: "HAF Ushuaia",
    president: "Daniel Pérez",
    presidentPhone: "+54 2901 556677",
    treasurer: "Juan Castro",
    status: "En revisión",
    color: "border-orange-500",
  },
  {
    id: "club-3",
    name: "Club Galicia Ushuaia",
    president: "Carlos Albarracín",
    presidentPhone: "+54 2901 889900",
    treasurer: "Diego Torres",
    status: "Inhabilitado",
    color: "border-red-500",
  },
];

export default function EquiposAdmin() {
  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <Users className="w-8 h-8 text-[#F97316]" />
            Clubes Afiliados
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Administra los clubes inscritos, sus contactos de tesorería y estados de habilitación.
          </p>
        </div>

        <Link
          href="/admin/equipos/crear"
          id="btn-create-club"
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-[#F97316]/20 text-xs self-stretch sm:self-auto text-center justify-center"
        >
          <Plus className="w-4 h-4" />
          Registrar Club
        </Link>
      </section>

      {/* Tarjetas de Clubes */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_CLUBS.map((club) => (
          <div
            key={club.id}
            className={`bg-white rounded-2xl border-l-4 ${club.color} border-y border-r border-slate-200/80 p-5 flex flex-col justify-between shadow-sm hover:shadow transition duration-250`}
          >
            <div>
              {/* Encabezado */}
              <div className="flex justify-between items-center mb-3">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 ${
                  club.status === "Habilitado"
                    ? "bg-green-50 text-green-700"
                    : club.status === "En revisión"
                    ? "bg-orange-50 text-orange-700"
                    : "bg-red-50 text-red-750"
                }`}>
                  {club.status === "Habilitado" ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : club.status === "En revisión" ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  {club.status}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">LFS v3.0</span>
              </div>

              <h4 className="font-serif text-lg font-bold text-[#1A2A44] mb-3">
                {club.name}
              </h4>

              {/* Contactos */}
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 mb-6">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Presidente</span>
                  <p className="text-slate-700 text-xs font-bold">{club.president}</p>
                  <p className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-[#F97316]" /> {club.presidentPhone}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Tesorero</span>
                  <p className="text-slate-700 text-xs font-bold">{club.treasurer}</p>
                </div>
              </div>
            </div>

            {/* Accesos rápidos */}
            <div className="flex gap-2">
              <Link
                href={`/admin/equipos/${club.id}/plantel`}
                className="flex-1 px-3 py-2 bg-[#1A2A44]/5 hover:bg-[#1A2A44] text-[#1A2A44] hover:text-white rounded-lg font-bold text-[10px] transition text-center flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                Ver Plantel
              </Link>
              <Link
                href={`/admin/equipos/${club.id}/finanzas`}
                className="px-3 py-2 bg-slate-50 hover:bg-[#F97316] hover:text-white text-slate-650 rounded-lg font-bold text-[10px] transition text-center"
              >
                Finanzas
              </Link>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
