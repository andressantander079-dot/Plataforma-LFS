"use client";

import { useState } from "react";
import { Globe, Lock } from "lucide-react";
import type { GestionDescargas as Gestion } from "@/lib/actions/descargas.actions";
import { GestionDescargas } from "./GestionDescargas";

export function DescargasTabs({
  gestionPublicos,
  gestionClubes,
}: {
  gestionPublicos: Gestion;
  gestionClubes: Gestion;
}) {
  const [pestaña, setPestaña] = useState<"publico" | "clubes">("publico");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          id="tab-descargas-publico"
          onClick={() => setPestaña("publico")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            pestaña === "publico" ? "bg-white text-[#1A2A44] shadow-sm" : "text-slate-500 hover:text-[#1A2A44]"
          }`}
        >
          <Globe className="w-4 h-4" />
          Públicos
        </button>
        <button
          id="tab-descargas-clubes"
          onClick={() => setPestaña("clubes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            pestaña === "clubes" ? "bg-white text-[#1A2A44] shadow-sm" : "text-slate-500 hover:text-[#1A2A44]"
          }`}
        >
          <Lock className="w-4 h-4" />
          Solo clubes y árbitros
        </button>
      </div>

      {pestaña === "publico" ? (
        <GestionDescargas key="publico" gestion={gestionPublicos} />
      ) : (
        <GestionDescargas key="clubes" gestion={gestionClubes} />
      )}
    </div>
  );
}
