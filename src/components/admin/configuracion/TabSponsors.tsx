"use client";

import { useState } from "react";
import {
  Handshake,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Trophy,
  Sparkles,
  Award,
} from "lucide-react";
import type { SponsorItem } from "@/lib/core/rules/configuracionRules";
import { ModalSponsor } from "./ModalSponsor";

interface TabSponsorsProps {
  sponsors: SponsorItem[];
  onCreateSponsor: (data: unknown) => Promise<{ success: boolean; error?: string }>;
  onUpdateSponsor: (id: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
  onToggleStatus: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>;
  onDeleteSponsor: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function TabSponsors({
  sponsors,
  onCreateSponsor,
  onUpdateSponsor,
  onToggleStatus,
  onDeleteSponsor,
}: TabSponsorsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<SponsorItem | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const tierBadges: Record<
    SponsorItem["tier"],
    { label: string; bg: string; text: string; icon: typeof Trophy }
  > = {
    main: { label: "Main Sponsor (Titular)", bg: "bg-amber-500", text: "text-white", icon: Trophy },
    platino: { label: "Sponsor Platino", bg: "bg-slate-700", text: "text-slate-100", icon: Sparkles },
    oro: { label: "Sponsor Oro", bg: "bg-amber-100", text: "text-amber-800", icon: Award },
    plata: { label: "Sponsor Plata", bg: "bg-slate-100", text: "text-slate-700", icon: Award },
    bronce: { label: "Sponsor Bronce", bg: "bg-orange-100", text: "text-orange-800", icon: Award },
    partner: { label: "Partner / Colaborador", bg: "bg-blue-50", text: "text-blue-700", icon: Handshake },
  };

  const handleOpenCreate = () => {
    setEditingSponsor(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sponsor: SponsorItem) => {
    setEditingSponsor(sponsor);
    setIsModalOpen(true);
  };

  const handleSave = async (data: unknown) => {
    let res: { success: boolean; error?: string };
    if (editingSponsor) {
      res = await onUpdateSponsor(editingSponsor.id, data);
    } else {
      res = await onCreateSponsor(data);
    }

    if (res.success) {
      setFeedbackMsg({
        text: editingSponsor ? "Sponsor actualizado correctamente." : "Sponsor agregado exitosamente.",
        type: "success",
      });
    } else {
      setFeedbackMsg({ text: res.error || "Error al procesar sponsor.", type: "error" });
    }
    return res;
  };

  const handleToggle = async (sponsor: SponsorItem) => {
    const newStatus = !sponsor.active;
    const res = await onToggleStatus(sponsor.id, newStatus);
    if (res.success) {
      setFeedbackMsg({
        text: `Sponsor "${sponsor.name}" ${newStatus ? "activado" : "pausado"}.`,
        type: "success",
      });
    } else {
      setFeedbackMsg({ text: res.error || "Error al cambiar estado.", type: "error" });
    }
  };

  const handleDelete = async (sponsor: SponsorItem) => {
    const confirm = window.confirm(`¿Deseás eliminar de forma permanente el sponsor "${sponsor.name}"?`);
    if (!confirm) return;

    const res = await onDeleteSponsor(sponsor.id);
    if (res.success) {
      setFeedbackMsg({ text: `Sponsor "${sponsor.name}" eliminado.`, type: "success" });
    } else {
      setFeedbackMsg({ text: res.error || "No se pudo eliminar el sponsor.", type: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Superior */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold">Patrocinadores y Alianzas Comerciales</h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
              Administrá los sponsors oficiales de la liga, sus categorías de patrocinio, logotipos en alta resolución y ubicaciones de visualización en la plataforma.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Agregar Sponsor
        </button>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="text-xs hover:underline font-bold">
            Cerrar
          </button>
        </div>
      )}

      {/* Grid de Sponsors */}
      {sponsors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <Handshake className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="font-serif text-base font-bold text-[#1A2A44]">No hay patrocinadores registrados</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Hacé clic en &quot;Agregar Sponsor&quot; para subir tu primer patrocinador comercial con logo y enlaces oficiales.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sponsors.map((sp) => {
            const badge = tierBadges[sp.tier] || tierBadges.partner;
            const BadgeIcon = badge.icon;

            return (
              <div
                key={sp.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                  sp.active ? "border-slate-200" : "border-slate-200/60 opacity-60 bg-slate-50/40"
                }`}
              >
                <div>
                  {/* Top Bar: Tier y Estado */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}
                    >
                      <BadgeIcon className="w-3 h-3" /> {badge.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggle(sp)}
                      title={sp.active ? "Click para pausar sponsor" : "Click para activar sponsor"}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                        sp.active
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                    >
                      {sp.active ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Activo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-500" /> Pausado
                        </>
                      )}
                    </button>
                  </div>

                  {/* Logo Container */}
                  <div className="w-full h-28 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-center p-3 mb-3 overflow-hidden shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sp.logo_url} alt={sp.name} className="max-h-full max-w-full object-contain" />
                  </div>

                  {/* Info */}
                  <h4 className="font-serif text-sm font-bold text-[#1A2A44] leading-snug">{sp.name}</h4>
                  {sp.website_url && (
                    <a
                      href={sp.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#F97316] font-semibold hover:underline inline-flex items-center gap-1 mt-1 truncate max-w-full"
                    >
                      <span>{sp.website_url.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  )}

                  {/* Ubicaciones */}
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(sp.display_locations || []).map((loc) => (
                      <span
                        key={loc}
                        className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold uppercase tracking-wider"
                      >
                        {loc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Acciones */}
                <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 font-medium">Prioridad: #{sp.order_index}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(sp)}
                      className="p-1.5 text-slate-500 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition"
                      title="Editar sponsor"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(sp)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Eliminar sponsor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalSponsor
        isOpen={isModalOpen}
        sponsorAEditar={editingSponsor}
        onGuardar={handleSave}
        onCerrar={() => setIsModalOpen(false)}
      />
    </div>
  );
}
