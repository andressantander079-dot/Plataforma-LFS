import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuración de vitest: replica el alias "@/" de tsconfig.json para poder
 * probar server actions con mocks. Los tests existentes (rutas relativas) no cambian.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
