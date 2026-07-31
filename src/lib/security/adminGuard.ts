export interface AuditPayload {
  userId: string;
  action: string;
  module: string;
  details: Record<string, unknown>;
  ip?: string;
}

/**
 * Valida que una operación administrativa sensible esté protegida con el código de confirmación
 * y registra la acción en el log de auditoría.
 */
export async function validateAdminOperation(
  securityCode: string,
  expectedCode: string,
  userRole: string,
  auditPayload: AuditPayload,
  writeAuditLog: (payload: AuditPayload) => Promise<void>
): Promise<void> {
  if (userRole !== "admin") {
    throw new Error("Acceso no autorizado: Se requiere rol de administrador.");
  }

  if (!securityCode || securityCode.trim() !== expectedCode) {
    throw new Error("Código de seguridad inválido. Operación abortada.");
  }

  // Ejecución segura del log de auditoría para evitar bloquear la UI
  try {
    await writeAuditLog(auditPayload);
  } catch (error) {
    // Registro defensivo en logs de consola de servidor en caso de fallo de BD
    console.error(
      "[AUDIT_LOG_ERROR]: Falló la persistencia del log de auditoría.",
      error,
      auditPayload
    );
  }
}
