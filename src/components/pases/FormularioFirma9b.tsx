"use client";

import { useState, useTransition } from "react";
import {
  Loader2,
  AlertCircle,
  PenLine,
  CheckCircle2,
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { firmarPasePublico9b, rechazarPaseJugadorAction } from "@/lib/actions/pases.actions";
import {
  generarTextoConsentimiento,
  generarTextoTutor,
  type TipoPase,
} from "@/lib/core/rules/pasesRules";
import { FirmaCanvas } from "./FirmaCanvas";
import { CampoFoto } from "./CampoFoto";

/**
 * Pantalla de firma profesional del pase (Paso 9B): el jugador lee el
 * documento de conformidad (con su DNI completándose en vivo), dibuja su
 * firma, se saca una foto del DNI en el momento y acepta — o rechaza el pase
 * con un motivo. Si es menor de edad, también firma su madre, padre o tutor/a.
 */
export function FormularioFirma9b({
  token,
  jugador,
  dniUltimos3,
  esMenor,
  clubOrigen,
  clubDestino,
  tipoPase,
  fechaRetorno,
  torneo,
}: {
  token: string;
  jugador: string;
  dniUltimos3: string;
  esMenor: boolean;
  clubOrigen: string;
  clubDestino: string;
  tipoPase: TipoPase;
  fechaRetorno: string | null;
  torneo: string | null;
}) {
  const [dni, setDni] = useState("");
  const [firmaJugador, setFirmaJugador] = useState<string | null>(null);
  const [fotoDni, setFotoDni] = useState<File | null>(null);
  const [acepta, setAcepta] = useState(false);

  // Tutor (solo menores)
  const [tutorParentesco, setTutorParentesco] = useState("");
  const [tutorNombre, setTutorNombre] = useState("");
  const [tutorApellido, setTutorApellido] = useState("");
  const [tutorDni, setTutorDni] = useState("");
  const [tutorFirma, setTutorFirma] = useState<string | null>(null);
  const [tutorFotoDni, setTutorFotoDni] = useState<File | null>(null);

  const [modalRechazo, setModalRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [firmado, setFirmado] = useState(false);
  const [rechazado, setRechazado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 w-full";

  const dniValido = /^\d{6,9}$/.test(dni.trim());
  const dniDocumento = dniValido ? dni.trim() : `•••${dniUltimos3}`;

  const textoDocumento = generarTextoConsentimiento({
    jugador,
    dni: dniDocumento,
    clubOrigen,
    clubDestino,
    tipo: tipoPase,
    fechaRetorno,
    torneo,
  });

  const tutorCompleto =
    tutorParentesco.trim() !== "" &&
    tutorNombre.trim() !== "" &&
    tutorApellido.trim() !== "" &&
    /^\d{6,9}$/.test(tutorDni.trim());

  const textoTutor =
    esMenor && tutorCompleto
      ? generarTextoTutor({
          parentesco: tutorParentesco,
          nombre: tutorNombre.trim(),
          apellido: tutorApellido.trim(),
          dni: tutorDni.trim(),
        })
      : null;

  const listoParaFirmar =
    dniValido &&
    !!firmaJugador &&
    !!fotoDni &&
    acepta &&
    (!esMenor || (tutorCompleto && !!tutorFirma && !!tutorFotoDni));

  function enviarFirma() {
    setError(null);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("dni", dni.trim());
    formData.set("acepta_documento", "on");
    formData.set("firma_jugador", firmaJugador ?? "");
    if (fotoDni) formData.set("foto_dni", fotoDni);
    if (esMenor) {
      formData.set("tutor_parentesco", tutorParentesco);
      formData.set("tutor_nombre", tutorNombre.trim());
      formData.set("tutor_apellido", tutorApellido.trim());
      formData.set("tutor_dni", tutorDni.trim());
      formData.set("firma_tutor", tutorFirma ?? "");
      if (tutorFotoDni) formData.set("foto_dni_tutor", tutorFotoDni);
    }
    startTransition(async () => {
      const res = await firmarPasePublico9b(formData);
      if (res.error) setError(res.error);
      else setFirmado(true);
    });
  }

  function enviarRechazo() {
    setError(null);
    if (!dniValido) {
      setError("Ingresá tu DNI para confirmar el rechazo.");
      return;
    }
    if (motivoRechazo.trim().length < 10) {
      setError("Contanos el motivo del rechazo (mínimo 10 caracteres).");
      return;
    }
    startTransition(async () => {
      const res = await rechazarPaseJugadorAction(token, dni.trim(), motivoRechazo.trim());
      if (res.error) setError(res.error);
      else {
        setModalRechazo(false);
        setRechazado(true);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Pantallas finales
  // -------------------------------------------------------------------------

  if (firmado) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
        <CheckCircle2 className="w-12 h-12 text-green-600" />
        <h2 className="font-black text-lg text-green-900">¡Pase firmado!</h2>
        <p className="text-sm text-green-800 max-w-md">
          Tu conformidad quedó registrada. La liga revisa la documentación y, si está todo en
          orden, oficializa el pase. Te van a avisar por los canales del club.
        </p>
      </div>
    );
  }

  if (rechazado) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
        <XCircle className="w-12 h-12 text-red-500" />
        <h2 className="font-black text-lg text-red-900">Pase rechazado</h2>
        <p className="text-sm text-red-800 max-w-md">
          Registramos tu decisión y el motivo. Los dos clubes y la liga ya fueron notificados.
        </p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Formulario
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5">
      {/* Documento en vivo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <PenLine className="w-3.5 h-3.5" /> Leé tu documento (se completa con tu DNI)
        </p>
        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4">
          {textoDocumento}
        </pre>
        {textoTutor && (
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-purple-900 bg-purple-50 border border-purple-200 rounded-xl p-4">
            {textoTutor}
          </pre>
        )}
      </div>

      {/* Datos del jugador */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
        <h3 className="font-black text-sm text-[#1A2A44]">1️⃣ Tus datos</h3>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">
            Tu DNI (sin puntos) — confirma tu identidad
          </label>
          <input
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder={`Termina en ${dniUltimos3}`}
            maxLength={9}
            className={CLASE_INPUT}
          />
          {dni.length > 0 && !dniValido && (
            <p className="text-[10px] text-red-600 font-semibold">
              El DNI debe tener entre 6 y 9 números.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">Tu firma</label>
          <FirmaCanvas onCambio={setFirmaJugador} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">
            Foto de tu DNI (se saca ahora, en el momento)
          </label>
          <CampoFoto nombre="foto_dni_visible" onCambio={setFotoDni} />
        </div>
      </div>

      {/* Bloque tutor (solo menores) */}
      {esMenor && (
        <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-black text-sm text-purple-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> 2️⃣ Autorización de tu madre, padre o tutor/a
            </h3>
            <p className="text-[11px] text-purple-700">
              Como sos menor de edad, un adulto responsable tiene que autorizar el pase con sus
              datos, su firma y la foto de su DNI.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-purple-900">Parentesco</label>
              <select
                value={tutorParentesco}
                onChange={(e) => setTutorParentesco(e.target.value)}
                className={CLASE_INPUT}
              >
                <option value="">Elegí…</option>
                <option value="madre">Madre</option>
                <option value="padre">Padre</option>
                <option value="tutor/a legal">Tutor/a legal</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-purple-900">DNI (sin puntos)</label>
              <input
                value={tutorDni}
                onChange={(e) => setTutorDni(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={9}
                className={CLASE_INPUT}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-purple-900">Nombre</label>
              <input
                value={tutorNombre}
                onChange={(e) => setTutorNombre(e.target.value)}
                maxLength={60}
                className={CLASE_INPUT}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-purple-900">Apellido</label>
              <input
                value={tutorApellido}
                onChange={(e) => setTutorApellido(e.target.value)}
                maxLength={60}
                className={CLASE_INPUT}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-purple-900">Firma del adulto</label>
            <FirmaCanvas onCambio={setTutorFirma} etiqueta="Que firme acá tu madre, padre o tutor/a" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-purple-900">
              Foto del DNI del adulto (se saca ahora)
            </label>
            <CampoFoto nombre="tutor_foto_dni_visible" onCambio={setTutorFotoDni} />
          </div>
        </div>
      )}

      {/* Aceptación */}
      <label className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="w-5 h-5 mt-0.5 accent-green-600"
        />
        <span className="text-xs text-slate-700 leading-relaxed">
          <b>Sí, acepto.</b> Leí el documento completo, confirmo que los datos son míos y que la
          firma dibujada y la foto del DNI me pertenecen. Entiendo que esta conformidad digital
          tiene validez ante la Liga de Fútsal de Ushuaia.
        </span>
      </label>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          disabled={pendiente || !listoParaFirmar}
          onClick={() => {
            if (
              window.confirm(
                "¿Confirmás la firma del documento? Una vez firmado, la liga revisa y oficializa el pase."
              )
            )
              enviarFirma();
          }}
          className="w-full px-5 py-3.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {pendiente ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PenLine className="w-4 h-4" />
          )}
          Firmar y enviar
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            setError(null);
            setModalRechazo(true);
          }}
          className="w-full px-5 py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition disabled:opacity-50"
        >
          No acepto el pase
        </button>
      </div>

      {/* Modal de rechazo */}
      {modalRechazo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md flex flex-col gap-4 shadow-2xl">
            <h3 className="font-black text-sm text-red-700">Rechazar el pase</h3>
            <p className="text-[11px] text-slate-500">
              El pase se cancela y tu decisión (con el motivo) queda visible para los dos clubes y
              la liga.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">Tu DNI</label>
              <input
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={9}
                className={CLASE_INPUT}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">
                Motivo del rechazo (mínimo 10 caracteres)
              </label>
              <textarea
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Ej.: No me puse de acuerdo con el club destino…"
                className={`${CLASE_INPUT} resize-none`}
              />
            </div>
            {error && (
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pendiente}
                onClick={() => setModalRechazo(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:border-slate-400 transition disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={enviarRechazo}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
