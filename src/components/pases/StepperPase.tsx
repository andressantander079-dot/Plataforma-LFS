import { Check, X } from "lucide-react";
import { PASOS_CIRCUITO, progresoPase } from "@/lib/core/rules/pasesRules";

/** Stepper visual del circuito del pase (5 momentos). Componente de servidor. */
export function StepperPase({ estado }: { estado: string }) {
  const paso = progresoPase(estado);
  const cancelado = paso === -1;

  return (
    <div className="flex flex-col gap-1.5">
      {cancelado && (
        <p className="text-xs font-bold text-red-600 flex items-center gap-1.5 mb-1">
          <X className="w-4 h-4" />
          {estado === "8_RECHAZADO" ? "Este pase fue rechazado." : "Este trámite fue cancelado."}
        </p>
      )}
      <ol className="flex flex-col sm:flex-row sm:items-center gap-2">
        {PASOS_CIRCUITO.map((nombre, i) => {
          const hecho = !cancelado && i < paso;
          const actual = !cancelado && i === paso && estado !== "7_COMPLETED";
          const completoFinal = estado === "7_COMPLETED";
          return (
            <li key={nombre} className="flex items-center gap-2 flex-1">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                  cancelado
                    ? "bg-slate-200 text-slate-400"
                    : hecho || completoFinal
                      ? "bg-green-600 text-white"
                      : actual
                        ? "bg-[#F97316] text-white"
                        : "bg-slate-100 text-slate-400"
                }`}
              >
                {hecho || completoFinal ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span
                className={`text-[11px] font-bold leading-tight ${
                  cancelado
                    ? "text-slate-400 line-through"
                    : actual
                      ? "text-[#F97316]"
                      : hecho || completoFinal
                        ? "text-green-700"
                        : "text-slate-400"
                }`}
              >
                {nombre}
              </span>
              {i < PASOS_CIRCUITO.length - 1 && (
                <span className="hidden sm:block flex-1 h-px bg-slate-200" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
