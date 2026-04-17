import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = { "@": path.resolve(__dirname, ".") };

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    // Proyectos separados para mantener node tests sin DOM y
    // habilitar jsdom solo para tests de componentes React
    projects: [
      {
        // Proyecto A: lógica de negocio pura — entorno Node.js
        test: {
          name: "node",
          environment: "node",
          include: ["**/__tests__/**/*.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
          // TZ=America/La_Paz garantiza que todayLocal() use UTC-4 en tests
          // (getFullYear/getMonth/getDate leen la TZ del proceso, no el reloj JS)
          env: { TZ: "America/La_Paz" },
        },
        resolve: { alias },
      },
      {
        // Proyecto B: componentes React — entorno jsdom
        plugins: [react()],
        test: {
          name: "components",
          environment: "jsdom",
          include: [
            "components/**/__tests__/**/*.test.tsx",
            "features/reports/__tests__/**/*.test.tsx",
          ],
          setupFiles: ["./vitest.setup.ts"],
          // TZ=America/La_Paz para consistencia con el proyecto node
          env: { TZ: "America/La_Paz" },
        },
        resolve: { alias },
      },
    ],
  },
});
