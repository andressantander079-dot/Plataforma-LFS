"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Megaphone,
  Users,
  Flag,
  X,
  Send,
  Loader2,
  Paperclip,
  FileText,
  CheckCircle2,
  Lock,
  Eye,
  Save,
  CalendarClock,
  Sparkles,
  Trash2,
  Plus,
  AlertTriangle,
  UploadCloud,
  Tag,
  ShieldAlert,
  Pencil,
  Clock,
} from "lucide-react";
import { EditorTextoEnriquecido } from "./EditorTextoEnriquecido";
import {
  enviarComunicado,
  subirAdjuntoComunicadoAction,
  guardarBorradorAdmin,
  obtenerPlantillasAdmin,
  guardarPlantillaAdmin,
  eliminarPlantillaAdmin,
  enviarMensajeClub,
  subirAdjuntoClubAction,
  guardarBorradorClub,
  obtenerPlantillasClub,
  guardarPlantillaClub,
  eliminarPlantillaClub,
  obtenerUrlAdjunto,
  type ConversacionResumen,
  type BorradorComunicado,
  type PlantillaMensaje,
} from "@/lib/actions/mensajeria.actions";
import {
  CATEGORIAS_MENSAJE,
  PRIORIDADES_MENSAJE,
  validarArchivoAdjunto,
  formatearTamanioArchivo,
  validarFechaProgramada,
  textoPlanoDeHtml,
  type PrioridadMensaje,
  type AdjuntoMetadata,
} from "@/lib/core/rules/mensajeriaRules";

/**
 * COMPOSITOR EMPRESARIAL PREMIUM DE COMUNICADOS OFICIALES — Liga de Fútsal de Ushuaia
 * Incluye:
 *  - Selección individual, por búsqueda o masiva (clubes y árbitros) con chips removibles.
 *  - Asunto, Categorización y Nivel de Importancia (Normal, Importante, Urgente).
 *  - Editor WYSIWYG con 10 tipografías, tamaños de letra, colores, sangrías y listas.
 *  - Adjuntos e imágenes hasta 10 MB con Drag & Drop, barra de progreso y miniatura.
 *  - Guardado automático y manual de borradores con marca de última modificación.
 *  - Gestión completa de plantillas prediseñadas (aplicar, crear, editar, eliminar).
 *  - Programación de envíos con control de zona horaria (Ushuaia GMT-3).
 *  - Vista previa realista y confirmación antes de descartar cambios.
 */

interface PanelRedactarProps {
  destinatarios: ConversacionResumen[];
  borradorInicial?: BorradorComunicado | null;
  modoClub?: boolean;
  clubNombre?: string;
  onCerrar: () => void;
  onEnviado: (programado?: boolean) => void;
  onBorradorActualizado?: () => void;
}

interface AdjuntoLocal extends AdjuntoMetadata {
  previewUrl?: string;
}

function inicialesDe(nombre: string) {
  return (
    nombre
      .split(" ")
      .filter((p) => p.length > 2)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || nombre.slice(0, 2).toUpperCase()
  );
}

function horaFormateada(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function manianaFechaDefault(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function PanelRedactarComunicado({
  destinatarios,
  borradorInicial = null,
  modoClub = false,
  clubNombre = "Club Afiliado",
  onCerrar,
  onEnviado,
  onBorradorActualizado,
}: PanelRedactarProps) {
  const clubes = useMemo(
    () => destinatarios.filter((d) => d.tipoDestino === "club"),
    [destinatarios]
  );
  const arbitros = useMemo(
    () => destinatarios.filter((d) => d.tipoDestino === "arbitro"),
    [destinatarios]
  );

  // Estado de destinatarios
  const [seleccionClubes, setSeleccionClubes] = useState<Set<string>>(
    () => new Set(borradorInicial?.destinatarios?.clubes ?? [])
  );
  const [seleccionArbitros, setSeleccionArbitros] = useState<Set<string>>(
    () => new Set(borradorInicial?.destinatarios?.arbitros ?? [])
  );
  const [todosClubes, setTodosClubes] = useState<boolean>(
    borradorInicial?.destinatarios?.todosClubes ?? false
  );
  const [todosArbitros, setTodosArbitros] = useState<boolean>(
    borradorInicial?.destinatarios?.todosArbitros ?? false
  );
  const [busqueda, setBusqueda] = useState("");

  // Configuración del mensaje
  const [asunto, setAsunto] = useState(borradorInicial?.asunto ?? "");
  const [categoria, setCategoria] = useState<string>(
    borradorInicial?.categoria ?? CATEGORIAS_MENSAJE[0]
  );
  const [prioridad, setPrioridad] = useState<PrioridadMensaje>(
    borradorInicial?.prioridad ?? "normal"
  );
  const [cuerpoHtml, setCuerpoHtml] = useState(borradorInicial?.cuerpo_html ?? "");
  const [versionContenido, setVersionContenido] = useState(0);
  const [sinRespuestas, setSinRespuestas] = useState(
    borradorInicial?.sin_respuestas ?? false
  );

  // Adjuntos (hasta 10 MB por archivo)
  const [adjuntos, setAdjuntos] = useState<AdjuntoLocal[]>(
    () => borradorInicial?.adjuntos ?? []
  );
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [progresoSubida, setProgresoSubida] = useState(0);
  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  // Borradores (autoguardado + manual)
  const [borradorId, setBorradorId] = useState<string | undefined>(borradorInicial?.id);
  const [guardandoBorrador, setGuardandoBorrador] = useState(false);
  const [ultimoGuardadoIso, setUltimoGuardadoIso] = useState<string | null>(
    borradorInicial?.updated_at ?? null
  );
  const [sucio, setSucio] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  // Plantillas prediseñadas
  const [panelPlantillasAbierto, setPanelPlantillasAbierto] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>([]);
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false);
  const [filtroCategoriaPlantilla, setFiltroCategoriaPlantilla] = useState<string>("Todas");
  const [modoGuardarPlantilla, setModoGuardarPlantilla] = useState(false);
  const [plantillaEditandoId, setPlantillaEditandoId] = useState<string | undefined>(undefined);
  const [nombreNuevaPlantilla, setNombreNuevaPlantilla] = useState("");
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);

  // Programación de envío
  const [programarEnvio, setProgramarEnvio] = useState(false);
  const [fechaProgramada, setFechaProgramada] = useState(manianaFechaDefault);
  const [horaProgramada, setHoraProgramada] = useState("10:00");

  // Estado general de envío y vista previa
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `msg-${Date.now()}`
  );

  // Cargar plantillas cuando se abre el gestor
  useEffect(() => {
    if (!panelPlantillasAbierto) return;
    let activo = true;
    setCargandoPlantillas(true);
    const prom = modoClub ? obtenerPlantillasClub() : obtenerPlantillasAdmin();
    prom
      .then((lista) => {
        if (activo) setPlantillas(lista);
      })
      .finally(() => {
        if (activo) setCargandoPlantillas(false);
      });
    return () => {
      activo = false;
    };
  }, [panelPlantillasAbierto, modoClub]);

  // Resolver miniaturas para adjuntos de imagen que vienen de un borrador guardado
  useEffect(() => {
    adjuntos.forEach((adj) => {
      if (adj.type.startsWith("image/") && !adj.previewUrl && adj.path) {
        obtenerUrlAdjunto(adj.path).then((res) => {
          if ("url" in res && res.url) {
            setAdjuntos((prev) =>
              prev.map((item) =>
                item.path === adj.path ? { ...item, previewUrl: res.url } : item
              )
            );
          }
        });
      }
    });
  }, [adjuntos]);

  // Autoguardado inteligente cada 4 segundos cuando hay cambios
  useEffect(() => {
    if (!sucio || enviando) return;
    const tieneContenido =
      asunto.trim().length > 0 || textoPlanoDeHtml(cuerpoHtml, 10).trim().length > 0;
    if (!tieneContenido) return;

    const timer = setTimeout(async () => {
      setGuardandoBorrador(true);
      const fnGuardar = modoClub ? guardarBorradorClub : guardarBorradorAdmin;
      const res = await fnGuardar({
        id: borradorId,
        asunto,
        cuerpoHtml,
        categoria,
        prioridad,
        sinRespuestas: modoClub ? false : sinRespuestas,
        destinatarios: {
          todosClubes,
          todosArbitros,
          clubes: [...seleccionClubes],
          arbitros: [...seleccionArbitros],
        },
        adjuntos: adjuntos.map(({ path, name, type, size }) => ({
          path,
          name,
          type,
          size,
        })),
        esAutoguardado: true,
      });
      setGuardandoBorrador(false);
      if (res.ok && res.borrador) {
        setBorradorId(res.borrador.id);
        setUltimoGuardadoIso(res.borrador.updated_at);
        setSucio(false);
        onBorradorActualizado?.();
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [
    sucio,
    enviando,
    borradorId,
    asunto,
    cuerpoHtml,
    categoria,
    prioridad,
    sinRespuestas,
    todosClubes,
    todosArbitros,
    seleccionClubes,
    seleccionArbitros,
    adjuntos,
    modoClub,
    onBorradorActualizado,
  ]);

  function alternar(tipo: "club" | "arbitro", id: string) {
    setSucio(true);
    const set = tipo === "club" ? seleccionClubes : seleccionArbitros;
    const setSet = tipo === "club" ? setSeleccionClubes : setSeleccionArbitros;
    const nueva = new Set(set);
    if (nueva.has(id)) nueva.delete(id);
    else nueva.add(id);
    setSet(nueva);
  }

  function quitarDestinatarioIndividual(tipo: "club" | "arbitro", id: string) {
    setSucio(true);
    if (tipo === "club") {
      const nueva = new Set(seleccionClubes);
      nueva.delete(id);
      setSeleccionClubes(nueva);
    } else {
      const nueva = new Set(seleccionArbitros);
      nueva.delete(id);
      setSeleccionArbitros(nueva);
    }
  }

  const totalSeleccionados = modoClub
    ? 1
    : (todosClubes ? clubes.length : seleccionClubes.size) +
      (todosArbitros ? arbitros.length : seleccionArbitros.size);

  const clubesVisibles = clubes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const arbitrosVisibles = arbitros.filter((a) =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Chips de destinatarios seleccionados
  const chipsSeleccionados = useMemo(() => {
    const chips: Array<{
      key: string;
      etiqueta: string;
      subtipo: "grupo" | "club" | "arbitro";
      onRemove: () => void;
    }> = [];

    if (todosClubes) {
      chips.push({
        key: "todos-clubes",
        etiqueta: `Todos los clubes (${clubes.length})`,
        subtipo: "grupo",
        onRemove: () => {
          setSucio(true);
          setTodosClubes(false);
        },
      });
    } else {
      for (const id of seleccionClubes) {
        const club = clubes.find((c) => c.destinoId === id);
        if (club) {
          chips.push({
            key: `club-${id}`,
            etiqueta: club.nombre,
            subtipo: "club",
            onRemove: () => quitarDestinatarioIndividual("club", id),
          });
        }
      }
    }

    if (todosArbitros) {
      chips.push({
        key: "todos-arbitros",
        etiqueta: `Todos los árbitros (${arbitros.length})`,
        subtipo: "grupo",
        onRemove: () => {
          setSucio(true);
          setTodosArbitros(false);
        },
      });
    } else {
      for (const id of seleccionArbitros) {
        const arb = arbitros.find((a) => a.destinoId === id);
        if (arb) {
          chips.push({
            key: `arbitro-${id}`,
            etiqueta: arb.nombre,
            subtipo: "arbitro",
            onRemove: () => quitarDestinatarioIndividual("arbitro", id),
          });
        }
      }
    }

    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todosClubes, todosArbitros, seleccionClubes, seleccionArbitros, clubes, arbitros]);

  // Subida de archivos con validación y barra de progreso
  async function procesarArchivosSeleccionados(listaArchivos: FileList | File[]) {
    const archivos = Array.from(listaArchivos);
    if (!archivos.length) return;
    setError(null);

    for (const archivo of archivos) {
      const validacion = validarArchivoAdjunto({
        name: archivo.name,
        type: archivo.type,
        size: archivo.size,
      });
      if (!validacion.ok) {
        setError(validacion.error ?? "Archivo inválido.");
        return;
      }

      setSubiendoArchivo(true);
      setProgresoSubida(20);
      const intervalo = setInterval(() => {
        setProgresoSubida((prev) => (prev < 85 ? prev + 15 : prev));
      }, 180);

      const fd = new FormData();
      fd.set("archivo", archivo);
      const fnSubir = modoClub ? subirAdjuntoClubAction : subirAdjuntoComunicadoAction;
      const res = await fnSubir(fd);

      clearInterval(intervalo);
      setProgresoSubida(100);

      if ("error" in res && res.error) {
        setSubiendoArchivo(false);
        setProgresoSubida(0);
        setError(res.error);
        return;
      }

      if ("adjunto" in res && res.adjunto) {
        const previewLocal = archivo.type.startsWith("image/")
          ? URL.createObjectURL(archivo)
          : undefined;
        setAdjuntos((prev) => [...prev, { ...res.adjunto, previewUrl: previewLocal }]);
        setSucio(true);
      }

      setTimeout(() => {
        setSubiendoArchivo(false);
        setProgresoSubida(0);
      }, 280);
    }

    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
  }

  function quitarAdjunto(path: string) {
    setSucio(true);
    setAdjuntos((prev) => prev.filter((a) => a.path !== path));
  }

  // Guardado manual de borrador
  async function manejarGuardarBorradorManual() {
    setError(null);
    setGuardandoBorrador(true);
    const fnBorrador = modoClub ? guardarBorradorClub : guardarBorradorAdmin;
    const res = await fnBorrador({
      id: borradorId,
      asunto: asunto || "Borrador sin asunto",
      cuerpoHtml,
      categoria,
      prioridad,
      sinRespuestas: modoClub ? false : sinRespuestas,
      destinatarios: {
        todosClubes,
        todosArbitros,
        clubes: [...seleccionClubes],
        arbitros: [...seleccionArbitros],
      },
      adjuntos: adjuntos.map(({ path, name, type, size }) => ({
        path,
        name,
        type,
        size,
      })),
      esAutoguardado: false,
    });
    setGuardandoBorrador(false);
    if (!res.ok || !res.borrador) {
      setError(res.error ?? "No se pudo guardar el borrador.");
      return;
    }
    setBorradorId(res.borrador.id);
    setUltimoGuardadoIso(res.borrador.updated_at);
    setSucio(false);
    onBorradorActualizado?.();
  }

  // Aplicar plantilla al editor
  function aplicarPlantilla(p: PlantillaMensaje) {
    setAsunto(p.asunto_sugerido);
    setCategoria(p.categoria);
    setPrioridad(p.prioridad_sugerida);
    setSinRespuestas(modoClub ? false : p.sin_respuestas_default);
    setCuerpoHtml(p.cuerpo_html);
    setVersionContenido((v) => v + 1);
    setSucio(true);
    setPanelPlantillasAbierto(false);
  }

  async function manejarGuardarPlantilla() {
    setError(null);
    setGuardandoPlantilla(true);
    const fnGuardarP = modoClub ? guardarPlantillaClub : guardarPlantillaAdmin;
    const res = await fnGuardarP({
      id: plantillaEditandoId,
      nombre: nombreNuevaPlantilla,
      categoria,
      asuntoSugerido: asunto,
      cuerpoHtml,
      prioridadSugerida: prioridad,
      sinRespuestasDefault: modoClub ? false : sinRespuestas,
    });
    setGuardandoPlantilla(false);
    if (!res.ok || !res.plantilla) {
      setError(res.error ?? "No se pudo guardar la plantilla.");
      return;
    }
    setPlantillas((prev) => {
      const sinAnterior = prev.filter((item) => item.id !== res.plantilla!.id);
      return [res.plantilla!, ...sinAnterior];
    });
    setModoGuardarPlantilla(false);
    setPlantillaEditandoId(undefined);
    setNombreNuevaPlantilla("");
  }

  async function manejarEliminarPlantilla(id: string) {
    const fnEliminarP = modoClub ? eliminarPlantillaClub : eliminarPlantillaAdmin;
    const res = await fnEliminarP(id);
    if (res.ok) {
      setPlantillas((prev) => prev.filter((p) => p.id !== id));
    }
  }

  function intentarCerrar() {
    const tieneCambios =
      sucio && (asunto.trim().length > 0 || textoPlanoDeHtml(cuerpoHtml, 10).trim().length > 0);
    if (tieneCambios) {
      setConfirmarDescarte(true);
      return;
    }
    onCerrar();
  }

  async function manejarEnvio() {
    if (enviando) return;
    setError(null);
    setExito(null);

    if (!totalSeleccionados) {
      setError("Elegí al menos un destinatario.");
      return;
    }

    let scheduledIso: string | undefined;
    if (programarEnvio) {
      // Construir fecha en zona horaria de Ushuaia (GMT-3)
      const isoUshuaia = `${fechaProgramada}T${horaProgramada}:00-03:00`;
      const valFecha = validarFechaProgramada(isoUshuaia);
      if (!valFecha.ok) {
        setError(valFecha.error ?? "Fecha de programación inválida.");
        return;
      }
      scheduledIso = valFecha.fecha!.toISOString();
    }

    setEnviando(true);
    const formData = new FormData();
    formData.set("asunto", asunto);
    formData.set("cuerpoHtml", cuerpoHtml);
    formData.set("sinRespuestas", modoClub ? "false" : String(sinRespuestas));
    formData.set("prioridad", prioridad);
    formData.set("categoria", categoria);
    formData.set("idempotencyKey", idempotencyKeyRef.current);
    if (borradorId) formData.set("borradorId", borradorId);
    if (scheduledIso) formData.set("scheduledFor", scheduledIso);

    formData.set(
      "clubes",
      JSON.stringify(todosClubes ? ["*"] : [...seleccionClubes])
    );
    formData.set(
      "arbitros",
      JSON.stringify(todosArbitros ? ["*"] : [...seleccionArbitros])
    );
    formData.set(
      "adjuntosPreSubidos",
      JSON.stringify(
        adjuntos.map(({ path, name, type, size }) => ({ path, name, type, size }))
      )
    );

    const fnEnviar = modoClub ? enviarMensajeClub : enviarComunicado;
    const resultado = await fnEnviar(formData);
    setEnviando(false);

    if ("error" in resultado && resultado.error) {
      setError(resultado.error);
      return;
    }

    setSucio(false);

    if ("programado" in resultado && resultado.programado) {
      setExito(
        `Mensaje programado correctamente para el ${fechaProgramada} a las ${horaProgramada} hs (Ushuaia).`
      );
      setTimeout(() => onEnviado(true), 1600);
      return;
    }

    if (modoClub) {
      setExito("Mensaje oficial enviado correctamente a la Federación LFS.");
    } else {
      const enviados = "enviados" in resultado ? Number(resultado.enviados) : 0;
      const emails = "emailsRegistrados" in resultado ? Number(resultado.emailsRegistrados) : 0;
      setExito(
        `Comunicado enviado a ${enviados} destinatario${enviados === 1 ? "" : "s"}. ` +
          `${emails > 0 ? `${emails} aviso${emails === 1 ? "" : "s"} por email quedaron registrados.` : ""}`
      );
    }
    setTimeout(() => onEnviado(false), 1600);
  }

  const plantillasFiltradas = useMemo(() => {
    if (filtroCategoriaPlantilla === "Todas") return plantillas;
    return plantillas.filter((p) => p.categoria === filtroCategoriaPlantilla);
  }, [plantillas, filtroCategoriaPlantilla]);

  const configPrioridad = PRIORIDADES_MENSAJE[prioridad];

  return (
    <div className="flex flex-col h-full bg-[#F4F6FA] overflow-y-auto">
      {/* Encabezado sticky empresarial */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#1A2A44] to-[#24344F] text-white shrink-0 sticky top-0 z-20 shadow-md">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5 text-[#F97316]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-serif font-bold leading-tight text-base">
              Redactar mensaje oficial
            </h2>
            {guardandoBorrador ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-orange-200 bg-white/10 px-2 py-0.5 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" /> Guardando borrador…
              </span>
            ) : ultimoGuardadoIso ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-200 bg-white/10 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> Borrador guardado {horaFormateada(ultimoGuardadoIso)}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-300 truncate">
            Difusión institucional con seguimiento de lectura individual y notificación por correo.
          </p>
        </div>

        {/* Acciones rápidas del encabezado */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setPanelPlantillasAbierto((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              panelPlantillasAbierto
                ? "bg-[#F97316] text-white"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Plantillas</span>
          </button>

          <button
            type="button"
            onClick={manejarGuardarBorradorManual}
            disabled={guardandoBorrador}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-50"
            title="Guardar borrador ahora"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guardar borrador</span>
          </button>

          <button
            type="button"
            onClick={intentarCerrar}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
            aria-label="Cerrar compositor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Confirmación antes de descartar cambios */}
      {confirmarDescarte && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-amber-900 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            Tenés cambios sin enviar en este mensaje. ¿Querés guardar el borrador antes de salir?
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await manejarGuardarBorradorManual();
                onCerrar();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#1A2A44] text-white text-xs font-bold hover:brightness-110"
            >
              Guardar borrador y salir
            </button>
            <button
              type="button"
              onClick={onCerrar}
              className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200"
            >
              Descartar cambios
            </button>
            <button
              type="button"
              onClick={() => setConfirmarDescarte(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-amber-100"
            >
              Seguir editando
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 p-4 flex flex-col gap-4 max-w-4xl w-full mx-auto">
        {/* GESTOR DE PLANTILLAS PREDISEÑADAS */}
        {panelPlantillasAbierto && (
          <section className="bg-white rounded-2xl border-2 border-[#F97316]/40 shadow-md p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-black text-[#1A2A44] uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#F97316]" /> Plantillas prediseñadas
                </h3>
                <p className="text-xs text-slate-500">
                  Seleccioná una plantilla para agilizar la redacción o guardá el mensaje actual como plantilla.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModoGuardarPlantilla((v) => !v);
                  setPlantillaEditandoId(undefined);
                  setNombreNuevaPlantilla(asunto || "");
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#1A2A44] text-white px-3 py-1.5 text-xs font-bold hover:brightness-110 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Guardar redacción actual como plantilla
              </button>
            </div>

            {modoGuardarPlantilla && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  value={nombreNuevaPlantilla}
                  onChange={(e) => setNombreNuevaPlantilla(e.target.value)}
                  placeholder="Nombre de la plantilla (ej.: Citación Tribunal de Disciplina)"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={manejarGuardarPlantilla}
                    disabled={guardandoPlantilla}
                    className="rounded-xl bg-[#F97316] text-white px-3.5 py-2 text-xs font-bold hover:brightness-105 disabled:opacity-50"
                  >
                    {guardandoPlantilla
                      ? "Guardando…"
                      : plantillaEditandoId
                        ? "Actualizar plantilla"
                        : "Confirmar plantilla"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModoGuardarPlantilla(false);
                      setPlantillaEditandoId(undefined);
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Filtro por categoría */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {["Todas", ...CATEGORIAS_MENSAJE].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltroCategoriaPlantilla(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition ${
                    filtroCategoriaPlantilla === cat
                      ? "bg-[#1A2A44] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {cargandoPlantillas ? (
              <p className="text-xs text-slate-400 py-4 text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando plantillas…
              </p>
            ) : plantillasFiltradas.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No hay plantillas en esta categoría.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto">
                {plantillasFiltradas.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 p-3 hover:border-[#F97316] transition flex flex-col justify-between gap-2 bg-slate-50/50"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA580C] bg-orange-50 px-2 py-0.5 rounded-full">
                          {p.categoria}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              aplicarPlantilla(p);
                              setPanelPlantillasAbierto(true);
                              setModoGuardarPlantilla(true);
                              setPlantillaEditandoId(p.id);
                              setNombreNuevaPlantilla(p.nombre);
                            }}
                            className="p-1 text-slate-400 hover:text-[#1A2A44]"
                            title="Editar plantilla"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => manejarEliminarPlantilla(p.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Eliminar plantilla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-[#1A2A44] mt-1">{p.nombre}</h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {p.asunto_sugerido || textoPlanoDeHtml(p.cuerpo_html, 70)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => aplicarPlantilla(p)}
                      className="w-full rounded-lg bg-white border border-slate-300 py-1.5 text-xs font-bold text-[#1A2A44] hover:bg-[#1A2A44] hover:text-white transition"
                    >
                      Usar esta plantilla
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 1. DESTINATARIOS */}
        {modoClub ? (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2.5">
            <h3 className="text-sm font-black text-[#1A2A44] uppercase tracking-wide">
              1. Destinatario
            </h3>
            <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-[#1A2A44] text-white flex items-center justify-center font-serif font-black text-xs shrink-0 shadow-xs">
                LFS
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-[#1A2A44]">
                    Federación LFS — Mesa de Entradas Oficial
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md">
                    Oficial
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Administración de la liga · Notificación directa a la mesa directiva con constancia de recepción
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#1A2A44] uppercase tracking-wide">
              1. Destinatarios
            </h3>
            <span
              className={`text-xs font-bold rounded-full px-2.5 py-1 ${
                totalSeleccionados
                  ? "bg-orange-100 text-[#EA580C]"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {totalSeleccionados} seleccionado{totalSeleccionados === 1 ? "" : "s"}
            </span>
          </div>

          {/* Botones de selección por grupo/departamento */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSucio(true);
                setTodosClubes((v) => !v);
                if (!todosClubes) setSeleccionClubes(new Set());
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition border ${
                todosClubes
                  ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                  : "bg-white text-[#1A2A44] border-slate-300 hover:border-[#1A2A44]"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Todos los clubes ({clubes.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setSucio(true);
                setTodosArbitros((v) => !v);
                if (!todosArbitros) setSeleccionArbitros(new Set());
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition border ${
                todosArbitros
                  ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                  : "bg-white text-[#1A2A44] border-slate-300 hover:border-[#1A2A44]"
              }`}
            >
              <Flag className="w-3.5 h-3.5" /> Todos los árbitros ({arbitros.length})
            </button>
          </div>

          {/* Chips visuales de destinatarios seleccionados con botón X individual */}
          {chipsSeleccionados.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {chipsSeleccionados.map((chip) => (
                <span
                  key={chip.key}
                  className={`inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-1.5 py-1 text-xs font-bold border ${
                    chip.subtipo === "grupo"
                      ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                      : chip.subtipo === "club"
                        ? "bg-orange-50 text-[#1A2A44] border-orange-200"
                        : "bg-slate-100 text-[#1A2A44] border-slate-300"
                  }`}
                >
                  <span className="truncate max-w-[190px]">{chip.etiqueta}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/15 transition"
                    aria-label={`Quitar a ${chip.etiqueta}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Buscador por nombre */}
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar destinatario por nombre de club o árbitro…"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]"
          />

          <div className="max-h-44 overflow-y-auto flex flex-col divide-y divide-slate-100 -mx-1 px-1">
            {clubesVisibles.map((c) => (
              <label
                key={c.destinoId}
                className={`flex items-center gap-2.5 py-2 cursor-pointer rounded-lg px-2 hover:bg-slate-50 ${
                  todosClubes ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={todosClubes || seleccionClubes.has(c.destinoId)}
                  onChange={() => alternar("club", c.destinoId)}
                  className="accent-[#F97316] w-4 h-4"
                />
                <span className="w-7 h-7 rounded-full bg-[#1A2A44] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {inicialesDe(c.nombre)}
                </span>
                <span className="text-sm font-semibold text-[#1A2A44] truncate">{c.nombre}</span>
                <span className="ml-auto text-[10px] font-bold uppercase text-slate-400 shrink-0">
                  Club
                </span>
              </label>
            ))}
            {arbitrosVisibles.map((a) => (
              <label
                key={a.destinoId}
                className={`flex items-center gap-2.5 py-2 cursor-pointer rounded-lg px-2 hover:bg-slate-50 ${
                  todosArbitros ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={todosArbitros || seleccionArbitros.has(a.destinoId)}
                  onChange={() => alternar("arbitro", a.destinoId)}
                  className="accent-[#F97316] w-4 h-4"
                />
                <span className="w-7 h-7 rounded-full bg-[#4A5D7A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {inicialesDe(a.nombre)}
                </span>
                <span className="text-sm font-semibold text-[#1A2A44] truncate">{a.nombre}</span>
                <span className="ml-auto text-[10px] font-bold uppercase text-slate-400 shrink-0">
                  Árbitro
                </span>
              </label>
            ))}
            {!clubesVisibles.length && !arbitrosVisibles.length && (
              <p className="text-xs text-slate-400 py-3 text-center">
                Nadie coincide con “{busqueda}”.
              </p>
            )}
          </div>
        </section>
      )}

        {/* 2. CONFIGURACIÓN DEL MENSAJE: ASUNTO, CATEGORÍA Y PRIORIDAD */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3.5">
          <h3 className="text-sm font-black text-[#1A2A44] uppercase tracking-wide">
            2. Configuración del mensaje
          </h3>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#1A2A44] uppercase tracking-wide">
                Asunto <span className="text-[#EA580C]">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{asunto.length}/120</span>
            </div>
            <input
              value={asunto}
              onChange={(e) => {
                setSucio(true);
                setAsunto(e.target.value);
              }}
              maxLength={120}
              placeholder="Ej.: Suspensión de la Fecha 12 por alerta meteorológica"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Selector de Categoría */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#1A2A44] uppercase tracking-wide mb-1">
                <Tag className="w-3.5 h-3.5 text-[#F97316]" /> Categoría oficial
              </label>
              <select
                value={categoria}
                onChange={(e) => {
                  setSucio(true);
                  setCategoria(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 cursor-pointer"
              >
                {CATEGORIAS_MENSAJE.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Nivel de Importancia (3.7) */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-[#1A2A44] uppercase tracking-wide mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-[#F97316]" /> Nivel de importancia
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["normal", "importante", "urgente"] as PrioridadMensaje[]).map((nivel) => {
                  const cfg = PRIORIDADES_MENSAJE[nivel];
                  const activo = prioridad === nivel;
                  return (
                    <button
                      key={nivel}
                      type="button"
                      onClick={() => {
                        setSucio(true);
                        setPrioridad(nivel);
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-black uppercase tracking-wide border transition ${
                        activo
                          ? nivel === "urgente"
                            ? "bg-red-600 text-white border-red-600 shadow-xs"
                            : nivel === "importante"
                              ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                              : "bg-[#1A2A44] text-white border-[#1A2A44] shadow-xs"
                          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {cfg.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 3. EDITOR DE TEXTO ENRIQUECIDO + VISTA PREVIA */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-sm font-black text-[#1A2A44] uppercase tracking-wide">
              3. Cuerpo del mensaje <span className="text-[#EA580C]">*</span>
            </label>
            <button
              type="button"
              onClick={() => setVistaPrevia((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-1.5 transition border ${
                vistaPrevia
                  ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                  : "text-[#1A2A44] border-slate-300 hover:bg-slate-100"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {vistaPrevia ? "Volver al editor" : "Vista previa realista"}
            </button>
          </div>

          {vistaPrevia ? (
            <div className="rounded-2xl border border-slate-200 bg-[#F4F6FA] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Así verán el comunicado los destinatarios en su chat:
              </p>
              <div className="rounded-2xl overflow-hidden border border-orange-200 shadow-md bg-white max-w-2xl">
                <div
                  className={`flex items-center gap-2 px-4 py-2.5 text-white ${
                    prioridad === "urgente"
                      ? "bg-gradient-to-r from-red-700 to-red-600"
                      : prioridad === "importante"
                        ? "bg-gradient-to-r from-amber-600 to-orange-600"
                        : "bg-gradient-to-r from-[#1A2A44] to-[#2A3D5F]"
                  }`}
                >
                  <Megaphone className="w-4 h-4 text-[#F97316] shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                    Comunicado Oficial · {categoria}
                  </span>
                  {prioridad !== "normal" && (
                    <span className="text-[10px] font-black uppercase bg-white/20 px-2 py-0.5 rounded-full">
                      {configPrioridad.etiqueta}
                    </span>
                  )}
                  {sinRespuestas && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-orange-100 shrink-0">
                      <Lock className="w-3 h-3" /> Sin respuestas
                    </span>
                  )}
                </div>
                <div className="px-4 py-3.5 flex flex-col gap-2.5">
                  <h3 className="font-serif text-base font-black text-[#1A2A44] leading-snug">
                    {asunto || "(Sin asunto)"}
                  </h3>
                  <div
                    className="prose-lfs text-sm text-slate-700 leading-relaxed min-h-[80px]"
                    dangerouslySetInnerHTML={{
                      __html: cuerpoHtml || "<p><em>(Cuerpo vacío)</em></p>",
                    }}
                  />
                  {adjuntos.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      {adjuntos.map((adj) => (
                        <span
                          key={adj.path}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-[#1A2A44]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#F97316]" />
                          {adj.name} ({formatearTamanioArchivo(adj.size)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <EditorTextoEnriquecido
              valorInicial={cuerpoHtml}
              versionContenido={versionContenido}
              onChange={(html) => {
                setSucio(true);
                setCuerpoHtml(html);
              }}
              placeholder="Redactá el comunicado con tipografía, colores, listas o enlaces…"
            />
          )}
        </section>

        {/* 4. IMÁGENES Y ARCHIVOS ADJUNTOS (HASTA 10 MB) */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-black text-[#1A2A44] uppercase tracking-wide flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-[#F97316]" /> 4. Imágenes y archivos adjuntos
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold">
              JPG, JPEG, PNG, WEBP o PDF · Máx. 10 MB por archivo
            </span>
          </div>

          <input
            ref={inputArchivoRef}
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) procesarArchivosSeleccionados(e.target.files);
            }}
          />

          {/* Zona Drag & Drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrandoArchivo(true);
            }}
            onDragLeave={() => setArrastrandoArchivo(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrandoArchivo(false);
              if (e.dataTransfer.files) procesarArchivosSeleccionados(e.dataTransfer.files);
            }}
            onClick={() => inputArchivoRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition flex flex-col items-center gap-1.5 ${
              arrastrandoArchivo
                ? "border-[#F97316] bg-orange-50/60"
                : "border-slate-300 hover:border-[#1A2A44] bg-slate-50/50"
            }`}
          >
            <UploadCloud className="w-7 h-7 text-[#F97316]" />
            <p className="text-xs font-bold text-[#1A2A44]">
              Arrastrá imágenes o documentos acá, o hacé clic para seleccionar desde tu dispositivo
            </p>
            <p className="text-[11px] text-slate-400">
              Formatos admitidos: JPG, JPEG, PNG, WEBP y PDF (hasta 10 MB c/u)
            </p>
          </div>

          {/* Barra de progreso de subida */}
          {subiendoArchivo && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1A2A44]">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F97316]" /> Subiendo archivo…
                </span>
                <span>{progresoSubida}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#F97316] to-[#EA580C] transition-all duration-200"
                  style={{ width: `${progresoSubida}%` }}
                />
              </div>
            </div>
          )}

          {/* Lista de adjuntos con miniatura, nombre, tamaño y botón eliminar */}
          {adjuntos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {adjuntos.map((adj) => (
                <div
                  key={adj.path}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                >
                  {adj.type.startsWith("image/") && adj.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={adj.previewUrl}
                      alt={adj.name}
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-orange-100 text-[#EA580C] flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#1A2A44] truncate">{adj.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {adj.size > 0 ? formatearTamanioArchivo(adj.size) : "Archivo adjunto"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarAdjunto(adj.path)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    aria-label={`Eliminar ${adj.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. RESPUESTAS Y PROGRAMACIÓN DE ENVÍO */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-4">
          <h3 className="text-sm font-black text-[#1A2A44] uppercase tracking-wide">
            {modoClub ? "5. Programación de envío" : "5. Opciones de respuesta y programación"}
          </h3>

          {/* Bloqueo de respuestas (solo para administración) */}
          {!modoClub && (
            <>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sinRespuestas}
                  onChange={(e) => {
                    setSucio(true);
                    setSinRespuestas(e.target.checked);
                  }}
                  className="accent-[#F97316] w-4 h-4 mt-0.5"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-bold text-[#1A2A44]">
                    <Lock className="w-3.5 h-3.5 text-[#EA580C]" /> Desactivar respuestas (Solo lectura)
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    El chat de cada destinatario queda bloqueado para respuestas hasta que la federación
                    envíe un nuevo mensaje. Ideal para resoluciones oficiales y boletines.
                  </span>
                </span>
              </label>
              <hr className="border-slate-100" />
            </>
          )}

          {/* Programación de envío (3.6) */}
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={programarEnvio}
                onChange={(e) => setProgramarEnvio(e.target.checked)}
                className="accent-[#F97316] w-4 h-4 mt-0.5"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-bold text-[#1A2A44]">
                  <CalendarClock className="w-4 h-4 text-[#F97316]" /> Programar envío para una fecha y hora determinadas
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  El comunicado quedará agendado en la pestaña “Programados” y se despachará en la fecha indicada.
                </span>
              </span>
            </label>

            {programarEnvio && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Fecha de envío
                  </label>
                  <input
                    type="date"
                    value={fechaProgramada}
                    onChange={(e) => setFechaProgramada(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#1A2A44]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Hora de envío
                  </label>
                  <input
                    type="time"
                    value={horaProgramada}
                    onChange={(e) => setHoraProgramada(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#1A2A44]"
                  />
                </div>
                <div className="text-[11px] text-slate-500 font-semibold pb-1.5">
                  Zona horaria controlada:
                  <span className="block font-bold text-[#1A2A44]">
                    América/Argentina/Ushuaia (GMT-3)
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Estado + acción principal */}
        {error && (
          <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}
        {exito && (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {exito}
          </p>
        )}

        <div
          className="sticky bottom-0 pb-2 z-10"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={manejarEnvio}
            disabled={enviando || subiendoArchivo || !totalSeleccionados}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-black text-sm py-3.5 shadow-lg shadow-orange-500/30 hover:brightness-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : programarEnvio ? (
              <CalendarClock className="w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {enviando
              ? programarEnvio
                ? "Programando envío…"
                : "Enviando a Federación LFS…"
              : programarEnvio
                ? modoClub
                  ? "Confirmar programación de envío"
                  : `Confirmar programación para ${totalSeleccionados} destinatario${totalSeleccionados === 1 ? "" : "s"}`
                : modoClub
                  ? "Enviar mensaje oficial a Federación LFS"
                  : `Enviar comunicado a ${totalSeleccionados} destinatario${totalSeleccionados === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
