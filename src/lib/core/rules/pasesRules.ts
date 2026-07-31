/**
 * Verifica si las credenciales temporales generadas para la firma digital siguen activas (límite de 72 horas).
 * 
 * @param approvedAt Fecha en formato ISO de la aprobación del Club B (Dictamen)
 * @param ttlHours Tiempo de vida de la credencial en horas (por defecto 72)
 */
export function isCredentialActive(approvedAt: string, ttlHours = 72): boolean {
  if (!approvedAt) return false;
  const approvalTime = new Date(approvedAt).getTime();
  const now = new Date().getTime();
  const hoursPassed = (now - approvalTime) / (1000 * 60 * 60);
  return hoursPassed <= ttlHours;
}
