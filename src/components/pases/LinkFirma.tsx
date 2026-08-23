"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

/** Link de firma del jugador: se copia y se manda por WhatsApp (dura 72 hs). */
export function LinkFirma({ token }: { token: string }) {
  const [copiado, setCopiado] = useState(false);

  const url =
    typeof window !== "undefined" ? `${window.location.origin}/firmar-pase/${token}` : "";

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {
          window.prompt("Copiá el link de firma:", url);
        }
      }}
      className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 transition flex items-center gap-1"
    >
      {copiado ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
      {copiado ? "¡Link copiado!" : "Copiar link de firma"}
    </button>
  );
}
