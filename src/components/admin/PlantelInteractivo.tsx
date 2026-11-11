"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  ArrowLeft,
  Plus,
  FileText,
  KeyRound,
  UserRound,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ClipboardList,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { PanelInscribirJugador } from "@/components/admin/PanelInscribirJugador";
import { PanelCredencialesClub } from "@/components/admin/PanelCredencialesClub";
import { CeldaDocumento } from "@/components/admin/CeldaDocumento";
import { cambiarEstadoInscripcionJugador } from "@/lib/actions/tramites.actions";
import {
  DOCUMENTOS_INSCRIPCION,
  calcularEdad,
  calcularEsMenor,
  contarDocumentosRequeridos,
  estadoJugadorInfo,
  resumirPlantel,
  type EstadoJugador,
} from "@/lib/core/rules/jugadoresRules";

/**
 * PLANTEL INTERACTIVO (Admin)
 * Gestión integral del plantel del club:
 * - KPIs de habilitación reglamentaria y estado documental (4 documentos LFS).
 * - Filtros por estado ('pendiente', 'en_deuda', 'activo', 'denegado') y buscador.
 * - Subida y visualización directa de los 4 documentos obligatorios de inscripción.
 * - Dictamen rápido de estado federativo (Aprobar / En deuda / Denegar).
 * - Panel lateral de inscripción y de credenciales del club.
 */

export interface JugadorPlantel {
  id: string;
  dni: string;
  fullName: string;
  status: EstadoJugador;
  fechaNacimiento?: string | null;
  fotoUrl?: string | null;
  numeroCamiseta?: number | null;
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

type FiltroEstado = "todos" | "pendiente" | "en_deuda" | "activo" | "denegado" | "inactivo";

const COLUMNAS_DOCS = [
  { clave: "dni" as const, corto: "DNI", titulo: "DNI (foto o escaneo)" },
  { clave: "cemad_medico" as const, corto: "CEMAD Méd.", titulo: "CEMAD médico (aptitud física)" },
  { clave: "cemad_autorizacion" as const, corto: "CEMAD Aut.", titulo: "CEMAD de autorización" },
  { clave: "comprobante_federacion" as const, corto: "Pago Fed.", titulo: "Comprobante de pago de federación" },
];

export function PlantelInteractivo({
  clubId,
  clubName,
  jugadores,
  categories,
  usuarios,
  abrirPanelInicial,
}: Props) {
  const router = useRouter();
  const [panelJugador, setPanelJugador] = useState(abrirPanelInicial);
  const [panelCredenciales, setPanelCredenciales] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [, startTransition] = useTransition();

  const resumen = useMemo(() => resumirPlantel(jugadores), [jugadores]);

  const jugadoresFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return jugadores.filter((p) => {
      if (filtroEstado !== "todos" && p.status !== filtroEstado) return false;
      if (q) {
        const texto = `${p.fullName} ${p.dni} ${p.categories.join(" ")}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [jugadores, filtroEstado, busqueda]);

  function handleDictaminar(
    jugador: JugadorPlantel,
    nuevoEstado: "activo" | "en_deuda" | "denegado"
  ) {
    if (jugador.status === nuevoEstado) return;
    setProcesandoId(jugador.id);
    setAviso(null);

    startTransition(async () => {
      const res = await cambiarEstadoInscripcionJugador(jugador.id, nuevoEstado);
      setProcesandoId(null);
      if (!res.ok) {
        setAviso({ tipo: "error", texto: res.error ?? "No se pudo cambiar el estado." });
      } else {
        const etiquetas: Record<string, string> = {
          activo: "aprobado (Activo)",
          en_deuda: "colocado en deuda (activo temporal)",
          denegado: "denegado",
        };
        setAviso({
          tipo: "ok",
          texto: `Estado de ${jugador.fullName} actualizado: ${etiquetas[nuevoEstado]}.`,
        });
        router.refresh();
      }
    });
  }

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
              Administración de fichajes, los 4 documentos reglamentarios de inscripción y estados de habilitación.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
          {resumen.pendientes > 0 && (
            <Link
              href="/admin/tramites"
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition text-xs justify-center"
            >
              <ClipboardList className="w-4 h-4 text-amber-700" />
              <span>{resumen.pendientes} en Trámites</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setPanelJugador(true)}
            id="btn-add-player"
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-[#F97316]/20 text-xs justify-center flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4" />
            Inscribir Jugador
          </button>
        </div>
      </section>

      {/* Tarjetas de Resumen del Plantel */}
      {jugadores.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setFiltroEstado("todos")}
            className={`text-left p-3.5 rounded-2xl border transition ${
              filtroEstado === "todos"
                ? "bg-[#1A2A44] text-white border-[#1A2A44] shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300 text-[#1A2A44]"
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider ${filtroEstado === "todos" ? "text-slate-300" : "text-slate-400"}`}>
              Total Plantel
            </p>
            <p className="text-2xl font-black mt-0.5">{resumen.total}</p>
            <p className={`text-[10px] mt-0.5 ${filtroEstado === "todos" ? "text-slate-300" : "text-slate-500"}`}>
              {resumen.habilitados} habilitados planilla
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado(filtroEstado === "pendiente" ? "todos" : "pendiente")}
            className={`text-left p-3.5 rounded-2xl border transition ${
              filtroEstado === "pendiente"
                ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                : "bg-amber-50/70 border-amber-200 hover:bg-amber-100/70 text-amber-900"
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${filtroEstado === "pendiente" ? "text-amber-100" : "text-amber-700"}`}>
              <Clock className="w-3 h-3" /> Pendientes LFS
            </p>
            <p className="text-2xl font-black mt-0.5">{resumen.pendientes}</p>
            <p className={`text-[10px] mt-0.5 ${filtroEstado === "pendiente" ? "text-amber-100" : "text-amber-700"}`}>
              En revisión federativa
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado(filtroEstado === "en_deuda" ? "todos" : "en_deuda")}
            className={`text-left p-3.5 rounded-2xl border transition ${
              filtroEstado === "en_deuda"
                ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                : "bg-orange-50/70 border-orange-200 hover:bg-orange-100/70 text-orange-900"
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${filtroEstado === "en_deuda" ? "text-orange-100" : "text-orange-700"}`}>
              <AlertTriangle className="w-3 h-3" /> En Deuda
            </p>
            <p className="text-2xl font-black mt-0.5">{resumen.enDeuda}</p>
            <p className={`text-[10px] mt-0.5 ${filtroEstado === "en_deuda" ? "text-orange-100" : "text-orange-700"}`}>
              Activo provisorio
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado(filtroEstado === "activo" ? "todos" : "activo")}
            className={`text-left p-3.5 rounded-2xl border transition ${
              filtroEstado === "activo"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                : "bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/70 text-emerald-900"
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${filtroEstado === "activo" ? "text-emerald-100" : "text-emerald-700"}`}>
              <CheckCircle className="w-3 h-3" /> Activos
            </p>
            <p className="text-2xl font-black mt-0.5">{resumen.activos}</p>
            <p className={`text-[10px] mt-0.5 ${filtroEstado === "activo" ? "text-emerald-100" : "text-emerald-700"}`}>
              Aprobados para jugar
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado(filtroEstado === "denegado" ? "todos" : "denegado")}
            className={`text-left p-3.5 rounded-2xl border transition col-span-2 sm:col-span-1 ${
              filtroEstado === "denegado"
                ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                : "bg-rose-50/70 border-rose-200 hover:bg-rose-100/70 text-rose-900"
            }`}
          >
            <p className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${filtroEstado === "denegado" ? "text-rose-100" : "text-rose-700"}`}>
              <XCircle className="w-3 h-3" /> Denegados
            </p>
            <p className="text-2xl font-black mt-0.5">{resumen.denegados}</p>
            <p className={`text-[10px] mt-0.5 ${filtroEstado === "denegado" ? "text-rose-100" : "text-rose-700"}`}>
              No habilitados
            </p>
          </button>
        </section>
      )}

      {/* Aviso de operación */}
      {aviso && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            aviso.tipo === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{aviso.texto}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="text-[10px] underline opacity-75 hover:opacity-100"
          >
            Cerrar
          </button>
        </div>
      )}

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
          <>
            {/* Barra de búsqueda y filtro rápido */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por apellido, nombre, DNI o categoría..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
                />
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                {resumen.conDocsIncompletos > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                    {resumen.conDocsIncompletos} con docs incompletos
                  </span>
                )}
                <span className="font-semibold">
                  Mostrando {jugadoresFiltrados.length} de {jugadores.length}
                </span>
              </div>
            </div>

            {jugadoresFiltrados.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No hay jugadores que coincidan con el filtro seleccionado.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-150 text-left">
                    <th className="py-3 px-3">Jugador</th>
                    <th className="py-3 px-3">DNI / Edad</th>
                    <th className="py-3 px-3">Categorías</th>
                    {COLUMNAS_DOCS.map((doc) => (
                      <th key={doc.clave} className="py-3 px-2 text-center" title={doc.titulo}>
                        {doc.corto}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center">Estado LFS</th>
                    <th className="py-3 px-3 text-right">Dictamen Rápido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {jugadoresFiltrados.map((player) => {
                    const edad = player.fechaNacimiento ? calcularEdad(player.fechaNacimiento) : null;
                    const esMenor = player.fechaNacimiento ? calcularEsMenor(player.fechaNacimiento) : false;
                    const cantDocs = contarDocumentosRequeridos(player.documents);
                    const infoEstado = estadoJugadorInfo(player.status);
                    const procesando = procesandoId === player.id;

                    return (
                      <tr key={player.id} className="hover:bg-slate-50/60 transition">
                        {/* Jugador + Foto + Menor */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            {player.fotoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={player.fotoUrl}
                                alt={player.fullName}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#1A2A44]/10 text-[#1A2A44] flex items-center justify-center text-xs font-black shrink-0">
                                {player.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[#1A2A44] text-sm truncate">
                                  {player.fullName}
                                </span>
                                {player.numeroCamiseta && (
                                  <span
                                    className="px-1.5 py-0.5 rounded bg-orange-100 text-[#F97316] font-mono text-[10px] font-black border border-orange-200"
                                    title={`Camiseta #${player.numeroCamiseta}`}
                                  >
                                    #{player.numeroCamiseta}
                                  </span>
                                )}
                                {esMenor && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-black uppercase">
                                    Menor
                                  </span>
                                )}
                              </div>
                              <span
                                className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  cantDocs === DOCUMENTOS_INSCRIPCION.length
                                    ? "text-emerald-700 bg-emerald-50"
                                    : "text-amber-700 bg-amber-50"
                                }`}
                              >
                                {cantDocs}/{DOCUMENTOS_INSCRIPCION.length} docs
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* DNI y Edad */}
                        <td className="py-3.5 px-3">
                          <p className="font-mono text-slate-700 text-xs font-bold">{player.dni}</p>
                          {edad !== null && (
                            <p className="text-[10px] text-slate-400">{edad} años</p>
                          )}
                        </td>

                        {/* Categorías */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {player.categories.map((cat) => (
                              <span
                                key={cat}
                                className="px-2 py-0.5 rounded-full bg-[#1A2A44]/5 text-[#1A2A44] text-[10px] font-bold"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* 4 Documentos Oficiales de Inscripción */}
                        {COLUMNAS_DOCS.map((doc) => (
                          <td key={doc.clave} className="py-3.5 px-2 text-center">
                            <CeldaDocumento
                              clubId={clubId}
                              playerId={player.id}
                              tipo={doc.clave}
                              ruta={player.documents[doc.clave] ?? null}
                              titulo={doc.titulo}
                            />
                          </td>
                        ))}

                        {/* Estado LFS */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            title={infoEstado.descripcion}
                            className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-full border ${infoEstado.badgeClase}`}
                          >
                            {infoEstado.label}
                          </span>
                        </td>

                        {/* Acciones de dictamen rápido */}
                        <td className="py-3.5 px-3 text-right">
                          {procesando ? (
                            <Loader2 className="w-4 h-4 text-[#F97316] animate-spin inline-block" />
                          ) : (
                            <div className="inline-flex items-center justify-end gap-1">
                              {player.status !== "activo" && (
                                <button
                                  type="button"
                                  onClick={() => handleDictaminar(player, "activo")}
                                  title="Aprobar inscripción (queda Activo para planillas)"
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition"
                                >
                                  Aprobar
                                </button>
                              )}
                              {player.status !== "en_deuda" && (
                                <button
                                  type="button"
                                  onClick={() => handleDictaminar(player, "en_deuda")}
                                  title="Colocar en deuda (activo temporalmente hasta cierre de inscripción)"
                                  className="px-2 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold transition"
                                >
                                  En deuda
                                </button>
                              )}
                              {player.status !== "denegado" && (
                                <button
                                  type="button"
                                  onClick={() => handleDictaminar(player, "denegado")}
                                  title="Denegar inscripción (no podrá ser incluido en planillas)"
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition"
                                >
                                  Denegar
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Info Box */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-[#F97316] shrink-0" />
            <p>
              Límite de planilla reglamentaria: Mínimo 12 y máximo 25 jugadores habilitados (Activos o En deuda) por categoría.
              Hacé clic en <strong>Subir</strong> o <strong>Ver</strong> en cada columna para gestionar los 4 documentos de la federación.
            </p>
          </div>
          <Link
            href="/admin/tramites"
            className="text-[#1A2A44] hover:text-[#F97316] font-bold text-xs shrink-0 hover:underline"
          >
            Ir a Bandeja de Trámites →
          </Link>
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
