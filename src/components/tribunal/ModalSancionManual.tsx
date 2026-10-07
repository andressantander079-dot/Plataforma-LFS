"use client";

import { useState, useTransition } from "react";
import { X, Search, UserRound, UserCog, Building2, Loader2, CircleAlert } from "lucide-react";
import { buscarJugadorDniAction } from "@/lib/actions/pases.actions";
import {
  crearSancionManual,
  type InfraccionCatalogo,
  type OpcionBasica,
} from "@/lib/actions/tribunal.actions";
import {
  ETIQUETA_TIPO_SANCIONADO,
  TIPOS_SANCIONADO,
  validarSancionManual,
  formatoPesos,
  type TipoSancionado,
} from "@/lib/core/rules/tribunalRules";

/**
 * MODAL — Nueva sanción manual del tribunal.
 * Tres destinatarios posibles: jugador (búsqueda por DNI), cuerpo técnico
 * (nombre libre) o el club completo (institucional, solo multa).
 * La infracción puede salir del catálogo (precarga fechas/multa) o ser texto libre.
 */

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  catalogo: InfraccionCatalogo[];
  clubes: OpcionBasica[];
  competencias: OpcionBasica[];
}

const ICONO_TIPO: Record<TipoSancionado, typeof UserRound> = {
  jugador: UserRound,
  cuerpo_tecnico: UserCog,
  club: Building2,
};

interface JugadorElegido {
  id: string;
  nombre: string;
  dni: string;
  clubNombre: string | null;
  clubId: string | null;
}

export function ModalSancionManual({ abierto, alCerrar, catalogo, clubes, competencias }: Props) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  const [tipo, setTipo] = useState<TipoSancionado>("jugador");
  const [dni, setDni] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [jugador, setJugador] = useState<JugadorElegido | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [nombreLibre, setNombreLibre] = useState("");
  const [clubId, setClubId] = useState("");
  const [infraccionId, setInfraccionId] = useState("");
  const [infraccionLibre, setInfraccionLibre] = useState("");
  const [fechas, setFechas] = useState(0);
  const [montoMulta, setMontoMulta] = useState(0);
  const [competitionId, setCompetitionId] = useState("");

  if (!abierto) return null;

  const catalogoActivo = catalogo.filter(
    (c) => c.activo && (c.aplicaA === tipo || c.aplicaA === "todos")
  );

  const buscarPorDni = async () => {
    setErrorBusqueda(null);
    setJugador(null);
    setBuscando(true);
    try {
      const res = await buscarJugadorDniAction(dni);
      if (!res.success || !res.data) {
        setErrorBusqueda(res.error ?? "No se pudo buscar el DNI.");
      } else if (!res.data.encontrado || !res.data.player) {
        setErrorBusqueda("No existe ningún jugador con ese DNI.");
      } else {
        setJugador({
          id: res.data.player.id,
          nombre: `${res.data.player.first_name} ${res.data.player.last_name}`,
          dni: res.data.player.dni,
          clubNombre: res.data.clubActual?.name ?? null,
          clubId: res.data.clubActual?.id ?? null,
        });
        // Autocompletamos el club con el club actual del jugador
        if (res.data.clubActual?.id) setClubId(res.data.clubActual.id);
      }
    } finally {
      setBuscando(false);
    }
  };

  const aplicarCatalogo = (id: string) => {
    setInfraccionId(id);
    const item = catalogo.find((c) => c.id === id);
    if (item) {
      setFechas(tipo === "club" ? 0 : item.fechasDefault);
      setMontoMulta(item.multaDefault);
    }
  };

  const cerrarYLimpiar = () => {
    setError(null);
    setExito(false);
    setJugador(null);
    setDni("");
    setErrorBusqueda(null);
    setNombreLibre("");
    setClubId("");
    setInfraccionId("");
    setInfraccionLibre("");
    setFechas(0);
    setMontoMulta(0);
    setCompetitionId("");
    alCerrar();
  };

  const confirmar = () => {
    setError(null);
    const infraccionFinal = infraccionId
      ? (catalogo.find((c) => c.id === infraccionId)?.nombre ?? "")
      : infraccionLibre;

    const valido = validarSancionManual({
      sancionadoTipo: tipo,
      playerId: jugador?.id ?? null,
      nombreLibre,
      clubId,
      infraccion: infraccionFinal,
      fechas,
      montoMulta,
    });
    if (!valido.ok) {
      setError(valido.error ?? "Revisá los datos.");
      return;
    }

    const fd = new FormData();
    fd.set("sancionadoTipo", tipo);
    if (jugador) fd.set("playerId", jugador.id);
    fd.set("nombreLibre", nombreLibre);
    fd.set("clubId", clubId);
    fd.set("infraccion", infraccionFinal);
    fd.set("fechas", String(fechas));
    fd.set("montoMulta", String(montoMulta));
    if (competitionId) fd.set("competitionId", competitionId);

    startTransition(async () => {
      const res = await crearSancionManual(fd);
      if (res?.error) {
        setError(res.error);
      } else {
        setExito(true);
        setTimeout(cerrarYLimpiar, 900);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={cerrarYLimpiar}
    >
      <div
        className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1A2A44] to-[#25375a] text-white px-5 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl z-10">
          <div>
            <h3 className="font-serif text-base font-black">Nueva sanción manual</h3>
            <p className="text-[10px] text-slate-300">
              El tribunal resuelve y la multa se carga sola en tesorería.
            </p>
          </div>
          <button onClick={cerrarYLimpiar} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* ¿A quién se sanciona? */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Sancionar a
            </span>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {TIPOS_SANCIONADO.map((t) => {
                const Icono = ICONO_TIPO[t];
                const activo = tipo === t;
                return (
                  <button
                    key={t}
                    onClick={() => {
                      setTipo(t);
                      setJugador(null);
                      setError(null);
                      if (t === "club") setFechas(0);
                    }}
                    className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 text-[11px] font-bold transition ${
                      activo
                        ? "border-[#F97316] bg-[#F97316]/5 text-[#F97316]"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    <Icono className="w-5 h-5" />
                    {ETIQUETA_TIPO_SANCIONADO[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Identificación según el tipo */}
          {tipo === "jugador" && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Jugador (por DNI)
              </label>
              <div className="flex gap-2">
                <input
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  inputMode="numeric"
                  placeholder="Ej: 45678901"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
                  onKeyDown={(e) => e.key === "Enter" && buscarPorDni()}
                />
                <button
                  onClick={buscarPorDni}
                  disabled={buscando || dni.length < 6}
                  className="px-4 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                >
                  {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Buscar
                </button>
              </div>
              {errorBusqueda && (
                <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                  <CircleAlert className="w-3.5 h-3.5" /> {errorBusqueda}
                </p>
              )}
              {jugador && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs">
                  <p className="font-black text-emerald-800">{jugador.nombre}</p>
                  <p className="text-emerald-700">
                    DNI {jugador.dni} · {jugador.clubNombre ?? "Sin club actual"}
                  </p>
                </div>
              )}
            </div>
          )}

          {tipo === "cuerpo_tecnico" && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Nombre y apellido
              </label>
              <input
                value={nombreLibre}
                onChange={(e) => setNombreLibre(e.target.value)}
                placeholder="Ej: Marcos Pérez (DT)"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
            </div>
          )}

          {/* Club responsable */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Club responsable {tipo === "club" ? "(el sancionado)" : ""}
            </label>
            <select
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
            >
              <option value="">Elegí un club…</option>
              {clubes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Infracción: catálogo + texto libre */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Infracción
            </label>
            <select
              value={infraccionId}
              onChange={(e) => aplicarCatalogo(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
            >
              <option value="">— Escribir motivo libre —</option>
              {catalogoActivo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.fechasDefault > 0 ? ` · ${c.fechasDefault} fecha${c.fechasDefault > 1 ? "s" : ""}` : ""}
                  {c.multaDefault > 0 ? ` · ${formatoPesos(c.multaDefault)}` : ""}
                </option>
              ))}
            </select>
            {!infraccionId && (
              <textarea
                value={infraccionLibre}
                onChange={(e) => setInfraccionLibre(e.target.value)}
                rows={2}
                placeholder="Describí la infracción…"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 resize-none"
              />
            )}
          </div>

          {/* Torneo (opcional) */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Torneo (opcional)
            </label>
            <select
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
            >
              <option value="">General (sin torneo específico)</option>
              {competencias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Fechas + multa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Fechas de suspensión
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={fechas}
                disabled={tipo === "club"}
                onChange={(e) => setFechas(Math.max(0, Math.min(30, Number(e.target.value) || 0)))}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
              {tipo === "club" && (
                <p className="text-[10px] text-slate-400">
                  Las sanciones al club son solo económicas.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Multa ($)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={montoMulta}
                onChange={(e) => setMontoMulta(Math.max(0, Number(e.target.value) || 0))}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
              {montoMulta > 0 && (
                <p className="text-[10px] text-slate-400">
                  Se genera un cargo de {formatoPesos(montoMulta)} en tesorería.
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-center gap-1.5">
              <CircleAlert className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}
          {exito && (
            <p className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
              Sanción cargada correctamente.
            </p>
          )}

          <button
            onClick={confirmar}
            disabled={pendiente}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#ea580c] text-white text-sm font-black shadow-lg shadow-[#F97316]/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pendiente && <Loader2 className="w-4 h-4 animate-spin" />}
            {pendiente ? "Cargando…" : "Cargar sanción"}
          </button>
        </div>
      </div>
    </div>
  );
}
