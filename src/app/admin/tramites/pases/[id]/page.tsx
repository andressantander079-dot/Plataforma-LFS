"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ClipboardList, Check, AlertTriangle, ShieldCheck, Clock } from "lucide-react";
import { isCredentialActive } from "../../../../../lib/core/rules/pasesRules";

// Mock de Transferencia
const MOCK_TRANSFER = {
  id: "t-100",
  player: { name: "Lucas Aravena", dni: "44111222" },
  clubA: "Club Camioneros", // Destino
  clubB: "HAF Ushuaia",     // Origen
  status: "4_CLUB_B_DECISION", // Paso activo
  approvedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // Aprobado hace 12 horas
};

const STEPS = [
  { step: "1_INIT_CLUB_A", name: "1. Solicitud Club A" },
  { step: "2_FVF_REVIEW", name: "2. Revisión FVF" },
  { step: "3_NOTIFY_CLUB_B", name: "3. Notificado Club B" },
  { step: "4_CLUB_B_DECISION", name: "4. Dictamen Club B" },
  { step: "5_PLAYER_SIGNATURE", name: "5. Firma Jugador" },
  { step: "6_FINAL_AUDIT", name: "6. Auditoría FVF" },
  { step: "7_COMPLETED", name: "7. Efectivo" },
];

export default function PaseDetailAdmin() {
  const params = useParams();
  const router = useRouter();
  const transferId = params.id as string;

  const [transfer, setTransfer] = useState(MOCK_TRANSFER);

  // Calcular índice del paso actual
  const currentStepIndex = STEPS.findIndex((s) => s.step === transfer.status);

  // Calcular vigencia de credenciales temporales de 72h
  const isActive = isCredentialActive(transfer.approvedAt);
  const expirationTime = new Date(new Date(transfer.approvedAt).getTime() + 72 * 60 * 60 * 1000);
  const hoursLeft = Math.max(0, Math.round((expirationTime.getTime() - Date.now()) / (1000 * 60 * 60)));

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-[#F97316]" />
            Auditoría de Pase #{transferId}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Seguimiento de pases y transferencias a través de la máquina de estados de 7 pasos.</p>
        </div>
      </section>

      {/* Stepper de 7 Pasos LFS */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase">Estado del Trámite</h3>
        
        {/* Barra Visual */}
        <div className="flex justify-between items-center gap-2 w-full mt-4 overflow-x-auto pb-4">
          {STEPS.map((s, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div key={s.step} className="flex flex-col items-center flex-1 min-w-[90px] text-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                  isCompleted 
                    ? "bg-green-600 text-white shadow-md shadow-green-100" 
                    : isCurrent 
                    ? "bg-[#F97316] text-white shadow-md shadow-orange-100 animate-pulse" 
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-[9px] font-bold ${
                  isCurrent ? "text-[#F97316]" : "text-slate-500"
                }`}>
                  {s.name}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Grid: Detalles y Credenciales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ficha del Pase */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Ficha del Jugador</h3>
          
          <div className="flex flex-col gap-3 text-sm border-t border-slate-100 pt-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Jugador:</span>
              <span className="font-bold text-[#1A2A44]">{transfer.player.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">DNI (Identificador Único):</span>
              <span className="font-mono font-bold text-[#1A2A44]">{transfer.player.dni}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Club Origen (B):</span>
              <span className="font-semibold text-slate-600">{transfer.clubB}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Club Destino (A):</span>
              <span className="font-semibold text-[#F97316]">{transfer.clubA}</span>
            </div>
          </div>
        </section>

        {/* Panel de Firma y Credencial Temporal (72h) */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4 justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#F97316]" />
              Firma Digital del Jugador
            </h3>
            <p className="text-slate-500 text-xs mt-1">Al aprobar el Club B, se habilita una ventana de 72 horas para registrar la firma digital del jugador/tutor.</p>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-2">
            {isActive ? (
              <div className="flex items-start gap-3 p-4 bg-green-50 text-green-700 text-xs rounded-xl border border-green-150">
                <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Credencial Temporal Activa</p>
                  <p className="text-slate-550 mt-0.5">La credencial es válida. Habilitada para firmas. Expira en aproximadamente <strong>{hoursLeft} horas</strong>.</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-red-50 text-red-750 text-xs rounded-xl border border-red-150">
                <AlertTriangle className="w-5 h-5 text-red-650 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Credencial Expirada</p>
                  <p className="text-slate-550 mt-0.5">Se superó la ventana de 72 horas de habilitación. Se debe volver a solicitar la decisión al club de origen.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
