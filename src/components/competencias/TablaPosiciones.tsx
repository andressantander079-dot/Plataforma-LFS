import type { FilaTabla } from "@/lib/core/competencias/tabla";

/**
 * TABLA DE POSICIONES (componente compartido)
 * Se usa en: detalle del torneo (admin), panel del club y /posiciones pública.
 * Resalta la valla menos vencida (escudo verde).
 */

export interface FilaTablaConNombre extends FilaTabla {
  nombre: string;
}

export function TablaPosiciones({
  filas,
  vallaId,
}: {
  filas: FilaTablaConNombre[];
  vallaId?: string | null;
}) {
  if (filas.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">
        Todavía no hay equipos en esta tabla.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
            <th className="text-left py-2 pl-3 font-bold">#</th>
            <th className="text-left py-2 font-bold">Equipo</th>
            <th className="text-center py-2 font-bold">PJ</th>
            <th className="text-center py-2 font-bold">PG</th>
            <th className="text-center py-2 font-bold">PE</th>
            <th className="text-center py-2 font-bold">PP</th>
            <th className="text-center py-2 font-bold">GF</th>
            <th className="text-center py-2 font-bold">GC</th>
            <th className="text-center py-2 font-bold">DIF</th>
            <th className="text-center py-2 pr-3 font-black text-[#1A2A44]">PTS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((fila, idx) => (
            <tr key={fila.teamId} className={idx === 0 ? "bg-orange-50/50" : ""}>
              <td className="py-2.5 pl-3 text-slate-400 font-bold">{idx + 1}</td>
              <td className="py-2.5 font-bold text-[#1A2A44]">
                <span className="flex items-center gap-1.5">
                  {fila.nombre}
                  {vallaId === fila.teamId && (
                    <span
                      title="Valla menos vencida del torneo"
                      className="text-[9px] font-black uppercase bg-green-100 text-green-700 rounded-full px-1.5 py-0.5"
                    >
                      Valla
                    </span>
                  )}
                </span>
              </td>
              <td className="py-2.5 text-center text-slate-600">{fila.pj}</td>
              <td className="py-2.5 text-center text-slate-600">{fila.pg}</td>
              <td className="py-2.5 text-center text-slate-600">{fila.pe}</td>
              <td className="py-2.5 text-center text-slate-600">{fila.pp}</td>
              <td className="py-2.5 text-center text-slate-600">{fila.gf}</td>
              <td className="py-2.5 text-center text-slate-600">{fila.gc}</td>
              <td className="py-2.5 text-center text-slate-600">
                {fila.dif > 0 ? `+${fila.dif}` : fila.dif}
              </td>
              <td className="py-2.5 pr-3 text-center font-black text-[#F97316]">{fila.puntos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
