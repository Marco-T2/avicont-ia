// FSM puro del modal de captura asistida. Reducer extraído del componente
// para ser testeable en aislamiento. Cada transición está modelada como una
// acción con discriminator. PATCH_FORM también pasa por el reducer para
// mantener un único punto de entrada de cambios de estado (más fácil de
// tracer y debuggear con redux-devtools-style logs si llega a hacer falta).
//
// CRÍTICO — corrección NL: la acción CORRECTION_SUCCESS reemplaza el data
// completamente con la nueva sugerencia. NO hay merge silencioso entre el
// formState anterior y el nuevo. Si el LLM "olvida" un campo, el schema
// Zod del backend lo rechaza antes de llegar acá. Si el LLM cambia un
// campo no mencionado por el usuario (caso degenerado: temperature alta
// + interpretación creativa), el frontend reemplaza sin warning. La
// mitigación vive en el system prompt (regla "byte por byte"); este
// reducer no intenta detectar ni mergear porque eso introduciría lógica
// stateful frágil. Documentado y validado con test.

import type { ModalState, SuggestionData } from "./types";

export type FsmAction =
  // Flow inicial: usuario escribe prompt + click Interpretar
  | { type: "INTERPRET_START" }
  | { type: "INTERPRET_SUCCESS"; data: SuggestionData; message: string }
  // El LLM respondió sin tool call — pidió aclaración o rechazó la operación.
  // No es error: volvemos a IDLE para que el usuario reformule.
  | { type: "INTERPRET_NO_SUGGESTION" }
  | { type: "INTERPRET_ERROR"; message: string }

  // Round-trip de corrección NL desde READY
  | { type: "CORRECTION_START"; previous: SuggestionData }
  | { type: "CORRECTION_SUCCESS"; data: SuggestionData; message: string }
  | { type: "CORRECTION_ERROR"; message: string; previous: SuggestionData }

  // Confirmación del borrador
  | { type: "CONFIRM_START"; data: SuggestionData }
  | { type: "CONFIRM_ERROR"; message: string; previous: SuggestionData }

  // Mutación local del form (cambio de cuenta, monto, glosa, etc.). Pasa por
  // el reducer para mantener single source of truth.
  | { type: "PATCH_FORM"; data: SuggestionData }

  // Recovery desde ERROR si hay snapshot previo
  | { type: "BACK_TO_FORM" }

  // Reset total (cierre del modal o "Limpiar y reescribir")
  | { type: "RESET" };

export const initialState: ModalState = { phase: "idle" };

export function journalEntryAiReducer(state: ModalState, action: FsmAction): ModalState {
  switch (action.type) {
    case "INTERPRET_START":
      // Solo desde IDLE. Si llega en otra fase, ignoramos para evitar transiciones
      // raras (ej: doble click en "Interpretar" mientras está PARSING).
      if (state.phase !== "idle") return state;
      return { phase: "parsing" };

    case "INTERPRET_SUCCESS":
      if (state.phase !== "parsing") return state;
      return { phase: "ready", data: action.data, message: action.message };

    case "INTERPRET_NO_SUGGESTION":
      if (state.phase !== "parsing") return state;
      return { phase: "idle" };

    case "INTERPRET_ERROR":
      if (state.phase !== "parsing") return state;
      return { phase: "error", message: action.message };

    case "CORRECTION_START":
      // Solo desde READY. La data anterior se preserva para recovery
      // si la corrección falla.
      if (state.phase !== "ready") return state;
      return { phase: "parsing" };

    case "CORRECTION_SUCCESS":
      // REPLACE total — no hay merge. El LLM debe respetar el contrato del
      // system prompt y devolver el shape completo (validado por Zod en
      // backend). Ver comentario en el header del archivo.
      if (state.phase !== "parsing") return state;
      return { phase: "ready", data: action.data, message: action.message };

    case "CORRECTION_ERROR":
      if (state.phase !== "parsing") return state;
      return { phase: "error", message: action.message, previous: action.previous };

    case "CONFIRM_START":
      if (state.phase !== "ready") return state;
      return { phase: "confirming", data: action.data };

    case "CONFIRM_ERROR":
      if (state.phase !== "confirming") return state;
      return { phase: "error", message: action.message, previous: action.previous };

    case "PATCH_FORM":
      // Solo desde READY (CONFIRMING tiene el form deshabilitado, no debería
      // llegar PATCH_FORM ahí; si llega lo ignoramos).
      if (state.phase !== "ready") return state;
      return { phase: "ready", data: action.data, message: state.message };

    case "BACK_TO_FORM":
      if (state.phase !== "error") return state;
      if (!state.previous) return { phase: "idle" };
      return { phase: "ready", data: state.previous, message: "" };

    case "RESET":
      return initialState;
  }
}
