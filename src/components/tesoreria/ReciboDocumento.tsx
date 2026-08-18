import { formatoPesos, METODO_PAGO_UI, TIPO_CARGO_UI } from "@/lib/core/tesoreria/money";

/**
 * RECIBO OFICIAL (presentación)
 * Documento imprimible con los datos fiscales de la liga, el número
 * correlativo por año y el detalle del pago aprobado. Lo usan la
 * tesorería y el club. Se imprime/guarda como PDF desde el navegador.
 */

export interface ReciboData {
  numero: string; // 2026-0001
  fecha: string; // ISO
  clubNombre: string;
  descripcionCargo: string;
  tipoCargo: string;
  monto: number;
  metodo: string;
  ligaNombre: string | null;
  ligaCuit: string | null;
  ligaDomicilio: string | null;
}

export function ReciboDocumento({ r }: { r: ReciboData }) {
  const fecha = new Date(r.fecha).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-white border-2 border-[#1A2A44] rounded-2xl overflow-hidden shadow-md max-w-2xl mx-auto print:border-black print:shadow-none">
      {/* Cabecera oficial */}
      <div className="bg-[#1A2A44] text-white px-6 py-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#F97316] rounded-full flex items-center justify-center font-black text-sm">
            LFS
          </div>
          <div>
            <p className="font-serif font-black text-base leading-tight">
              {r.ligaNombre ?? "Liga de Fútsal de Ushuaia"}
            </p>
            {r.ligaCuit && <p className="text-[11px] text-slate-300">CUIT: {r.ligaCuit}</p>}
            {r.ligaDomicilio && (
              <p className="text-[11px] text-slate-300">{r.ligaDomicilio}</p>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Recibo oficial
          </p>
          <p className="font-black text-xl text-[#F97316]">N° {r.numero}</p>
          <p className="text-[11px] text-slate-300">{fecha}</p>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="px-6 py-6 flex flex-col gap-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Recibido de
          </p>
          <p className="font-serif text-xl font-black text-[#1A2A44]">{r.clubNombre}</p>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            En concepto de
          </p>
          <p className="font-bold text-sm text-[#1A2A44]">{r.descripcionCargo}</p>
          <p className="text-[11px] text-slate-500">{TIPO_CARGO_UI[r.tipoCargo] ?? r.tipoCargo}</p>
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Método de pago
            </p>
            <p className="font-bold text-sm text-[#1A2A44]">
              {METODO_PAGO_UI[r.metodo] ?? r.metodo}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Total recibido
            </p>
            <p className="font-serif text-3xl font-black text-[#1A2A44]">
              {formatoPesos(r.monto)}
            </p>
          </div>
        </div>

        <div className="border-t border-dashed border-slate-300 pt-4 flex items-center justify-between">
          <p className="text-[10px] text-slate-400 max-w-[55%]">
            Comprobante generado automáticamente por la Plataforma LFS al aprobarse el pago.
            Válido como constancia de pago ante la liga.
          </p>
          <div className="text-center">
            <div className="w-40 border-b border-slate-400 mb-1" />
            <p className="text-[10px] font-bold text-slate-500">Firma y sello · Tesorería</p>
          </div>
        </div>
      </div>
    </div>
  );
}
