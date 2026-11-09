import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * inscribirJugadorClubAction — rollback atómico de la foto y mapeo de respuestas.
 * Se mockea Supabase (cliente autenticado) y next/cache: no se toca la base real.
 */

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  remove: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

vi.mock("@/lib/infrastructure/supabase/server", () => ({
  createLfsServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    storage: {
      from: (bucket: string) => ({
        remove: (paths: string[]) => mocks.remove(bucket, paths),
      }),
    },
  }),
}));

import { inscribirJugadorClubAction } from "../lib/actions/equipos.actions";

const UUID_CAT = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const UUID_PLAYER = "a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d";
const FOTO = "club-1/foto-1.webp";

const inputValido = {
  dni: "44111222",
  first_name: "Andrés",
  last_name: "Santander",
  fecha_nacimiento: "2008-05-12",
  foto_path: FOTO,
  category_ids: [UUID_CAT],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.remove.mockResolvedValue({ error: null });
});

describe("inscribirJugadorClubAction — validación", () => {
  it("con datos inválidos devuelve el error, NO llama a la RPC y borra la foto", async () => {
    const res = await inscribirJugadorClubAction({ ...inputValido, dni: "44.111.222" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("DNI");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith("fotos-jugadores", [FOTO]);
  });

  it("con foto_path vacío no intenta borrar nada del bucket", async () => {
    const res = await inscribirJugadorClubAction({ ...inputValido, foto_path: "" });
    expect(res.success).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("no se rompe si recibe null y tampoco borra nada", async () => {
    const res = await inscribirJugadorClubAction(null as never);
    expect(res.success).toBe(false);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("sin sesión activa borra la foto y no llama a la RPC", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await inscribirJugadorClubAction(inputValido);
    expect(res.success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith("fotos-jugadores", [FOTO]);
  });
});

describe("inscribirJugadorClubAction — llamada a la RPC", () => {
  it("manda los 7 parámetros exactos a inscribir_jugador_club", async () => {
    mocks.rpc.mockResolvedValue({ data: { success: true, player_id: UUID_PLAYER }, error: null });
    await inscribirJugadorClubAction({ ...inputValido, player_id: UUID_PLAYER });
    expect(mocks.rpc).toHaveBeenCalledWith("inscribir_jugador_club", {
      p_player_id: UUID_PLAYER,
      p_dni: "44111222",
      p_first_name: "Andrés",
      p_last_name: "Santander",
      p_fecha_nacimiento: "2008-05-12",
      p_foto_path: FOTO,
      p_category_ids: [UUID_CAT],
    });
  });

  it("genera un UUID cuando no viene player_id", async () => {
    mocks.rpc.mockResolvedValue({ data: { success: true, player_id: UUID_PLAYER }, error: null });
    await inscribirJugadorClubAction(inputValido);
    const args = mocks.rpc.mock.calls[0][1] as { p_player_id: string };
    expect(args.p_player_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("inscribirJugadorClubAction — rollback de la foto", () => {
  it("si la RPC falla por red/SQL borra la foto y devuelve un error genérico", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await inscribirJugadorClubAction(inputValido);
    expect(res.success).toBe(false);
    expect(res.error).toContain("No se pudo inscribir");
    expect(mocks.remove).toHaveBeenCalledWith("fotos-jugadores", [FOTO]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("si la RPC lanza una excepción también borra la foto", async () => {
    mocks.rpc.mockRejectedValue(new Error("network down"));
    const res = await inscribirJugadorClubAction(inputValido);
    expect(res.success).toBe(false);
    expect(mocks.remove).toHaveBeenCalledWith("fotos-jugadores", [FOTO]);
  });

  it("si la RPC responde success:false borra la foto y propaga error, code y club actual", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        success: false,
        code: "REQUIRES_TRANSFER",
        existing_club_id: "club-9",
        existing_club_name: "Repatriados FC",
        error: "El jugador pertenece a Repatriados FC. Debe iniciarse un trámite de pase.",
      },
      error: null,
    });
    const res = await inscribirJugadorClubAction(inputValido);
    expect(res).toEqual({
      success: false,
      error: "El jugador pertenece a Repatriados FC. Debe iniciarse un trámite de pase.",
      code: "REQUIRES_TRANSFER",
      data: { existingClubName: "Repatriados FC", existingClubId: "club-9" },
    });
    expect(mocks.remove).toHaveBeenCalledWith("fotos-jugadores", [FOTO]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("si el borrado de la foto falla, igual devuelve la respuesta de error (no se rompe)", async () => {
    mocks.rpc.mockResolvedValue({ data: { success: false, error: "DNI duplicado" }, error: null });
    mocks.remove.mockRejectedValue(new Error("storage caído"));
    const res = await inscribirJugadorClubAction(inputValido);
    expect(res.success).toBe(false);
    expect(res.error).toBe("DNI duplicado");
  });
});

describe("inscribirJugadorClubAction — éxito", () => {
  it("devuelve playerId y estado 'pendiente', revalida las pantallas y NO borra la foto", async () => {
    mocks.rpc.mockResolvedValue({
      data: { success: true, player_id: UUID_PLAYER, status: "pendiente", message: "ok" },
      error: null,
    });
    const res = await inscribirJugadorClubAction(inputValido);
    expect(res).toEqual({ success: true, data: { playerId: UUID_PLAYER, status: "pendiente" } });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/club/planteles");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/club/dashboard");
  });
});

