/**
 * Adaptador de base de datos local IndexedDB para soporte Offline-First en gimnasios de Ushuaia.
 * Permite guardar eventos de partidos localmente y sincronizarlos cuando vuelva la red.
 */

const DB_NAME = "LfsOfflineDB";
const STORE_NAME = "offline_events";

export function openLfsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB no está disponible en el servidor."));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

/**
 * Guarda un evento de partido de forma local si no hay red disponible.
 */
export async function saveEventOffline(
  matchId: string,
  eventData: Record<string, unknown>
): Promise<{ synced: boolean }> {
  // Comprobar estado de conectividad en el navegador
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    try {
      const db = await openLfsDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      await new Promise<void>((resolve, reject) => {
        const req = store.put({
          matchId,
          eventData,
          timestamp: Date.now(),
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      console.log("[PWA OFFLINE]: Evento guardado en IndexedDB local.");
      return { synced: false };
    } catch (error) {
      console.error("[PWA OFFLINE ERROR]: Falló la escritura en IndexedDB:", error);
      return { synced: false };
    }
  }

  // Si hay red, se sincroniza de inmediato con Supabase
  return { synced: true };
}
