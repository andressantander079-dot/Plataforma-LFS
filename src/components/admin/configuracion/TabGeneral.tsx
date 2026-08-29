"use client";

import { useState, useRef } from "react";
import {
  Save,
  Upload,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Building,
  Mail,
  Phone,
  MapPin,
  Globe,
  Share2,
  Video,
} from "lucide-react";
import type {
  LeagueIdentityConfig,
  LeagueAnnouncementConfig,
} from "@/lib/core/rules/configuracionRules";
import { subirAssetLiga } from "@/lib/actions/configuracion.actions";

interface TabGeneralProps {
  initialIdentity: LeagueIdentityConfig;
  initialAnnouncement: LeagueAnnouncementConfig;
  onSaveIdentity: (data: LeagueIdentityConfig) => Promise<boolean>;
  onSaveAnnouncement: (data: LeagueAnnouncementConfig) => Promise<boolean>;
  setDirtySection: (section: "identity" | "announcement", isDirty: boolean) => void;
}

export function TabGeneral({
  initialIdentity,
  initialAnnouncement,
  onSaveIdentity,
  onSaveAnnouncement,
  setDirtySection,
}: TabGeneralProps) {
  const [identity, setIdentity] = useState<LeagueIdentityConfig>(initialIdentity);
  const [announcement, setAnnouncement] = useState<LeagueAnnouncementConfig>(initialAnnouncement);

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIdentityChange = (field: keyof LeagueIdentityConfig, value: string | null) => {
    setIdentity((prev) => {
      const updated = { ...prev, [field]: value };
      setDirtySection("identity", true);
      return updated;
    });
  };

  const handleAnnouncementChange = (field: keyof LeagueAnnouncementConfig, value: unknown) => {
    setAnnouncement((prev) => {
      const updated = { ...prev, [field]: value };
      setDirtySection("announcement", true);
      return updated;
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMsg({ text: "El logotipo no debe superar 2 MB.", type: "error" });
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await subirAssetLiga(formData, "logos");
    setIsUploadingLogo(false);

    if (res.success && res.data?.url) {
      handleIdentityChange("logo_url", res.data.url);
      setStatusMsg({ text: "Logotipo cargado correctamente.", type: "success" });
    } else {
      setStatusMsg({ text: res.error || "Error al subir logotipo.", type: "error" });
    }
  };

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingIdentity(true);
    setStatusMsg(null);

    const success = await onSaveIdentity(identity);
    setIsSavingIdentity(false);

    if (success) {
      setDirtySection("identity", false);
      setStatusMsg({ text: "Datos institucionales guardados exitosamente.", type: "success" });
    } else {
      setStatusMsg({ text: "Error al guardar datos institucionales.", type: "error" });
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAnnouncement(true);
    setStatusMsg(null);

    const success = await onSaveAnnouncement(announcement);
    setIsSavingAnnouncement(false);

    if (success) {
      setDirtySection("announcement", false);
      setStatusMsg({ text: "Banner de anuncios guardado exitosamente.", type: "success" });
    } else {
      setStatusMsg({ text: "Error al guardar el banner de anuncios.", type: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in ${
            statusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-xs hover:underline font-bold"
          >
            Entendido
          </button>
        </div>
      )}

      {/* 1. Formulario Institucional */}
      <form onSubmit={handleSaveIdentity} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-[#F97316]" />
            <div>
              <h3 className="font-serif text-base font-bold text-[#1A2A44]">Identidad Institucional</h3>
              <p className="text-xs text-slate-400">Nombre, temporada, escudo y datos oficiales de la asociación.</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSavingIdentity}
            className="px-4 py-2 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSavingIdentity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar Identidad
          </button>
        </div>

        {/* Escudo / Logotipo */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 border border-slate-200/70 p-4 rounded-xl">
          <div className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
            {identity.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={identity.logo_url} alt="Logo Liga" className="w-full h-full object-contain p-1.5" />
            ) : (
              <div className="text-center text-slate-300">
                <ImageIcon className="w-7 h-7 mx-auto mb-0.5" />
                <span className="text-[9px] font-bold">Sin logo</span>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <span className="text-xs font-bold text-[#1A2A44]">Escudo Oficial de la Liga</span>
            <p className="text-[11px] text-slate-500">
              Formato recomendado: PNG transparente o SVG de 512x512 px (Máx 2 MB). Se utilizará en planillas digitales y cabeceras.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 transition flex items-center gap-1.5 shadow-sm"
              >
                {isUploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Cargar Archivo
              </button>
              {identity.logo_url && (
                <button
                  type="button"
                  onClick={() => handleIdentityChange("logo_url", null)}
                  className="text-xs text-rose-500 hover:underline px-2 py-1 font-semibold"
                >
                  Restablecer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Datos Principales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-xs font-bold text-slate-700">Nombre Oficial de la Asociación</label>
            <input
              type="text"
              required
              value={identity.name}
              onChange={(e) => handleIdentityChange("name", e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Sigla / Abreviatura</label>
            <input
              type="text"
              required
              value={identity.short_name}
              onChange={(e) => handleIdentityChange("short_name", e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Temporada Deportiva Activa</label>
            <input
              type="text"
              required
              value={identity.season}
              onChange={(e) => handleIdentityChange("season", e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Lema / Slogan Institucional</label>
            <input
              type="text"
              value={identity.slogan}
              onChange={(e) => handleIdentityChange("slogan", e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white"
            />
          </div>
        </div>

        {/* Contacto y Redes */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Contacto Oficial y Redes</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Sede Física / Dirección
              </label>
              <input
                type="text"
                value={identity.address}
                onChange={(e) => handleIdentityChange("address", e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-[#1A2A44] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Teléfono Oficial
              </label>
              <input
                type="text"
                value={identity.phone}
                onChange={(e) => handleIdentityChange("phone", e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-[#1A2A44] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Institucional
              </label>
              <input
                type="email"
                value={identity.email}
                onChange={(e) => handleIdentityChange("email", e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-[#1A2A44] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-pink-600" /> Instagram Oficial
              </label>
              <input
                type="text"
                placeholder="@ligafutsalushuaia"
                value={identity.social_instagram}
                onChange={(e) => handleIdentityChange("social_instagram", e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-[#1A2A44] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" /> Facebook
              </label>
              <input
                type="text"
                placeholder="Liga de Futsal Ushuaia"
                value={identity.social_facebook}
                onChange={(e) => handleIdentityChange("social_facebook", e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-[#1A2A44] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-red-600" /> Canal de Streaming / YouTube
              </label>
              <input
                type="text"
                placeholder="LFS Ushuaia Play"
                value={identity.social_youtube}
                onChange={(e) => handleIdentityChange("social_youtube", e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-[#1A2A44] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
              />
            </div>
          </div>
        </div>
      </form>

      {/* 2. Formulario Banner de Avisos Global */}
      <form onSubmit={handleSaveAnnouncement} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Megaphone className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-serif text-base font-bold text-[#1A2A44]">Banner de Comunicados y Alertas</h3>
              <p className="text-xs text-slate-400">Mensaje de alta visibilidad para la portada pública y fixture.</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSavingAnnouncement}
            className="px-4 py-2 bg-[#1A2A44] hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSavingAnnouncement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar Banner
          </button>
        </div>

        <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
          <input
            type="checkbox"
            checked={announcement.active}
            onChange={(e) => handleAnnouncementChange("active", e.target.checked)}
            className="w-4 h-4 text-[#F97316] rounded border-slate-300 focus:ring-[#F97316]"
          />
          <div>
            <span className="text-xs font-bold text-slate-800 block">Mostrar Banner Global</span>
            <span className="text-[10px] text-slate-400 block">Activa el banner superior en la web pública de la liga.</span>
          </div>
        </label>

        {announcement.active && (
          <div className="flex flex-col gap-3 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1 md:col-span-3">
                <label className="text-xs font-bold text-slate-700">Texto del Mensaje</label>
                <input
                  type="text"
                  placeholder="Ej: ¡Inscripciones abiertas para el Torneo Clausura 2026! Cierre 15 de Abril."
                  value={announcement.message}
                  onChange={(e) => handleAnnouncementChange("message", e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-700">Tipo de Alerta</label>
                <select
                  value={announcement.type}
                  onChange={(e) => handleAnnouncementChange("type", e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
                >
                  <option value="info">ℹ️ Informativo (Azul)</option>
                  <option value="warning">⚠️ Advertencia (Naranja)</option>
                  <option value="urgent">🚨 Urgente (Rojo)</option>
                  <option value="success">✅ Éxito (Verde)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-slate-400" /> Enlace de Redirección (Opcional)
              </label>
              <input
                type="url"
                placeholder="https://... o /fixture"
                value={announcement.link_url || ""}
                onChange={(e) => handleAnnouncementChange("link_url", e.target.value || null)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
