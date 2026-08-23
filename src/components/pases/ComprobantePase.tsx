/**
 * COMPROBANTE OFICIAL DEL PASE (componente de servidor, imprimible)
 * Se muestra cuando el pase quedó efectivo. Con BotonImprimir se imprime
 * o se guarda como PDF desde el navegador.
 */
export function ComprobantePase({
  numero,
  jugador,
  dni,
  clubOrigen,
  clubDestino,
  fechaEfectivo,
  nroFederativo,
}: {
  numero: string | null;
  jugador: string;
  dni: string;
  clubOrigen: string;
  clubDestino: string;
  fechaEfectivo: string;
  nroFederativo: string | null;
}) {
  return (
    <div className="bg-white border-2 border-[#1A2A44] rounded-2xl p-6 sm:p-8 flex flex-col gap-5 print:border-black print:rounded-none">
      <div className="flex items-center justify-between border-b-2 border-[#1A2A44] pb-4">
        <div>
          <p className="font-serif font-black text-lg text-[#1A2A44] leading-tight">
            Liga de Fútsal de Ushuaia
          </p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
            Comprobante oficial de pase
          </p>
        </div>
        <p className="font-mono font-black text-[#F97316] text-lg">
          {numero ?? "Sin número"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase">Jugador</p>
          <p className="font-bold text-[#1A2A44]">{jugador}</p>
          <p className="text-xs text-slate-500">DNI {dni}</p>
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase">Movimiento</p>
          <p className="font-bold text-[#1A2A44]">
            {clubOrigen} <span className="text-[#F97316]">→</span> {clubDestino}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase">Fecha de efectividad</p>
          <p className="font-bold text-[#1A2A44]">{fechaEfectivo}</p>
        </div>
        {nroFederativo && (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase">Pase federativo (AFA)</p>
            <p className="font-bold text-[#1A2A44]">{nroFederativo}</p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 leading-snug border-t border-slate-200 pt-3">
        El jugador completó el circuito de pase de la liga: solicitud del club destino, revisión
        de la liga, dictamen del club de origen y firma online del jugador. Este documento
        certifica que el pase quedó efectivo en la fecha indicada.
      </p>
    </div>
  );
}
