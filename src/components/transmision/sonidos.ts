/**
 * SONIDOS SINTETIZADOS — Paso 17C
 * Silbato, gol y beep generados con WebAudio (sin archivos de audio,
 * la app no se hace pesada). Respeta el mute del usuario.
 */

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tono(
  audio: AudioContext,
  frecuencia: number,
  inicio: number,
  duracion: number,
  volumen: number,
  tipo: OscillatorType = "sine"
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frecuencia, audio.currentTime + inicio);
  gain.gain.setValueAtTime(volumen, audio.currentTime + inicio);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + inicio + duracion);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(audio.currentTime + inicio);
  osc.stop(audio.currentTime + inicio + duracion);
}

/** Silbatazo corto (cambio de tiempo / final). */
export function sonarSilbato() {
  const audio = contexto();
  if (!audio) return;
  tono(audio, 2200, 0, 0.18, 0.25, "square");
  tono(audio, 2200, 0.25, 0.35, 0.25, "square");
}

/** ¡GOOOL! — acorde ascendente festivo. */
export function sonarGol() {
  const audio = contexto();
  if (!audio) return;
  tono(audio, 523, 0, 0.15, 0.3);
  tono(audio, 659, 0.12, 0.15, 0.3);
  tono(audio, 784, 0.24, 0.3, 0.35);
  tono(audio, 1046, 0.4, 0.5, 0.3);
}

/** Beep de aviso (se acaba el entretiempo / tiempo pedido). */
export function sonarBeep() {
  const audio = contexto();
  if (!audio) return;
  tono(audio, 880, 0, 0.12, 0.25);
  tono(audio, 880, 0.2, 0.12, 0.25);
  tono(audio, 880, 0.4, 0.25, 0.3);
}

/** Tarjeta: tono grave de advertencia. */
export function sonarTarjeta() {
  const audio = contexto();
  if (!audio) return;
  tono(audio, 392, 0, 0.2, 0.3, "triangle");
  tono(audio, 330, 0.18, 0.35, 0.3, "triangle");
}
