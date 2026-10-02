import { armarSaludo } from "@/lib/core/rules/dashboardRules";

/**
 * SALUDO INTELIGENTE — "Buenas tardes, Andrés — tenés 3 cosas que
 * requieren tu atención". Usa la hora de Ushuaia sin importar dónde
 * esté alojado el servidor. Se calcula en el servidor (cero JS extra).
 */
export function SaludoInteligente({
  nombre,
  pendientes,
  rol,
}: {
  nombre: string | null;
  pendientes: number;
  rol: string;
}) {
  return (
    <section className="flex flex-col gap-1">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">
        {rol}
      </p>
      <h1 className="font-serif text-2xl md:text-3xl font-black text-[#1A2A44] leading-tight">
        {armarSaludo(nombre, pendientes)}
      </h1>
    </section>
  );
}
