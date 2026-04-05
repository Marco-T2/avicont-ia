/**
 * Pure function to generate the next account code.
 * Used by both the service (server) and the UI (client) for code preview.
 *
 * @param parentCode - The parent account's code, or null for root accounts
 * @param siblingCodes - Codes of all accounts at the same level under the same parent
 * @returns The next sequential code (e.g., "1.1.4" if siblings are ["1.1.1", "1.1.2", "1.1.3"])
 */
export function getNextCode(
  parentCode: string | null,
  siblingCodes: string[],
): string {
  if (!parentCode) {
    // Root level: parse all codes as integers, find max
    const maxNum = siblingCodes.reduce((max, code) => {
      const num = parseInt(code, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    return String(maxNum + 1);
  }

  // Child level: extract last segment from each sibling, find max
  const prefix = parentCode + ".";
  const maxNum = siblingCodes
    .filter((c) => c.startsWith(prefix))
    .reduce((max, code) => {
      const lastSegment = code.slice(prefix.length).split(".")[0];
      const num = parseInt(lastSegment, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);

  return `${parentCode}.${maxNum + 1}`;
}
