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
        },
        resolve: { alias },
      },
    ],
  },
});
