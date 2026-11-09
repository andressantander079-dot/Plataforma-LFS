"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  CircleAlert,
  ClipboardList,
  FileSpreadsheet,
  Filter,
  Loader2,
  Medal,
  Shield,
  ShieldCheck,
  Store,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  obtenerEstadisticasGlobales,
  type EstadisticasGlobales,
  type FiltrosEstadisticas,
  type RankingClub,
  type RankingJugador,
} from "@/lib/actions/estadisticas-globales.actions";

const dinero = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * ESTADÍSTICAS GLOBALES (Paso 17B): KPIs reales + evolución 6 meses +
 * rankings (jugadores y clubes), con filtro por torneo/temporada y
 * exportación a Excel con UNA HOJA POR SECCIÓN (librería xlsx, carga
 * dinámica solo al exportar).
 */
export function EstadisticasGlobalesPanel({
  filtros,
  datosIniciales,
}: {
  filtros: FiltrosEstadisticas;
  datosIniciales: EstadisticasGlobales;
}) {
  const [competitionId, setCompetitionId] = useState<string>("");
  const [temporada, setTemporada] = useState<string>("");
  const [datos, setDatos] = useState(datosIniciales);
  const [error, setError] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [cargando, startTransition] = useTransition();

  const aplicarFiltros = (nuevoTorneo: string, nuevaTemporada: string) => {
    startTransition(async () => {
      try {
        const res = await obtenerEstadisticasGlobales({
          competitionId: nuevoTorneo || null,
          temporada: nuevaTemporada || null,
        });
        setDatos(res);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar las estadísticas.");
      }
    });
  };

  const cambiarTorneo = (id: string) => {
    setCompetitionId(id);
    aplicarFiltros(id, temporada);
  };
  const cambiarTemporada = (t: string) => {
    setTemporada(t);
    aplicarFiltros(competitionId, t);
  };

  // --- Exportación a Excel (xlsx se importa SOLO cuando se usa) -----------
  const exportarExcel = async () => {
    setExportando(true);
    try {
      const XLSX = await import("xlsx");
      const libro = XLSX.utils.book_new();
      const agregar = (nombre: string, filas: Record<string, unknown>[]) => {
        const hoja = XLSX.utils.json_to_sheet(
          filas.length > 0 ? filas : [{ "Sin datos": "—" }]
        );
        XLSX.utils.book_append_sheet(libro, hoja, nombre.slice(0, 31));
      };

      const { kpis } = datos;
      agregar("KPIs", [
        { Indicador: "Jugadores activos", Valor: kpis.jugadores },
        { Indicador: "Clubes habilitados", Valor: kpis.clubes },
        { Indicador: "Partidos jugados", Valor: kpis.partidosJugados },
        { Indicador: "Goles", Valor: kpis.goles },
        { Indicador: "Tarjetas amarillas", Valor: kpis.amarillas },
        { Indicador: "Tarjetas rojas", Valor: kpis.rojas },
        { Indicador: "Planillas aprobadas", Valor: kpis.planillasAprobadas },
        { Indicador: "Pases completados", Valor: kpis.pasesCompletados },
        { Indicador: "Recaudación (pagos aprobados)", Valor: kpis.recaudacion },
      ]);
      agregar(
        "Evolución",
        datos.evolucion.map((p) => ({ Mes: p.mes, Partidos: p.partidos, Goles: p.goles }))
      );
      agregar(
        "Goleadores",
        datos.goleadores.map((r, i) => ({
          Puesto: i + 1,
          Jugador: r.nombre,
          Equipo: r.equipo,
          Goles: r.valor,
        }))
      );
      agregar(
        "Disciplina jugadores",
        datos.disciplinaJugadores.map((r, i) => ({
          Puesto: i + 1,
          Jugador: r.nombre,
          Equipo: r.equipo,
          "Puntos disciplina": r.valor,
          Detalle: r.detalle,
        }))
      );
      agregar(
        "Clubes goleadores",
        datos.clubesGoleadores.map((r, i) => ({
          Puesto: i + 1,
          Equipo: r.equipo,
          Club: r.club,
          "Goles a favor": r.valor,
          Detalle: r.detalle,
        }))
      );
      agregar(
        "Fair play",
        datos.clubesFairPlay.map((r, i) => ({
          Puesto: i + 1,
          Equipo: r.equipo,
          Club: r.club,
          "Puntos disciplina": r.valor,
          Detalle: r.detalle,
        }))
      );
      agregar(
        "Fichas por club",
        datos.clubesFichas.map((r, i) => ({
          Puesto: i + 1,
          Equipo: r.equipo,
          Club: r.club,
          Tarjetas: r.valor,
          Detalle: r.detalle,
        }))
      );

      const torneo = filtros.torneos.find((t) => t.id === competitionId);
      const sufijo = [torneo?.nombre, temporada].filter(Boolean).join(" - ");
      XLSX.writeFile(
        libro,
        `estadisticas-lfs${sufijo ? ` - ${sufijo}` : ""}.xlsx`.toLowerCase().replace(/\s+/g, "-")
      );
    } catch {
      setError("No se pudo generar el Excel. Probá de nuevo.");
    } finally {
      setExportando(false);
    }
  };

  const { kpis } = datos;
  const maxPartidos = Math.max(1, ...datos.evolucion.map((p) => p.partidos));
  const maxGoles = Math.max(1, ...datos.evolucion.map((p) => p.goles));

  const tarjetaKpi = (
    titulo: string,
    valor: string,
    detalle: string,
    Icono: typeof Users,
    colorIcono: string
  ) => (
    <div
      key={titulo}
      className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${colorIcono}14`, color: colorIcono }}
      >
        <Icono className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
          {titulo}
        </span>
        <span className="text-lg font-serif font-black text-[#1A2A44] block leading-tight truncate">
          {valor}
        </span>
        <span className="text-[10px] text-slate-400 font-semibold">{detalle}</span>
      </div>
    </div>
  );

  const tablaJugadores = (
    titulo: string,
    Icono: typeof Trophy,
    color: string,
    filas: RankingJugador[],
    columna: string
  ) => (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <h3 className="px-5 py-4 font-serif text-base font-black text-[#1A2A44] flex items-center gap-2 border-b border-slate-100">
        <Icono className="w-5 h-5" style={{ color }} /> {titulo}
      </h3>
      {filas.length === 0 ? (
        <p className="px-5 py-6 text-xs text-slate-400 font-semibold">
          Todavía no hay datos con este filtro.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
              <th className="text-left px-5 py-2 w-8">#</th>
              <th className="text-left px-2 py-2">Jugador</th>
              <th className="text-left px-2 py-2 hidden sm:table-cell">Equipo</th>
              <th className="text-right px-5 py-2">{columna}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r, i) => (
              <tr key={r.jugadorId} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2.5">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                      i === 0
                        ? "bg-[#F97316] text-white"
                        : i < 3
                          ? "bg-orange-100 text-[#F97316]"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-2 py-2.5 font-bold text-[#1A2A44]">{r.nombre}</td>
                <td className="px-2 py-2.5 text-xs text-slate-500 hidden sm:table-cell">
                  {r.equipo}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className="font-black text-[#1A2A44]">{r.valor}</span>
                  <span className="block text-[10px] text-slate-400">{r.detalle}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const tablaClubes = (
    titulo: string,
    Icono: typeof Trophy,
    color: string,
    filas: RankingClub[],
    columna: string,
    invertido = false
  ) => (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <h3 className="px-5 py-4 font-serif text-base font-black text-[#1A2A44] flex items-center gap-2 border-b border-slate-100">
        <Icono className="w-5 h-5" style={{ color }} /> {titulo}
      </h3>
      {filas.length === 0 ? (
        <p className="px-5 py-6 text-xs text-slate-400 font-semibold">
          Todavía no hay datos con este filtro.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
              <th className="text-left px-5 py-2 w-8">#</th>
              <th className="text-left px-2 py-2">Equipo</th>
              <th className="text-left px-2 py-2 hidden sm:table-cell">Club</th>
              <th className="text-right px-5 py-2">{columna}</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r, i) => (
              <tr key={r.teamId} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2.5">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                      i === 0
                        ? invertido
                          ? "bg-emerald-500 text-white"
                          : "bg-[#F97316] text-white"
                        : i < 3
                          ? invertido
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-orange-100 text-[#F97316]"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                </td>
                <td className="px-2 py-2.5 font-bold text-[#1A2A44]">{r.equipo}</td>
                <td className="px-2 py-2.5 text-xs text-slate-500 hidden sm:table-cell">
                  {r.club}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className="font-black text-[#1A2A44]">{r.valor}</span>
                  <span className="block text-[10px] text-slate-400">{r.detalle}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Filtros + exportar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl px-3 py-2 shadow-sm">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={temporada}
            onChange={(e) => cambiarTemporada(e.target.value)}
            className="text-xs font-bold text-[#1A2A44] bg-transparent focus:outline-none"
          >
            <option value="">Todas las temporadas</option>
            {filtros.temporadas.map((t) => (
              <option key={t} value={t}>
                Temporada {t}
              </option>
            ))}
          </select>
          <span className="w-px h-4 bg-slate-200" />
          <select
            value={competitionId}
            onChange={(e) => cambiarTorneo(e.target.value)}
            className="text-xs font-bold text-[#1A2A44] bg-transparent focus:outline-none max-w-[180px] sm:max-w-none"
          >
            <option value="">Todos los torneos</option>
            {filtros.torneos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.categoria ? ` · ${t.categoria}` : ""} ({t.temporada})
              </option>
            ))}
          </select>
          {cargando && <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />}
        </div>
        <button
          type="button"
          onClick={exportarExcel}
          disabled={exportando}
          className="ml-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest transition flex items-center gap-1.5 disabled:opacity-60"
        >
          {exportando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          Exportar Excel
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-xs font-bold">
          <CircleAlert className="w-4 h-4" /> {error}
        </div>
      )}

      {/* KPIs */}
      <div
        className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 transition-opacity ${cargando ? "opacity-50" : ""}`}
      >
        {tarjetaKpi("Jugadores", String(kpis.jugadores), "activos en la liga", Users, "#2563EB")}
        {tarjetaKpi("Clubes", String(kpis.clubes), "habilitados", Store, "#0F766E")}
        {tarjetaKpi(
          "Partidos",
          String(kpis.partidosJugados),
          "con resultado confirmado",
          Trophy,
          "#7C3AED"
        )}
        {tarjetaKpi("Goles", String(kpis.goles), "en partidos jugados", TrendingUp, "#F97316")}
        {tarjetaKpi("Amarillas", String(kpis.amarillas), "tarjetas", CircleAlert, "#EAB308")}
        {tarjetaKpi("Rojas", String(kpis.rojas), "tarjetas", CircleAlert, "#DC2626")}
        {tarjetaKpi(
          "Planillas",
          String(kpis.planillasAprobadas),
          "aprobadas",
          ClipboardList,
          "#1A2A44"
        )}
        {tarjetaKpi(
          "Recaudación",
          dinero(kpis.recaudacion),
          `${kpis.pasesCompletados} pases completados`,
          Banknote,
          "#059669"
        )}
      </div>

      {/* Evolución 6 meses */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <h3 className="font-serif text-base font-black text-[#1A2A44] mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#F97316]" /> Evolución — últimos 6 meses
        </h3>
        <div className="grid grid-cols-6 gap-2">
          {datos.evolucion.map((p) => (
            <div key={p.mes} className="flex flex-col items-center gap-1">
              <div className="flex items-end gap-1 h-28 w-full justify-center">
                <div
                  className="w-3 sm:w-5 bg-[#1A2A44]/85 rounded-t min-h-[2px]"
                  style={{ height: `${(p.partidos / maxPartidos) * 100}%` }}
                  title={`${p.partidos} partidos`}
                />
                <div
                  className="w-3 sm:w-5 bg-[#F97316]/85 rounded-t min-h-[2px]"
                  style={{ height: `${(p.goles / maxGoles) * 100}%` }}
                  title={`${p.goles} goles`}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-400 capitalize">{p.etiqueta}</span>
              <span className="text-[9px] font-black text-slate-500">
                {p.partidos} PJ · {p.goles} G
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 justify-center">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#1A2A44]/85" /> Partidos jugados
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#F97316]/85" /> Goles
          </span>
        </div>
      </div>

      {/* Rankings de jugadores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tablaJugadores("Goleadores", Trophy, "#F97316", datos.goleadores, "Goles")}
        {tablaJugadores(
          "Disciplina (jugadores)",
          Shield,
          "#DC2626",
          datos.disciplinaJugadores,
          "Puntos"
        )}
      </div>

      {/* Rankings de clubes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {tablaClubes("Clubes goleadores", Medal, "#F97316", datos.clubesGoleadores, "GF")}
        {tablaClubes(
          "Fair play",
          ShieldCheck,
          "#059669",
          datos.clubesFairPlay,
          "Pts disciplina",
          true
        )}
        {tablaClubes("Fichas por club", Shield, "#DC2626", datos.clubesFichas, "Tarjetas")}
      </div>

      <p className="text-[10px] text-slate-400 text-center pb-2">
        Fair play: 1 punto por amarilla y 2 por roja, por partido jugado (mínimo 3 partidos).
        Menos puntos = mejor conducta.
      </p>
    </div>
  );
}
