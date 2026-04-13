import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Entorno Node.js (sin DOM) — adecuado para lógica de negocio pura
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
  },
  resolve: {
    // Resuelve el alias @/* igual que en tsconfig
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
