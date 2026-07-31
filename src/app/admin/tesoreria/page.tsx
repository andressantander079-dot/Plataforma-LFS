"use client";

import { useState } from "react";
import { Wallet, ShieldAlert, Lock, ArrowUpRight, ArrowDownRight, Save } from "lucide-react";
import { validateAdminOperation } from "../../../lib/security/adminGuard";

// Mock de Movimientos de Tesorería LFS
const INITIAL_MOVEMENTS = [
  { id: "t1", date: "2026-07-28", type: "Ingreso", club: "Club Camioneros", desc: "Inscripción Plantel Sub-18", dni: "44111222", amount: 15000 },
  { id: "t2", date: "2026-07-29", type: "Egreso", club: "Todos", desc: "Pago Honorarios Árbitro Principal", dni: "20999888", amount: 25000 },
  { id: "t3", date: "2026-07-30", type: "Ingreso", club: "HAF Ushuaia", desc: "Comprobante Pase de Jugador", dni: "45222333", amount: 8000 },
];

export default function TesoreriaAdmin() {
  const [pin, setPin] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [movements, setMovements] = useState(INITIAL_MOVEMENTS);
  const [error, setError] = useState("");

  // Formulario de nuevo movimiento
  const [type, setType] = useState("Ingreso");
  const [club, setClub] = useState("Club Camioneros");
  const [desc, setDesc] = useState("");
  const [dni, setDni] = useState("");
  const [amount, setAmount] = useState("");

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      // Validar el acceso seguro con código "00T00" en el guardrail
      await validateAdminOperation(
        pin,
        "00T00",
        "admin",
        { userId: "admin-1", action: "ACCESO_MODULO", module: "TESORERIA", details: {} },
        async (log) => console.log("[AUDIT_LOG]: Acceso concedido a Tesorería por", log.userId)
      );
      setIsUnlocked(true);
    } catch (err: any) {
      setError(err.message || "Código de acceso inválido.");
    }
  };

  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount) {
      alert("Por favor complete los campos obligatorios.");
      return;
    }
    const newM = {
      id: `t-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      type,
      club,
      desc,
      dni: dni.trim() || "N/A",
      amount: parseFloat(amount),
    };
    setMovements((prev) => [newM, ...prev]);
    setDesc("");
    setDni("");
    setAmount("");
    console.log("[AUDIT_LOG]: Nuevo movimiento registrado", newM);
  };

  const totalBalance = movements.reduce((acc, curr) => {
    return curr.type === "Ingreso" ? acc + curr.amount : acc - curr.amount;
  }, 0);

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white border border-slate-200 rounded-2xl p-6 shadow-xl flex flex-col gap-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Módulo Seguro de Tesorería</h2>
          <p className="text-slate-500 text-xs mt-1">Este sector contiene información contable protegida. Ingrese clave para continuar.</p>
        </div>
        <form onSubmit={handleUnlock} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Ingrese PIN de Seguridad (00T00)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-lg tracking-widest font-black focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
          {error && <span className="text-xs text-red-500 font-bold">{error}</span>}
          <button type="submit" className="w-full py-3 rounded-xl font-bold bg-[#F97316] text-white hover:bg-[#F97316]/95 transition shadow-lg shadow-[#F97316]/10 text-sm">
            Verificar y Desbloquear
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <Wallet className="w-8 h-8 text-[#F97316]" />
            Libro Diario de Tesorería
          </h2>
          <p className="text-slate-500 text-sm mt-1">Moneda del Sistema: Pesos Argentinos (ARS). Movimientos vinculados a DNI de jugadores.</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Saldo Caja Activo</span>
          <span className="text-3xl font-serif font-black text-green-600">${totalBalance.toLocaleString("es-AR")} ARS</span>
        </div>
      </section>

      {/* Grid: Registro y Listado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario de Alta */}
        <form onSubmit={handleAddMovement} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm h-fit">
          <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Registrar Movimiento</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#1A2A44]">
                <option value="Ingreso">Ingreso</option>
                <option value="Egreso">Egreso</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Monto (ARS)</label>
              <input type="number" required placeholder="Importe" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#1A2A44]" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Club Vinculado</label>
            <input type="text" value={club} onChange={(e) => setClub(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44]" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">DNI Vinculado (Opcional)</label>
            <input type="text" placeholder="DNI del Jugador o DT" value={dni} onChange={(e) => setDni(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44]" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Descripción / Detalle</label>
            <input type="text" required placeholder="Concepto del movimiento" value={desc} onChange={(e) => setDesc(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44]" />
          </div>

          <button type="submit" className="w-full mt-2 py-2.5 rounded-xl font-bold bg-[#F97316] text-white hover:bg-[#F97316]/95 transition text-xs flex items-center justify-center gap-1.5 shadow-md">
            <Save className="w-4 h-4" /> Registrar Caja
          </button>
        </form>

        {/* Listado de Movimientos */}
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-x-auto">
          <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase mb-4">Últimas Transacciones</h3>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-wider border-b pb-2 text-left">
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Detalle</th>
                <th className="py-2 px-2">Club</th>
                <th className="py-2 px-2">DNI</th>
                <th className="py-2 px-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-3 px-2 font-mono text-slate-400">{m.date}</td>
                  <td className="py-3 px-2">
                    <span className="font-bold text-[#1A2A44] block">{m.desc}</span>
                    <span className={`text-[9px] font-bold inline-flex items-center gap-1 ${
                      m.type === "Ingreso" ? "text-green-600" : "text-red-500"
                    }`}>
                      {m.type === "Ingreso" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {m.type}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-slate-500 font-semibold">{m.club}</td>
                  <td className="py-3 px-2 font-mono text-slate-550">{m.dni}</td>
                  <td className={`py-3 px-2 text-right font-mono font-bold text-sm ${
                    m.type === "Ingreso" ? "text-green-600" : "text-red-500"
                  }`}>
                    {m.type === "Ingreso" ? `+$${m.amount.toLocaleString("es-AR")}` : `-$${m.amount.toLocaleString("es-AR")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
