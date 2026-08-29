"use client";

import { useState, useEffect, useRef } from "react";
import { X, Handshake, AlertCircle, Loader2, Upload, Image as ImageIcon } from "lucide-react";
import type { SponsorItem } from "@/lib/core/rules/configuracionRules";
import { subirAssetLiga } from "@/lib/actions/configuracion.actions";

interface ModalSponsorProps {
  isOpen: boolean;
  sponsorAEditar: SponsorItem | null;
  onGuardar: (datos: {
    name: string;
    logo_url: string;
    website_url: string | null;
    tier: "main" | "platino" | "oro" | "plata" | "bronce" | "partner";
    display_locations: string[];
    active: boolean;
    order_index: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onCerrar: () => void;
}

export function ModalSponsor({
  isOpen,
  sponsorAEditar,
  onGuardar,
  onCerrar,
}: ModalSponsorProps) {
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [tier, setTier] = useState<"main" | "platino" | "oro" | "plata" | "bronce" | "partner">("oro");
  const [displayLocations, setDisplayLocations] = useState<string[]>(["home", "fixture", "footer"]);
  const [active, setActive] = useState(true);
  const [orderIndex, setOrderIndex] = useState(0);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const locationsList = [
    { id: "home", label: "Portada Pública (Home)" },
    { id: "fixture", label: "Fixture y Tablas" },
    { id: "planilla", label: "Planilla Digital de Árbitro" },
    { id: "footer", label: "Pie de Página Institucional" },
  ];

  useEffect(() => {
    if (sponsorAEditar) {
      setName(sponsorAEditar.name);
      setLogoUrl(sponsorAEditar.logo_url);
      setWebsiteUrl(sponsorAEditar.website_url || "");
      setTier(sponsorAEditar.tier);
      setDisplayLocations(sponsorAEditar.display_locations || ["home", "fixture", "footer"]);
      setActive(sponsorAEditar.active ?? true);
      setOrderIndex(sponsorAEditar.order_index ?? 0);
    } else {
      setName("");
      setLogoUrl("");
      setWebsiteUrl("");
      setTier("oro");
      setDisplayLocations(["home", "fixture", "footer"]);
      setActive(true);
      setOrderIndex(0);
    }
    setErrorMsg(null);
  }, [sponsorAEditar, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("El archivo no debe superar 2 MB.");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await subirAssetLiga(formData, "sponsors");
    setIsUploading(false);

    if (res.success && res.data?.url) {
      setLogoUrl(res.data.url);
    } else {
      setErrorMsg(res.error || "No se pudo subir la imagen del sponsor.");
    }
  };

  const toggleLocation = (locId: string) => {
    setDisplayLocations((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("El nombre de la empresa / marca es obligatorio.");
      return;
    }
    if (!logoUrl.trim()) {
      setErrorMsg("Debés subir o especificar el logotipo del sponsor.");
      return;
    }
    if (displayLocations.length === 0) {
      setErrorMsg("Seleccioná al menos una ubicación de visualización.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onGuardar({
        name: name.trim(),
        logo_url: logoUrl.trim(),
        website_url: websiteUrl.trim() || null,
        tier,
        display_locations: displayLocations,
        active,
        order_index: Number(orderIndex) || 0,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Ocurrió un error al guardar el sponsor.");
      } else {
        onCerrar();
      }
    } catch {
      setErrorMsg("Error de conexión al guardar el sponsor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-sponsor-title"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-scale-up">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-sponsor-title" className="font-serif text-lg font-bold text-[#1A2A44]">
                {sponsorAEditar ? "Editar Sponsor" : "Nuevo Patrocinador Oficial"}
              </h3>
              <p className="text-xs text-slate-500">
                {sponsorAEditar
                  ? "Modificá datos, nivel de patrocinio o visibilidad."
                  : "Incorporá una nueva marca colaboradora a la LFS."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nombre de la Empresa o Marca</label>
            <input
              ref={firstInputRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Banco de Tierra del Fuego, La Anónima, Ushuaia Extremo"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white transition"
            />
          </div>

          {/* Subida de Logotipo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Logotipo Oficial (PNG/WebP/SVG)</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Preview logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-slate-300" />
                )}
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Subir Imagen (Máx 2MB)
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl("")}
                      className="text-xs text-rose-500 hover:underline px-2 py-1 font-semibold"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="O ingresá URL externa directa de la imagen"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] text-[#1A2A44] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Nivel de Patrocinio (Tier)</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as "main" | "platino" | "oro" | "plata" | "bronce" | "partner")}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
              >
                <option value="main">🏆 Main Sponsor (Titular)</option>
                <option value="platino">💎 Sponsor Platino</option>
                <option value="oro">🥇 Sponsor Oro</option>
                <option value="plata">🥈 Sponsor Plata</option>
                <option value="bronce">🥉 Sponsor Bronce</option>
                <option value="partner">🤝 Partner / Colaborador</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Orden de Visualización</label>
              <input
                type="number"
                min={0}
                value={orderIndex}
                onChange={(e) => setOrderIndex(parseInt(e.target.value, 10) || 0)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Sitio Web / Red Social (Destino al hacer clic)</label>
            <input
              type="url"
              placeholder="https://www.empresa.com.ar"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
          </div>

          {/* Ubicaciones de Visualización */}
          <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label className="text-xs font-bold text-slate-800">Ubicaciones Activas en la Plataforma</label>
            <div className="grid grid-cols-2 gap-2">
              {locationsList.map((loc) => (
                <label
                  key={loc.id}
                  className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={displayLocations.includes(loc.id)}
                    onChange={() => toggleLocation(loc.id)}
                    className="w-3.5 h-3.5 text-[#F97316] rounded border-slate-300 focus:ring-[#F97316]"
                  />
                  <span>{loc.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Estado Activo */}
          <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 text-[#F97316] rounded border-slate-300 focus:ring-[#F97316]"
            />
            <div>
              <span className="text-xs font-bold text-slate-800 block">Sponsor Activo</span>
              <span className="text-[10px] text-slate-400 block">Visible en las secciones seleccionadas de la web.</span>
            </div>
          </label>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onCerrar}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-5 py-2.5 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                </>
              ) : (
                sponsorAEditar ? "Guardar Cambios" : "Agregar Sponsor"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
