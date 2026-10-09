"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  UserPlus,
  Mail,
  KeyRound,
  Phone,
  CreditCard,
  Award,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  DollarSign,
} from "lucide-react";
import { registrarArbitro, type NivelArbitroUI } from "@/lib/actions/arbitros.actions";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  niveles: NivelArbitroUI[];
}

export function PanelRegistrarArbitro({ abierto, onCerrar, niveles }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  // Estados del formulario
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [rol, setRol] = useState<"arbitro" | "arbitro_asistente">("arbitro");
  const [levelId, setLevelId] = useState("");
  const [tarifaOverride, setTarifaOverride] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);

  // Estados de feedback
  const [error, setError] = useState<string | null>(null);
  const [creadoExito, setCreadoExito] = useState<{ email: string; pass: string; nombre: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Reset al cerrar
  useEffect(() => {
    if (!abierto) {
      setError(null);
      setCreadoExito(null);
      setCopiado(false);
    }
  }, [abierto]);

  // Tecla Escape para cerrar
  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  // Generador de contraseña rápida de 8 caracteres alfanumérica
  function generarPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    let pass = "";
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
    setVerPassword(true);
  }

  function handleCopiarCredenciales() {
    if (!creadoExito) return;
    const texto = `Hola ${creadoExito.nombre}, te damos la bienvenida a la Plataforma LFS.\n\nTus credenciales para ingresar como Árbitro son:\n🔗 Ingreso: https://liga-futsal-ushuaia.com/login\n📧 Usuario: ${creadoExito.email}\n🔑 Contraseña: ${creadoExito.pass}\n\n¡Por favor no la compartas!`;
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append("nombre", nombre);
    formData.append("dni", dni);
    formData.append("telefono", telefono);
    formData.append("rol", rol);
    formData.append("levelId", levelId);
    formData.append("tarifaOverride", tarifaOverride);
    formData.append("email", email);
    formData.append("password", password);

    startTransition(async () => {
      const res = await registrarArbitro(formData);
      if (!res.ok) {
        setError(res.error ?? "Ocurrió un error al registrar el árbitro.");
      } else {
        setCreadoExito({ email, pass: password, nombre });
        router.refresh();
      }
    });
  }

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#1A2A44]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-auto overflow-hidden border border-slate-150 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera LFS */}
        <div className="bg-[#1A2A44] px-6 py-4 flex items-center justify-between text-white border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center text-white shadow-sm shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold leading-tight">Registrar Árbitro</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Alta en el padrón y creación de cuenta de acceso
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Si ya se creó con éxito, mostramos pantalla de felicitación y copia de credenciales */}
        {creadoExito ? (
          <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="flex flex-col gap-1">
              <h4 className="font-serif text-xl font-black text-[#1A2A44]">
                ¡Árbitro Registrado con Éxito!
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Se creó el perfil en el padrón de la liga y se habilitó su cuenta con rol arbitral.
              </p>
            </div>

            {/* Tarjeta de credenciales listas para entregar */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left flex flex-col gap-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Credenciales de acceso para el árbitro
              </span>
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-semibold">Nombre:</span>
                <span className="font-black text-[#1A2A44]">{creadoExito.nombre}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-semibold">Correo de ingreso:</span>
                <span className="font-mono font-bold text-[#1A2A44]">{creadoExito.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-500 font-semibold">Contraseña:</span>
                <span className="font-mono font-bold text-[#F97316] bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
                  {creadoExito.pass}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
              <button
                type="button"
                onClick={handleCopiarCredenciales}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1A2A44] font-bold text-xs transition active:scale-95 border border-slate-200"
              >
                {copiado ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>¡Copiado al portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>Copiar mensaje de bienvenida</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#1A2A44] hover:bg-[#25395a] text-white font-bold text-xs shadow-md transition active:scale-95"
              >
                Listo, cerrar
              </button>
            </div>
          </div>
        ) : (
          /* Formulario de Alta */
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-5 text-left">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* SECCIÓN 1: DATOS PERSONALES Y ARBITRALES */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                1. Datos del Árbitro
              </span>

              <div>
                <label className="text-xs font-bold text-[#1A2A44] block mb-1">
                  Nombre y Apellido <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Marcelo Gómez"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1A2A44] block mb-1">
                    DNI / Documento
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      placeholder="Ej: 34567890"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1A2A44] block mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Ej: 2901-445566"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] transition"
                    />
                  </div>
                </div>
              </div>

              {/* Rol en Cancha */}
              <div>
                <label className="text-xs font-bold text-[#1A2A44] block mb-1">
                  Rol / Función arbitral
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRol("arbitro")}
                    className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-2 ${
                      rol === "arbitro"
                        ? "border-[#F97316] bg-orange-50 text-[#F97316]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>Árbitro Principal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRol("arbitro_asistente")}
                    className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition flex items-center justify-center gap-2 ${
                      rol === "arbitro_asistente"
                        ? "border-[#F97316] bg-orange-50 text-[#F97316]"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>Asistente / Crono</span>
                  </button>
                </div>
              </div>

              {/* Nivel y Tarifa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#1A2A44] block mb-1">
                    Nivel del padrón
                  </label>
                  <div className="relative">
                    <Award className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <select
                      value={levelId}
                      onChange={(e) => setLevelId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] transition bg-white"
                    >
                      <option value="">Sin nivel asignado</option>
                      {niveles.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.nombre} (${n.tarifa_partido.toLocaleString("es-AR")})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#1A2A44] block mb-1">
                    Tarifa personalizada <span className="text-slate-400 font-normal">(opc.)</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={tarifaOverride}
                      onChange={(e) => setTarifaOverride(e.target.value)}
                      placeholder="Usa la del nivel"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] transition"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: CUENTA DE ACCESO CON CONTRASEÑA */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#1A2A44] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#F97316]" />
                  2. Cuenta de Acceso a la Plataforma
                </span>
                <button
                  type="button"
                  onClick={generarPassword}
                  className="text-[10px] font-bold text-[#F97316] hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Generar contraseña
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A2A44] block mb-1">
                  Correo Electrónico (Usuario) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="arbitro@correo.com"
                    className="w-full rounded-xl border border-slate-300 pl-9 pr-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] transition bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1A2A44] block mb-1">
                  Contraseña Inicial <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={verPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-slate-300 pl-9 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:border-[#F97316] transition bg-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword(!verPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition"
                    title={verPassword ? "Ocultar" : "Mostrar"}
                  >
                    {verPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  El árbitro iniciará sesión con este email y contraseña en el portal.
                </p>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onCerrar}
                disabled={pendiente}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pendiente}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-bold text-xs shadow-md shadow-orange-500/20 transition active:scale-95 disabled:opacity-50"
              >
                {pendiente ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Guardar y Crear Cuenta</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
