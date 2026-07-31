"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Play, Square, Award, AlertTriangle, ArrowLeft, PenTool, QrCode } from "lucide-react";

// Mock de Jugadores de Ambos Equipos (Planilla del Partido)
const INITIAL_ROSTERS = {
  home: { name: "Club Camioneros", court: [1, 5, 8, 10, 12], bench: [2, 3, 9] },
  away: { name: "HAF Ushuaia", court: [3, 4, 7, 9, 10], bench: [1, 5, 8] },
};

export default function PlanillaArbitro() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  // Estados del partido
  const [roster, setRoster] = useState(INITIAL_ROSTERS);
  const [goals, setGoals] = useState<{ team: "home" | "away"; player: number; minute: number; type: string }[]>([]);
  const [cards, setCards] = useState<{ player: number; team: "home" | "away"; type: "yellow" | "red" | "double_yellow"; minute: number }[]>([]);
  const [timer, setTimer] = useState({ minutes: 0, seconds: 0, active: false });
  
  // Cierre de 8 Pasos
  const [closingStep, setClosingStep] = useState<number | null>(null); // null si no está cerrando
  const [observations, setObservations] = useState("");
  const [signatures, setSignatures] = useState<string[]>([]); // DT Local, DT Visitante, Planillero, Árbitro 1, Árbitro 2

  // Modal de Eventos de un jugador
  const [selectedPlayer, setSelectedPlayer] = useState<{ team: "home" | "away"; number: number } | null>(null);

  const toggleTimer = () => {
    setTimer((t) => ({ ...t, active: !t.active }));
  };

  const handleRegisterGoal = (type: string) => {
    if (!selectedPlayer) return;
    setGoals((prev) => [...prev, { team: selectedPlayer.team, player: selectedPlayer.number, minute: 12, type }]);
    setSelectedPlayer(null);
  };

  const handleRegisterCard = (type: "yellow" | "red" | "double_yellow") => {
    if (!selectedPlayer) return;
    setCards((prev) => [...prev, { team: selectedPlayer.team, player: selectedPlayer.number, type, minute: 15 }]);
    setSelectedPlayer(null);
  };

  const handleSubstitution = (subNumber: number) => {
    if (!selectedPlayer) return;
    const team = selectedPlayer.team;
    setRoster((prev) => {
      const court = prev[team].court.map((n) => (n === selectedPlayer.number ? subNumber : n));
      const bench = prev[team].bench.map((n) => (n === subNumber ? selectedPlayer.number : n));
      return { ...prev, [team]: { ...prev[team], court, bench } };
    });
    setSelectedPlayer(null);
  };

  const handleAddSignature = (role: string) => {
    setSignatures((prev) => [...prev, role]);
  };

  const getScore = (team: "home" | "away") => goals.filter((g) => g.team === team).length;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      {/* Header con Marcador */}
      <section className="bg-[#1A2A44] text-white rounded-2xl p-6 shadow-xl border-b-4 border-[#F97316] flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-xl transition text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Planilla de Arbitraje v3.0</span>
            <h2 className="font-serif text-xl font-bold">Partido #{matchId}</h2>
          </div>
        </div>

        {/* Marcador Central */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-sm font-bold block">{roster.home.name}</span>
            <span className="text-[10px] text-slate-400 font-bold">Local</span>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/50 px-6 py-3 rounded-2xl border border-slate-750 font-mono text-3xl font-black">
            <span>{getScore("home")}</span>
            <span className="text-slate-600">:</span>
            <span>{getScore("away")}</span>
          </div>
          <div className="text-left">
            <span className="text-sm font-bold block">{roster.away.name}</span>
            <span className="text-[10px] text-slate-400 font-bold">Visitante</span>
          </div>
        </div>

        {/* Cronómetro */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold">20:00</span>
          <button onClick={toggleTimer} className={`p-3 rounded-xl transition ${
            timer.active ? "bg-red-500 text-white" : "bg-[#F97316] text-white"
          }`}>
            {timer.active ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>
      </section>

      {closingStep === null ? (
        /* VISTA CENTRAL: CANCHA Y BANCO */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Suplentes Local */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase border-b pb-2 mb-3">Banco {roster.home.name}</h3>
            <div className="flex flex-col gap-2">
              {roster.home.bench.map((n) => (
                <div key={n} className="flex justify-between items-center p-2 bg-slate-50 border rounded-xl text-xs font-bold text-slate-700">
                  <span># {n} Jugador Suplente</span>
                  <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600">Sub</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cancha Gráfica Central (SVG de Fútsal) */}
          <div className="lg:col-span-2 bg-[#2E7D32] border-4 border-white rounded-2xl p-4 shadow-lg min-h-[300px] flex flex-col justify-between relative overflow-hidden">
            {/* Líneas de la Cancha */}
            <div className="absolute inset-0 border-2 border-white opacity-20 pointer-events-none" />
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l border-white opacity-20 pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white opacity-20 pointer-events-none" />

            {/* Jugadores Local */}
            <div className="flex justify-around items-center h-1/2 relative z-10">
              {roster.home.court.map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedPlayer({ team: "home", number: n })}
                  className="w-10 h-10 rounded-full bg-[#1A2A44] border-2 border-white text-white font-mono font-black text-xs shadow-md hover:scale-105 transition"
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Jugadores Visitante */}
            <div className="flex justify-around items-center h-1/2 relative z-10">
              {roster.away.court.map((n) => (
                <button
                  key={n}
                  onClick={() => setSelectedPlayer({ team: "away", number: n })}
                  className="w-10 h-10 rounded-full bg-[#F97316] border-2 border-white text-white font-mono font-black text-xs shadow-md hover:scale-105 transition"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Suplentes Visitante */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase border-b pb-2 mb-3">Banco {roster.away.name}</h3>
            <div className="flex flex-col gap-2">
              {roster.away.bench.map((n) => (
                <div key={n} className="flex justify-between items-center p-2 bg-slate-50 border rounded-xl text-xs font-bold text-slate-700">
                  <span># {n} Jugador Suplente</span>
                  <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600">Sub</span>
                </div>
              ))}
            </div>
          </div>

          {/* Botón de Cierre */}
          <div className="lg:col-span-4 flex justify-end">
            <button
              onClick={() => setClosingStep(1)}
              className="px-6 py-3 bg-[#F97316] hover:bg-[#F97316]/95 text-white font-bold text-sm rounded-xl shadow-lg transition"
            >
              Iniciar Cierre de Planilla (8 Pasos)
            </button>
          </div>
        </div>
      ) : (
        /* WIZARD DE CIERRE DE 8 PASOS */
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
          <div className="border-b pb-3 flex justify-between items-center">
            <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Asistente de Cierre Secuencial - Paso {closingStep} de 8</h3>
            <span className="text-xs text-slate-400 font-bold">Cierre Digital Obligatorio LFS</span>
          </div>

          {/* Renderizado por Paso */}
          {closingStep === 1 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-slate-700">Paso 1: Cerrar Planilla</h4>
              <p className="text-xs text-slate-500">Confirma que los goles, tarjetas y sustituciones registradas corresponden a los eventos del partido.</p>
              <button onClick={() => setClosingStep(2)} className="w-fit px-4 py-2 bg-[#1A2A44] text-white rounded-xl font-bold text-xs">Confirmar Eventos</button>
            </div>
          )}

          {closingStep === 2 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-slate-700">Paso 2: Observaciones Especiales (Lesiones/Incidentes)</h4>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Escriba aquí los detalles..."
                className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs w-full min-h-[100px] focus:outline-none"
              />
              <button onClick={() => setClosingStep(3)} className="w-fit px-4 py-2 bg-[#1A2A44] text-white rounded-xl font-bold text-xs">Guardar Observaciones</button>
            </div>
          )}

          {closingStep >= 3 && closingStep <= 7 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-slate-700">
                Paso {closingStep}: Firma de Autoridad (
                {closingStep === 3 ? "DT Club Local" :
                 closingStep === 4 ? "DT Club Visitante" :
                 closingStep === 5 ? "Planillero de Mesa" :
                 closingStep === 6 ? "Árbitro Principal" :
                 "Segundo Árbitro"}
                )
              </h4>
              <div className="p-8 border-2 border-dashed rounded-xl bg-slate-50 flex flex-col items-center gap-3">
                <PenTool className="w-8 h-8 text-slate-400" />
                <p className="text-xs text-slate-400">Dibuje su firma táctil en la pantalla o haga clic en firmar.</p>
                <button
                  type="button"
                  onClick={() => {
                    handleAddSignature(`Firma_${closingStep}`);
                    setClosingStep((prev) => (prev ? prev + 1 : 8));
                  }}
                  className="px-5 py-2 bg-[#F97316] text-white text-xs font-bold rounded-xl shadow-md"
                >
                  Registrar Firma Digital
                </button>
              </div>
            </div>
          )}

          {closingStep === 8 && (
            <div className="flex flex-col gap-4 text-center items-center py-6">
              <QrCode className="w-24 h-24 text-[#1A2A44]" />
              <div>
                <h4 className="font-serif text-lg font-bold text-[#1A2A44]">Paso 8: Hash Criptográfico y Validación QR</h4>
                <p className="text-slate-500 text-xs mt-1">La planilla se ha firmado digitalmente y se ha archivado con un código de validación único.</p>
              </div>
              <div className="p-3 bg-slate-50 border rounded-xl font-mono text-[10px] text-slate-550 w-full max-w-sm">
                HASH: sha256_e8c3a9f455587654e747bbf7863futsal
              </div>
              <button
                onClick={() => {
                  alert("Planilla enviada e impresa con éxito.");
                  router.push("/arbitro/dashboard");
                }}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Finalizar y Enviar Planilla
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL TÁCTIL DE EVENTO DEL JUGADOR */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-[#1A2A44]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            <h3 className="font-sans font-black text-base text-[#1A2A44] border-b pb-2">
              Registrar Evento: #{selectedPlayer.number} ({selectedPlayer.team === "home" ? "Local" : "Visitante"})
            </h3>

            {/* Goles (sin campo de asistencias, prohibido) */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Registrar Gol</span>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleRegisterGoal("regular")} className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg">Regular</button>
                <button onClick={() => handleRegisterGoal("penalty")} className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg">Penal</button>
                <button onClick={() => handleRegisterGoal("own_goal")} className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded-lg">Autogol</button>
              </div>
            </div>

            {/* Tarjetas */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Tarjetas</span>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => handleRegisterCard("yellow")} className="py-2 bg-yellow-50 text-yellow-600 border border-yellow-200 text-[10px] font-bold rounded-lg">Amarilla</button>
                <button onClick={() => handleRegisterCard("double_yellow")} className="py-2 bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-bold rounded-lg">Doble Am.</button>
                <button onClick={() => handleRegisterCard("red")} className="py-2 bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold rounded-lg">Roja Dir.</button>
              </div>
            </div>

            {/* Sustituciones */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Sustituir por Suplente</span>
              <div className="flex gap-2">
                {roster[selectedPlayer.team].bench.map((benchNum) => (
                  <button
                    key={benchNum}
                    onClick={() => handleSubstitution(benchNum)}
                    className="flex-1 py-2 bg-slate-150 hover:bg-slate-250 text-slate-700 text-[10px] font-bold rounded-lg"
                  >
                    Salir por #{benchNum}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelectedPlayer(null)}
              className="mt-3 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
