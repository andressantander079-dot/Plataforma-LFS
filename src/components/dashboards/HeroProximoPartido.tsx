"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, MapPin, Trophy } from "lucide-react";
import { textoCountdown } from "@/lib/core/rules/dashboardRules";

/**
 * HERO PRÓXIMO PARTIDO — Tarjeta destacada del dashboard del club.
 * Cuenta regresiva en vivo (se actualiza cada 30 segundos), rival,
 * cancha, torneo y acceso directo a la planilla.
 * Cliente: el countdown tiene que latir en el dispositivo.
 */
export function HeroProximoPartido({
  miEquipo,
  rival,
  esLocal,
  torneo,
  cancha,
  fechaISO,
  hrefPartidos,
}: {
  miEquipo: string;
  rival: string;
  esLocal: boolean;
  torneo: string;
  cancha: string | null;
  fechaISO: string;
  hrefPartidos: string;
}) {
  const [countdown, setCountdown] = useState(() => textoCountdown(fechaISO));

  useEffect(() => {
    const timer = setInterval(() => setCountdown(textoCountdown(fechaISO)), 30_000);
    return () => clearInterval(timer);
  }, [fechaISO]);

  const fecha = new Date(fechaISO);
  const fechaLinda = fecha.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Ushuaia",
  });
  const horaLinda = fecha.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Ushuaia",
  });

  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#1A2A44] via-[#22345a] to-[#1A2A44] text-white p-5 md:p-6 shadow-lg relative overflow-hidden">
      {/* decoración */}
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-[#F97316]/15 blur-2xl" />
      <div className="absolute -left-8 -bottom-12 w-32 h-32 rounded-full bg-[#F97316]/10 blur-2xl" />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#F97316] flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" />
            Próximo partido · {torneo}
          </span>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F97316] text-white shadow">
            {countdown}
          </span>
        </div>

        <div className="flex items-center justify-center gap-3 md:gap-6 text-center">
          <div className="flex-1 min-w-0">
            <p className="font-serif font-black text-base md:text-xl truncate">{esLocal ? miEquipo : rival}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">{esLocal ? "Local" : "Visitante"}</p>
          </div>
          <span className="font-serif font-black text-2xl md:text-3xl text-[#F97316] shrink-0">VS</span>
          <div className="flex-1 min-w-0">
            <p className="font-serif font-black text-base md:text-xl truncate">{esLocal ? rival : miEquipo}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">{esLocal ? "Visitante" : "Local"}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-5 text-[12px] text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="w-3.5 h-3.5 text-[#F97316]" />
            {fechaLinda} · {horaLinda} hs
          </span>
          {cancha && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
              {cancha}
            </span>
          )}
        </div>

        <Link
          href={hrefPartidos}
          className="mx-auto inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#ea580c] active:scale-[0.98] transition text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md"
        >
          Ver mis partidos
        </Link>
      </div>
    </section>
  );
}
