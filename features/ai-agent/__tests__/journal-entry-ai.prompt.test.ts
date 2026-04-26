/**
 * Tests del builder de system prompt para el modo journal-entry-ai.
 * Cubre estructura del prompt, inyección condicional de bloques (catálogo,
 * contactos, estado de corrección) y coerce defensivo de contextHints.
 */

import { describe, it, expect } from "vitest";
import {
  buildJournalEntryAiSystemPrompt,
  coerceContextHints,
  type JournalEntryAiContextHints,
} from "../journal-entry-ai.prompt";

// ── Estructura base del prompt (sin hints) ──

describe("buildJournalEntryAiSystemPrompt — estructura base", () => {
  it("incluye los bloques fijos del system prompt", () => {
    const prompt = buildJournalEntryAiSystemPrompt(undefined, { today: "2026-04-26" });

    expect(prompt).toContain("asistente de captura de asientos contables");
    expect(prompt).toContain("## Plantillas disponibles");
    expect(prompt).toContain("expense_bank_payment");
    expect(prompt).toContain("expense_cash_payment");
    expect(prompt).toContain("bank_deposit");
    expect(prompt).toContain("## Tool disponible");
    expect(prompt).toContain("parseAccountingOperationToSuggestion");
    expect(prompt).toContain("## Reglas duras");
    expect(prompt).toContain("HOY (2026-04-26)");
    expect(prompt).toContain("## Formato de respuesta");
  });

  it("incluye las nueve reglas duras numeradas", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(prompt).toContain(`${n}. `);
    }
  });

  it("regla 1 prohíbe inventar IDs fuera del catálogo precargado", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).toContain("SOLO");
    expect(prompt).toContain("catálogo precargado");
    expect(prompt).toContain("NO inventes");
  });

  it("regla 4 pide preguntar abierto por proveedor sin inferir por contexto, con ejemplo negativo concreto", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).toContain("preguntá abierto");
    expect(prompt).toContain("NO infieras");
    expect(prompt).toContain("Ejemplo de lo que NO hacer");
    expect(prompt).toContain("Veterinaria Andina");
  });

  it("bloque Tool disponible NO tiene la frase redundante 'NO podés llamar otras tools'", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).toContain("## Tool disponible");
    expect(prompt).not.toContain("NO podés llamar otras tools");
  });

  it("regla 5 pide avisar la fecha asumida cuando es ambigua", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).toContain("avisá al usuario explícitamente la fecha que asumiste");
  });

  it("regla 9 limita a una operación por pedido", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).toContain("múltiples operaciones");
    expect(prompt).toContain("indique cuál registrar primero");
  });

  it("usa fecha de hoy por default cuando no se pasa today", () => {
    const today = new Date().toISOString().split("T")[0];
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).toContain(`HOY (${today})`);
  });

  it("NO incluye bloque de catálogo cuando no hay hints", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).not.toContain("## Catálogo precargado");
  });

  it("NO incluye bloque de proveedores cuando no hay hints", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).not.toContain("## Proveedores precargados");
  });

  it("NO incluye bloque de estado actual cuando no hay formState", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).not.toContain("## Estado actual del formulario");
  });
});

// ── Inyección de catálogo ──

describe("buildJournalEntryAiSystemPrompt — catálogo de cuentas", () => {
  it("inyecta cuentas de banco con id/code/name", () => {
    const hints: JournalEntryAiContextHints = {
      catalog: {
        bank: [
          { id: "clxx00000000000000000001", code: "1.1.3.1", name: "Banco BCP" },
        ],
      },
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints);

    expect(prompt).toContain("## Catálogo precargado de cuentas");
    expect(prompt).toContain("### Cuentas de banco");
    expect(prompt).toContain('id: "clxx00000000000000000001"');
    expect(prompt).toContain('code: "1.1.3.1"');
    expect(prompt).toContain('name: "Banco BCP"');
  });

  it("inyecta cuentas de gasto con requiresContact cuando aplica", () => {
    const hints: JournalEntryAiContextHints = {
      catalog: {
        expense: [
          {
            id: "exp-1",
            code: "5.1.2",
            name: "Alimento Balanceado",
            requiresContact: true,
          },
        ],
      },
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints);

    expect(prompt).toContain("### Cuentas de gasto (top 1)");
    expect(prompt).toContain("requiresContact: true");
  });

  it("omite requiresContact cuando es false (no agrega ruido)", () => {
    const hints: JournalEntryAiContextHints = {
      catalog: {
        expense: [
          { id: "exp-2", code: "5.1.10", name: "Limpieza", requiresContact: false },
        ],
      },
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints);

    expect(prompt).toContain('id: "exp-2"');
    // La línea de esta cuenta NO incluye requiresContact (false omitido)
    expect(prompt).not.toMatch(/exp-2.*requiresContact: false/);
  });

  it("NO inyecta sub-bloques vacíos", () => {
    const hints: JournalEntryAiContextHints = {
      catalog: {
        bank: [{ id: "b-1", code: "1.1.3.1", name: "BCP" }],
        cash: [],
        expense: [],
      },
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints);

    expect(prompt).toContain("### Cuentas de banco");
    expect(prompt).not.toContain("### Cuentas de caja");
    expect(prompt).not.toContain("### Cuentas de gasto");
  });

  it("NO inyecta el header del catálogo si todas las sub-listas están vacías", () => {
    const hints: JournalEntryAiContextHints = {
      catalog: { bank: [], cash: [], expense: [] },
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints);
    expect(prompt).not.toContain("## Catálogo precargado");
  });
});

// ── Inyección de contactos ──

describe("buildJournalEntryAiSystemPrompt — proveedores", () => {
  it("inyecta proveedores con id/name/nit cuando viene", () => {
    const hints: JournalEntryAiContextHints = {
      contacts: [
        { id: "c-1", name: "Granos del Sur SA", nit: "1234567" },
      ],
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints);

    expect(prompt).toContain("## Proveedores precargados");
    expect(prompt).toContain('id: "c-1"');
    expect(prompt).toContain('name: "Granos del Sur SA"');
    expect(prompt).toContain('nit: "1234567"');
  });

  it("omite el campo nit cuando es null", () => {
    const hints: JournalEntryAiContextHints = {
      contacts: [{ id: "c-1", name: "Sin NIT", nit: null }],
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints);

    expect(prompt).toContain('name: "Sin NIT"');
    expect(prompt).not.toContain("nit:");
  });

  it("NO inyecta el bloque cuando contacts está vacío", () => {
    const hints: JournalEntryAiContextHints = { contacts: [] };
    const prompt = buildJournalEntryAiSystemPrompt(hints);
    expect(prompt).not.toContain("## Proveedores precargados");
  });
});

// ── Estado actual (corrección NL) ──

describe("buildJournalEntryAiSystemPrompt — estado actual del formulario", () => {
  it("inyecta el formState como JSON formateado en bloque dedicado", () => {
    const hints: JournalEntryAiContextHints = {
      formState: {
        template: "expense_bank_payment",
        amount: 5000,
        expenseAccountId: "exp-1",
        bankAccountId: "bank-1",
        date: "2026-04-26",
      },
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints);

    expect(prompt).toContain("## Estado actual del formulario — el usuario está corrigiendo");
    expect(prompt).toContain("Modificá SOLO los campos que el usuario menciona");
    expect(prompt).toContain("volvé a llamar parseAccountingOperationToSuggestion");
    expect(prompt).toContain('"template": "expense_bank_payment"');
    expect(prompt).toContain('"amount": 5000');
    expect(prompt).toContain('"date": "2026-04-26"');
  });

  it("regla de corrección referencia que solo se modifica lo mencionado", () => {
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).toContain("## Si el usuario está corrigiendo");
    expect(prompt).toContain("modificá **solo** los campos que el usuario menciona");
  });

  it("bloque de corrección refuerza con énfasis byte-por-byte y prohíbe sustituciones creativas", () => {
    // Mitigación contra el caso degenerado donde el LLM, al recibir una
    // corrección de un solo campo, modifica otros IDs por interpretación
    // creativa (temperature alta). El reducer del modal NO mergea — el data
    // nuevo reemplaza completo. La defensa vive en este prompt.
    const prompt = buildJournalEntryAiSystemPrompt();
    expect(prompt).toContain("Énfasis crítico");
    expect(prompt).toContain("idénticos byte por byte");
    expect(prompt).toContain("NO sustituyas un ID por otro");
    expect(prompt).toContain("NO reinterpretes campos no mencionados");
  });
});

// ── Combinación: prompt completo con catálogo + contactos + corrección ──

describe("buildJournalEntryAiSystemPrompt — combinación completa", () => {
  it("renderiza todos los bloques en orden cuando todos los hints están presentes", () => {
    const hints: JournalEntryAiContextHints = {
      catalog: {
        bank: [{ id: "b-1", code: "1.1.3.1", name: "BCP" }],
        cash: [{ id: "c-1", code: "1.1.1.1", name: "Caja" }],
      },
      contacts: [{ id: "ct-1", name: "Granos", nit: null }],
      formState: { amount: 100 },
    };
    const prompt = buildJournalEntryAiSystemPrompt(hints, { today: "2026-04-26" });

    // Orden: identidad → reglas → catálogo → proveedores → estado actual
    const idxIdentidad = prompt.indexOf("asistente de captura");
    const idxReglas = prompt.indexOf("## Reglas duras");
    const idxCatalogo = prompt.indexOf("## Catálogo precargado");
    const idxProveedores = prompt.indexOf("## Proveedores precargados");
    const idxEstado = prompt.indexOf("## Estado actual del formulario");

    expect(idxIdentidad).toBeLessThan(idxReglas);
    expect(idxReglas).toBeLessThan(idxCatalogo);
    expect(idxCatalogo).toBeLessThan(idxProveedores);
    expect(idxProveedores).toBeLessThan(idxEstado);
  });
});

// ── coerceContextHints — degradación graceful ──

describe("coerceContextHints — coerce defensivo", () => {
  it("devuelve undefined para input no-objeto", () => {
    expect(coerceContextHints(null)).toBeUndefined();
    expect(coerceContextHints(undefined)).toBeUndefined();
    expect(coerceContextHints("string")).toBeUndefined();
    expect(coerceContextHints(42)).toBeUndefined();
  });

  it("devuelve undefined para objeto vacío", () => {
    expect(coerceContextHints({})).toBeUndefined();
  });

  it("normaliza catalog parcial (solo bank)", () => {
    const result = coerceContextHints({
      catalog: { bank: [{ id: "b-1", code: "1.1.3.1", name: "BCP" }] },
    });
    expect(result?.catalog?.bank).toHaveLength(1);
    expect(result?.catalog?.cash).toBeUndefined();
  });

  it("descarta items del catálogo con shape inválido", () => {
    const result = coerceContextHints({
      catalog: {
        bank: [
          { id: "b-1", code: "1.1.3.1", name: "BCP" },
          { id: 42 }, // shape inválido
          "not an object",
        ],
      },
    });
    expect(result?.catalog?.bank).toHaveLength(1);
    expect(result?.catalog?.bank?.[0].id).toBe("b-1");
  });

  it("normaliza contacts con nit null o string, descarta inválidos", () => {
    const result = coerceContextHints({
      contacts: [
        { id: "c-1", name: "Con NIT", nit: "1234" },
        { id: "c-2", name: "Sin NIT", nit: null },
        { id: "c-3" }, // falta name → descartado
        "not an object",
      ],
    });
    expect(result?.contacts).toHaveLength(2);
  });

  it("preserva formState como objeto opaco", () => {
    const result = coerceContextHints({
      formState: { template: "bank_deposit", amount: 100 },
    });
    expect(result?.formState).toEqual({ template: "bank_deposit", amount: 100 });
  });

  it("acepta los tres campos juntos", () => {
    const result = coerceContextHints({
      catalog: { cash: [{ id: "c-1", code: "1.1.1.1", name: "Caja" }] },
      contacts: [{ id: "ct-1", name: "Prov", nit: null }],
      formState: { amount: 50 },
    });
    expect(result?.catalog?.cash).toHaveLength(1);
    expect(result?.contacts).toHaveLength(1);
    expect(result?.formState).toBeDefined();
  });
});
