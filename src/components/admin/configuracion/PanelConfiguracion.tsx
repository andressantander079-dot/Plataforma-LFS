"use client";

import { useState, useEffect, useTransition, Suspense, lazy } from "react";
import {
  Settings,
  Building,
  Layers,
  Handshake,
  MapPin,
  Scale,
  ArrowRightLeft,
  History,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type {
  LeagueFullConfig,
  SponsorItem,
  CategoryItem,
  VenueItem,
  ConfigAuditLogItem,
  DirtySectionsState,
} from "@/lib/core/rules/configuracionRules";
import { getDirtySectionNames } from "@/lib/core/rules/configuracionRules";
import {
  guardarSeccionConfiguracion,
  crearCategoria,
  actualizarCategoria,
  toggleCategoriaEstado,
  eliminarCategoria,
  crearSponsor,
  actualizarSponsor,
  toggleSponsorEstado,
  eliminarSponsor,
  crearCanchaConfig,
  actualizarCanchaConfig,
  toggleCanchaEstado,
  eliminarCanchaConfig,
} from "@/lib/actions/configuracion.actions";
import { ModalConfirmarDescarte } from "./ModalConfirmarDescarte";

// Lazy loading de Tabs para rendimiento óptimo
const TabGeneral = lazy(() =>
  import("./TabGeneral").then((m) => ({ default: m.TabGeneral }))
);
const TabCategorias = lazy(() =>
  import("./TabCategorias").then((m) => ({ default: m.TabCategorias }))
);
const TabSponsors = lazy(() =>
  import("./TabSponsors").then((m) => ({ default: m.TabSponsors }))
);
const TabCanchas = lazy(() =>
  import("./TabCanchas").then((m) => ({ default: m.TabCanchas }))
);
const TabDisciplina = lazy(() =>
  import("./TabDisciplina").then((m) => ({ default: m.TabDisciplina }))
);
const TabPases = lazy(() =>
  import("./TabPases").then((m) => ({ default: m.TabPases }))
);
const TabAuditoria = lazy(() =>
  import("./TabAuditoria").then((m) => ({ default: m.TabAuditoria }))
);

type TabType =
  | "general"
  | "categorias"
  | "sponsors"
  | "canchas"
  | "disciplina"
  | "pases"
  | "auditoria";

interface PanelConfiguracionProps {
  initialConfig: LeagueFullConfig;
  initialSponsors: SponsorItem[];
  initialCategories: CategoryItem[];
  initialVenues: VenueItem[];
  initialAuditLogs: ConfigAuditLogItem[];
}

export function PanelConfiguracion({
  initialConfig,
  initialSponsors,
  initialCategories,
  initialVenues,
  initialAuditLogs,
}: PanelConfiguracionProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general");
  const [isPending, startTransition] = useTransition();

  // Estados locales sincronizados
  const [config, setConfig] = useState<LeagueFullConfig>(initialConfig);
  const [sponsors, setSponsors] = useState<SponsorItem[]>(initialSponsors);
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [venues, setVenues] = useState<VenueItem[]>(initialVenues);
  const [auditLogs, setAuditLogs] = useState<ConfigAuditLogItem[]>(initialAuditLogs);

  // Matriz de Dirty State
  const [dirtySections, setDirtySections] = useState<DirtySectionsState>({
    identity: false,
    announcement: false,
    discipline: false,
    transfers: false,
  });

  // Estado para el modal de descarte
  const [targetTabToSwitch, setTargetTabToSwitch] = useState<TabType | null>(null);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);

  const hasAnyDirtySection = Object.values(dirtySections).some(Boolean);
  const dirtyNames = getDirtySectionNames(dirtySections);

  // Alerta de beforeunload si hay cambios sin guardar
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAnyDirtySection) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasAnyDirtySection]);

  const setDirtySection = (section: keyof DirtySectionsState, isDirty: boolean) => {
    setDirtySections((prev) => ({ ...prev, [section]: isDirty }));
  };

  // Interceptor de cambio de pestaña
  const handleTabClick = (newTab: TabType) => {
    if (newTab === activeTab) return;

    // Verificar si la pestaña actual tiene cambios pendientes
    const isCurrentTabDirty =
      (activeTab === "general" && (dirtySections.identity || dirtySections.announcement)) ||
      (activeTab === "disciplina" && dirtySections.discipline) ||
      (activeTab === "pases" && dirtySections.transfers);

    if (isCurrentTabDirty) {
      setTargetTabToSwitch(newTab);
      setIsDiscardModalOpen(true);
    } else {
      startTransition(() => {
        setActiveTab(newTab);
      });
    }
  };

  const handleConfirmDiscard = () => {
    if (targetTabToSwitch) {
      // Limpiar el estado sucio de la pestaña de origen
      if (activeTab === "general") {
        setDirtySections((prev) => ({ ...prev, identity: false, announcement: false }));
      } else if (activeTab === "disciplina") {
        setDirtySections((prev) => ({ ...prev, discipline: false }));
      } else if (activeTab === "pases") {
        setDirtySections((prev) => ({ ...prev, transfers: false }));
      }

      startTransition(() => {
        setActiveTab(targetTabToSwitch);
      });
    }
    setIsDiscardModalOpen(false);
    setTargetTabToSwitch(null);
  };

  // ==========================================================================
  // HANDLERS DE MUTACIONES CON LIMPIEZA ATÓMICA DE DIRTY STATE
  // ==========================================================================

  const handleSaveIdentity = async (data: LeagueFullConfig["identity"]) => {
    const res = await guardarSeccionConfiguracion("identity", data);
    if (res.success) {
      setConfig((prev) => ({ ...prev, identity: data }));
      setDirtySection("identity", false);
      return true;
    }
    return false;
  };

  const handleSaveAnnouncement = async (data: LeagueFullConfig["announcement"]) => {
    const res = await guardarSeccionConfiguracion("announcement", data);
    if (res.success) {
      setConfig((prev) => ({ ...prev, announcement: data }));
      setDirtySection("announcement", false);
      return true;
    }
    return false;
  };

  const handleSaveDiscipline = async (data: LeagueFullConfig["discipline"]) => {
    const res = await guardarSeccionConfiguracion("discipline", data);
    if (res.success) {
      setConfig((prev) => ({ ...prev, discipline: data }));
      setDirtySection("discipline", false);
      return true;
    }
    return false;
  };

  const handleSaveTransfers = async (data: LeagueFullConfig["transfers"]) => {
    const res = await guardarSeccionConfiguracion("transfers", data);
    if (res.success) {
      setConfig((prev) => ({ ...prev, transfers: data }));
      setDirtySection("transfers", false);
      return true;
    }
    return false;
  };

  // Categorías
  const handleCreateCategory = async (data: unknown) => {
    const res = await crearCategoria(data);
    if (res.success && res.data) {
      setCategories((prev) => [...prev, res.data as CategoryItem].sort((a, b) => a.level_hierarchy - b.level_hierarchy));
    }
    return res;
  };

  const handleUpdateCategory = async (id: string, data: unknown) => {
    const res = await actualizarCategoria(id, data);
    if (res.success && res.data) {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? (res.data as CategoryItem) : c)).sort((a, b) => a.level_hierarchy - b.level_hierarchy)
      );
    }
    return res;
  };

  const handleToggleCategory = async (id: string, active: boolean) => {
    const res = await toggleCategoriaEstado(id, active);
    if (res.success) {
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: active } : c)));
    }
    return res;
  };

  const handleDeleteCategory = async (id: string) => {
    const res = await eliminarCategoria(id);
    if (res.success) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
    return res;
  };

  // Sponsors
  const handleCreateSponsor = async (data: unknown) => {
    const res = await crearSponsor(data);
    if (res.success && res.data) {
      setSponsors((prev) => [...prev, res.data as SponsorItem]);
    }
    return res;
  };

  const handleUpdateSponsor = async (id: string, data: unknown) => {
    const res = await actualizarSponsor(id, data);
    if (res.success && res.data) {
      setSponsors((prev) => prev.map((s) => (s.id === id ? (res.data as SponsorItem) : s)));
    }
    return res;
  };

  const handleToggleSponsor = async (id: string, active: boolean) => {
    const res = await toggleSponsorEstado(id, active);
    if (res.success) {
      setSponsors((prev) => prev.map((s) => (s.id === id ? { ...s, active } : s)));
    }
    return res;
  };

  const handleDeleteSponsor = async (id: string) => {
    const res = await eliminarSponsor(id);
    if (res.success) {
      setSponsors((prev) => prev.filter((s) => s.id !== id));
    }
    return res;
  };

  // Canchas
  const handleCreateVenue = async (data: unknown) => {
    const res = await crearCanchaConfig(data);
    if (res.success && res.data) {
      setVenues((prev) => [...prev, res.data as VenueItem]);
    }
    return res;
  };

  const handleUpdateVenue = async (id: string, data: unknown) => {
    const res = await actualizarCanchaConfig(id, data);
    if (res.success && res.data) {
      setVenues((prev) => prev.map((v) => (v.id === id ? (res.data as VenueItem) : v)));
    }
    return res;
  };

  const handleToggleVenue = async (id: string, active: boolean) => {
    const res = await toggleCanchaEstado(id, active);
    if (res.success) {
      setVenues((prev) => prev.map((v) => (v.id === id ? { ...v, is_active: active } : v)));
    }
    return res;
  };

  const handleDeleteVenue = async (id: string) => {
    const res = await eliminarCanchaConfig(id);
    if (res.success) {
      setVenues((prev) => prev.filter((v) => v.id !== id));
    }
    return res;
  };

  const tabsConfig: Array<{ id: TabType; label: string; icon: typeof Building; badge?: string | number }> = [
    { id: "general", label: "General & Identidad", icon: Building },
    { id: "categorias", label: "Categorías", icon: Layers, badge: categories.length },
    { id: "sponsors", label: "Sponsors & Marcas", icon: Handshake, badge: sponsors.length },
    { id: "canchas", label: "Sedes & Canchas", icon: MapPin, badge: venues.length },
    { id: "disciplina", label: "Juego & Disciplina", icon: Scale },
    { id: "pases", label: "Pases & Fichajes", icon: ArrowRightLeft },
    { id: "auditoria", label: "Auditoría", icon: History },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      {/* Encabezado Principal */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F97316] text-white flex items-center justify-center shadow-md">
              <Settings className="w-6 h-6" />
            </div>
            Panel de Configuración LFS
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Administración centralizada de identidad, categorías, sponsors oficiales, sedes y parámetros de competencia.
          </p>
        </div>

        {/* Indicador de Estado */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Temporada {config.identity.season}
          </span>
        </div>
      </div>

      {/* Banner Flotante de Cambios Pendientes */}
      {hasAnyDirtySection && (
        <div className="sticky top-4 z-30 bg-amber-500 text-white rounded-2xl px-5 py-3 shadow-xl border border-amber-600 flex items-center justify-between gap-3 animate-slide-down">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold">
              Tenés cambios sin guardar en:{" "}
              <span className="underline">{dirtyNames.join(", ")}</span>
            </span>
          </div>
          <span className="text-[11px] font-medium bg-amber-600/60 px-2.5 py-1 rounded-lg">
            Recordá presionar &quot;Guardar&quot; antes de salir
          </span>
        </div>
      )}

      {/* Barra de Pestañas (Accessible WCAG Tabs) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max" role="tablist" aria-label="Secciones de Configuración">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                  isActive
                    ? "bg-[#1A2A44] text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100 hover:text-[#1A2A44]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#F97316]" : "text-slate-400"}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-[#F97316] text-white" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido de la Pestaña Activa (Lazy & Suspense) */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="transition-opacity duration-200"
      >
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
              <span className="text-xs font-bold">Cargando sección de configuración...</span>
            </div>
          }
        >
          {activeTab === "general" && (
            <TabGeneral
              initialIdentity={config.identity}
              initialAnnouncement={config.announcement}
              onSaveIdentity={handleSaveIdentity}
              onSaveAnnouncement={handleSaveAnnouncement}
              setDirtySection={setDirtySection}
            />
          )}

          {activeTab === "categorias" && (
            <TabCategorias
              categories={categories}
              onCreateCategory={handleCreateCategory}
              onUpdateCategory={handleUpdateCategory}
              onToggleStatus={handleToggleCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {activeTab === "sponsors" && (
            <TabSponsors
              sponsors={sponsors}
              onCreateSponsor={handleCreateSponsor}
              onUpdateSponsor={handleUpdateSponsor}
              onToggleStatus={handleToggleSponsor}
              onDeleteSponsor={handleDeleteSponsor}
            />
          )}

          {activeTab === "canchas" && (
            <TabCanchas
              venues={venues}
              onCreateVenue={handleCreateVenue}
              onUpdateVenue={handleUpdateVenue}
              onToggleStatus={handleToggleVenue}
              onDeleteVenue={handleDeleteVenue}
            />
          )}

          {activeTab === "disciplina" && (
            <TabDisciplina
              initialDiscipline={config.discipline}
              onSaveDiscipline={handleSaveDiscipline}
              setDirtySection={setDirtySection}
            />
          )}

          {activeTab === "pases" && (
            <TabPases
              initialTransfers={config.transfers}
              onSaveTransfers={handleSaveTransfers}
              setDirtySection={setDirtySection}
            />
          )}

          {activeTab === "auditoria" && <TabAuditoria logs={auditLogs} />}
        </Suspense>
      </div>

      {/* Modal de Descarte de Cambios */}
      <ModalConfirmarDescarte
        isOpen={isDiscardModalOpen}
        seccionesConCambios={dirtyNames}
        onConfirmar={handleConfirmDiscard}
        onCancelar={() => {
          setIsDiscardModalOpen(false);
          setTargetTabToSwitch(null);
        }}
      />
    </div>
  );
}
