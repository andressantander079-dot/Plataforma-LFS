import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, ArrowRight, Gavel, Send, History } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { ESTADO_PASE_UI, type EstadoPase } from "@/lib/core/rules/pasesRules";
import { FormularioSolicitudPase } from "@/components/pases/FormularioSolicitudPase";
import { DecisionClubOrigen } from "@/components/pases/DecisionClubOrigen";
import { LinkFirma } from "@/components/pases/LinkFirma";
import { BotonRetirarSolicitud } from "@/components/pases/BotonRetirarSolicitud";
import { FormularioBajaJugador } from "@/components/pases/FormularioBajaJugador";

/**
 * TRÁMITES DEL CLUB — Pases y transferencias
 *  · Pedir un pase (con mercado abierto)
 *  · Dictaminar los pases que otros clubes le piden a TU club
 *  · Seguir tus solicitudes (y compartir el link de firma al jugador)
 *  · Dar de baja jugadores (quedan libres, con registro)
 */

interface PaseClub {
  id: string;
  status: string;
  created_at: string;
  numero_pase: string | null;
  from_club_id: string | null;
  to_club_id: string | null;
  metadata: Record<string, unknown>;
  players: { first_name: string; last_name: string; dni: string } | null;
  from: { name: string } | null;
  to: { name: string } | null;
}

export default async function ClubTramites() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  const clubId = profile?.club_id;
  if (!clubId) redirect("/login");

  const [{ data: ventana }, { data: pases }, { data: plantel }] = await Promise.all([
    supabase.rpc("hay_ventana_pases"),
    supabase
      .from("transfers")
      .select(
        "id, status, created_at, numero_pase, from_club_id, to_club_id, metadata, players(first_name, last_name, dni), from:clubs!transfers_from_club_id_fkey(name), to:clubs!transfers_to_club_id_fkey(name)"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("player_categories")
      .select("player_id, players(first_name, last_name)")
      .eq("club_id", clubId),
  ]);

  const todos = (pases ?? []) as unknown as PaseClub[];
  const esperanDictamen = todos.filter(
    (p) => p.status === "4_CLUB_B_DECISION" && p.from_club_id === clubId
  );
  const misSolicitudes = todos.filter((p) => p.to_club_id === clubId);
  const historialCesiones = todos.filter((p) => p.from_club_id === clubId);

  // Plantel propio (para la baja), sin duplicados por categoría
  const jugadoresMap = new Map<string, string>();
  for (const pc of plantel ?? []) {
    const pl = pc.players as unknown as { first_name: string; last_name: string } | null;
    if (pl) jugadoresMap.set(pc.player_id, `${pl.last_name}, ${pl.first_name}`);
  }
  const jugadores = [...jugadoresMap.entries()].map(([id, nombre]) => ({ id, nombre }));

  const badge = (estado: string) => {
    const ui = ESTADO_PASE_UI[estado as EstadoPase] ?? {
      label: estado,
      className: "bg-slate-100 text-slate-600",
    };
    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ui.className}`}>
        {ui.label}
      </span>
    );
  };

  const nombreJugador = (p: PaseClub) =>
    p.players ? `${p.players.last_name}, ${p.players.first_name}` : "—";

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-[#F97316]" />
            Trámites y Pases
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Pedí pases, dictaminá los que te piden y seguí cada trámite paso a paso.
          </p>
        </div>
        <FormularioSolicitudPase ventanaAbierta={!!ventana} />
      </div>

      {/* Esperan tu dictamen */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <Gavel className="w-4 h-4 text-[#F97316]" />
          Esperan tu dictamen ({esperanDictamen.length})
        </h2>
        {esperanDictamen.length === 0 ? (
          <p className="text-xs text-slate-400">
            Ningún club te pidió un jugador por ahora.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {esperanDictamen.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-orange-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm"
              >
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-sm text-[#1A2A44]">{nombreJugador(p)}</p>
                  <p className="text-[11px] text-slate-500">
                    Lo quiere: <span className="font-bold">{p.to?.name ?? "—"}</span> · pedido el{" "}
                    {new Date(p.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <DecisionClubOrigen transferId={p.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mis solicitudes */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <Send className="w-4 h-4 text-[#F97316]" />
          Pases que pediste ({misSolicitudes.length})
        </h2>
        {misSolicitudes.length === 0 ? (
          <p className="text-xs text-slate-400">Todavía no pediste ningún pase.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {misSolicitudes.map((p) => {
              const meta = p.metadata ?? {};
              const token =
                typeof meta.firma_token === "string" ? (meta.firma_token as string) : null;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm"
                >
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
                      {nombreJugador(p)}
                      {p.numero_pase && (
                        <span className="font-mono text-[10px] text-[#F97316]">{p.numero_pase}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>{p.from?.name ?? "Libre"}</span>
                      <ArrowRight className="w-3 h-3 text-[#F97316]" />
                      <span>tu club</span>
                      <span className="text-slate-300">
                        · {new Date(p.created_at).toLocaleDateString("es-AR")}
                      </span>
                    </p>
                  </div>
                  {badge(p.status)}
                  {p.status === "5_PLAYER_SIGNATURE" && token && <LinkFirma token={token} />}
                  {p.status === "1_INIT_CLUB_A" && <BotonRetirarSolicitud transferId={p.id} />}
                  <Link
                    href={`/club/tramites/pase/${p.id}`}
                    className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:border-[#F97316] hover:text-[#F97316] transition"
                  >
                    Ver detalle
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Historial de cesiones */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <History className="w-4 h-4 text-[#F97316]" />
          Jugadores que cediste ({historialCesiones.length})
        </h2>
        {historialCesiones.length === 0 ? (
          <p className="text-xs text-slate-400">Ningún jugador se fue de tu club todavía.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {historialCesiones.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm"
              >
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-sm text-[#1A2A44]">{nombreJugador(p)}</p>
                  <p className="text-[11px] text-slate-500">
                    hacia <span className="font-bold">{p.to?.name ?? "—"}</span> ·{" "}
                    {new Date(p.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
                {badge(p.status)}
                <Link
                  href={`/club/tramites/pase/${p.id}`}
                  className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:border-[#F97316] hover:text-[#F97316] transition"
                >
                  Ver detalle
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bajas */}
      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6">
        <h2 className="font-bold text-sm text-[#1A2A44]">Bajas de jugadores</h2>
        <p className="text-[11px] text-slate-500 -mt-2">
          Si un jugador deja tu club sin irse a otro, dalo de baja: queda libre y registrado.
          Si se va a otro club, corresponde un pase (no una baja).
        </p>
        <FormularioBajaJugador jugadores={jugadores} />
      </section>
    </div>
  );
}
