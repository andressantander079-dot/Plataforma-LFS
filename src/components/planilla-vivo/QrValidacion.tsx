"use client";

import QRCode from "react-qr-code";

/** QR de validación: apunta a la planilla digital pública del partido. */
export function QrValidacion({ url }: { url: string }) {
  return (
    <div className="bg-white p-1.5 inline-block rounded-lg border border-slate-300">
      <QRCode value={url} size={72} />
    </div>
  );
}
