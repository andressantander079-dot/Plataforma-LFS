/**
 * GENERADOR DE FIXTURE — Sistema de liga todos contra todos
 * Algoritmo del círculo (método Berger): cada equipo juega contra todos
 * los demás exactamente una vez por vuelta, distribuidos en fechas.
 * Si la cantidad de equipos es impar, en cada fecha un equipo queda libre.
 */

export interface CruceFixture {
  round: number; // 1: ida · 2: vuelta
  matchday: number; // número de fecha dentro del torneo (correlativo)
  homeIndex: number; // posición del equipo local en la lista recibida
  awayIndex: number; // posición del equipo visitante
}

export function generarCruces(cantidadEquipos: number, vueltas: 1 | 2): CruceFixture[] {
  if (cantidadEquipos < 2) return [];

  // Con cantidad impar se agrega un equipo fantasma que representa la fecha libre
  const impar = cantidadEquipos % 2 !== 0;
  const total = impar ? cantidadEquipos + 1 : cantidadEquipos;
  const fechasPorVuelta = total - 1;

  // Índices iniciales: 0..total-1 (si es impar, el último índice es el fantasma)
  const indices = Array.from({ length: total }, (_, i) => i);

  const cruces: CruceFixture[] = [];
  let fecha = 1;

  for (let vuelta = 1; vuelta <= vueltas; vuelta++) {
    // Rotación del círculo: el primer elemento queda fijo, el resto rota
    const rotacion = [...indices];
    for (let f = 0; f < fechasPorVuelta; f++) {
      for (let i = 0; i < total / 2; i++) {
        const a = rotacion[i];
        const b = rotacion[total - 1 - i];
        // Si alguno es el fantasma, ese equipo queda libre esta fecha (no hay partido)
        if (a >= cantidadEquipos || b >= cantidadEquipos) continue;

        // Alternar localía para equilibrar (misma regla en ida y vuelta)
        let home = a;
        let away = b;
        if (f % 2 === 1 && i === 0) {
          home = b;
          away = a;
        }
        // La vuelta invierte SIEMPRE la localía de la ida
        if (vuelta === 2) {
          const temp = home;
          home = away;
          away = temp;
        }

        cruces.push({ round: vuelta, matchday: fecha, homeIndex: home, awayIndex: away });
      }
      fecha++;
      // Rotar: el primero fijo, el último pasa a la segunda posición
      rotacion.splice(1, 0, rotacion.pop() as number);
    }
  }

  return cruces;
}

/** Cantidad de partidos que genera un torneo de N equipos con V vueltas. */
export function cantidadPartidos(cantidadEquipos: number, vueltas: 1 | 2): number {
  return (cantidadEquipos * (cantidadEquipos - 1) * vueltas) / 2;
}

/** Cantidad de fechas (jornadas) del torneo. */
export function cantidadFechas(cantidadEquipos: number, vueltas: 1 | 2): number {
  const impar = cantidadEquipos % 2 !== 0;
  return (impar ? cantidadEquipos : cantidadEquipos - 1) * vueltas;
}
