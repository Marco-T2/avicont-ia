/**
 * PR3.4 [GREEN] — MatrixWarnings
 * REQ-RM.16, REQ-RM.17, REQ-RM.18, REQ-RM.19, REQ-RM.20
 *
 * Renders a soft yellow warning list derived from computeWarnings().
 * Empty array → returns null (nothing rendered).
 * All warnings are severity "soft" — save is NEVER blocked by this component.
 * Uses yellow/amber Tailwind classes per REQ-RM.20. No red. No icons required.
 */
import type { Warning } from "@/lib/settings/compute-warnings";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MatrixWarningsProps {
  warnings: Warning[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MatrixWarnings({ warnings }: MatrixWarningsProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2 my-3">
      {warnings.map((warning, index) => (
        <li
          key={index}
          className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-md px-3 py-2 text-sm"
        >
          {warning.message}
        </li>
      ))}
    </ul>
  );
}
