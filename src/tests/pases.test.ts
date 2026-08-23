import { describe, expect, it } from "vitest";
import {
  aQuienLeToca,
  esEstadoTerminal,
  ESTADO_PASE_UI,
  ESTADOS_TERMINALES,
  isCredentialActive,
  PASOS_CIRCUITO,
  progresoPase,
  type EstadoPase,
} from "../lib/core/rules/pasesRules";

describe("Pases — credencial de firma (72 hs)", () => {
  it("sigue activa dentro de las 72 horas", () => {
    const hace12hs = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    expect(isCredentialActive(hace12hs)).toBe(true);
  });

  it("vence después de las 72 horas", () => {
    const hace80hs = new Date(Date.now() - 80 * 3600 * 1000).toISOString();
    expect(isCredentialActive(hace80hs)).toBe(false);
  });

  it("sin fecha de aprobación no está activa", () => {
    expect(isCredentialActive("")).toBe(false);
  });
});

describe("Pases — máquina de estados", () => {
  it("los estados terminales son completado, rechazado y cancelado", () => {
    expect(esEstadoTerminal("7_COMPLETED")).toBe(true);
    expect(esEstadoTerminal("8_RECHAZADO")).toBe(true);
    expect(esEstadoTerminal("9_CANCELADO")).toBe(true);
    expect(esEstadoTerminal("1_INIT_CLUB_A")).toBe(false);
    expect(esEstadoTerminal("5_PLAYER_SIGNATURE")).toBe(false);
    expect(ESTADOS_TERMINALES).toHaveLength(3);
  });

  it("cada estado tiene su etiqueta de UI", () => {
    const estados: EstadoPase[] = [
      "1_INIT_CLUB_A",
      "2_FVF_REVIEW",
      "3_NOTIFY_CLUB_B",
      "4_CLUB_B_DECISION",
      "5_PLAYER_SIGNATURE",
      "6_FINAL_AUDIT",
      "7_COMPLETED",
      "8_RECHAZADO",
      "9_CANCELADO",
    ];
    for (const e of estados) {
      expect(ESTADO_PASE_UI[e].label.length).toBeGreaterThan(0);
      expect(ESTADO_PASE_UI[e].className.length).toBeGreaterThan(0);
    }
  });

  it("el stepper tiene 5 momentos y cada estado cae en el suyo", () => {
    expect(PASOS_CIRCUITO).toHaveLength(5);
    expect(progresoPase("1_INIT_CLUB_A")).toBe(0);
    expect(progresoPase("2_FVF_REVIEW")).toBe(0);
    expect(progresoPase("4_CLUB_B_DECISION")).toBe(1);
    expect(progresoPase("5_PLAYER_SIGNATURE")).toBe(2);
    expect(progresoPase("6_FINAL_AUDIT")).toBe(3);
    expect(progresoPase("7_COMPLETED")).toBe(4);
  });

  it("los estados terminales malos rompen el stepper (-1)", () => {
    expect(progresoPase("8_RECHAZADO")).toBe(-1);
    expect(progresoPase("9_CANCELADO")).toBe(-1);
  });

  it("cada estado sabe a quién le toca actuar", () => {
    expect(aQuienLeToca("1_INIT_CLUB_A")).toContain("liga");
    expect(aQuienLeToca("4_CLUB_B_DECISION")).toContain("club de origen");
    expect(aQuienLeToca("5_PLAYER_SIGNATURE")).toContain("jugador");
    expect(aQuienLeToca("6_FINAL_AUDIT")).toContain("liga");
    expect(aQuienLeToca("7_COMPLETED")).toContain("terminó");
  });
});
