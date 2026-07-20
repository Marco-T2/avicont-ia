/**
 * Shared sentinel helper — strip comments from raw source before asserting.
 *
 * WHY THIS EXISTS
 * Shape sentinels assert with regexes over RAW SOURCE TEXT. A regex cannot
 * tell code from comment, so a doc comment that merely MENTIONS an import
 * specifier satisfies a POSITIVE lock, and prose likewise drives a NEGATIVE
 * lock falsely RED. Both failure modes are silent: the lock reports GREEN
 * while pinning nothing, and rots the moment a refactor deletes the real
 * code but leaves the prose behind.
 *
 * This bug class hit poc-documents-hex / poc-rag-hex EIGHT times, three of
 * them an author writing the very comment that satisfied their own
 * assertion. Successive rounds of cleverer anchoring kept leaving residue
 * (e.g. `^import` still matches an UNINDENTED line inside a block comment).
 * Removing comments from the string first closes the class structurally
 * instead of escalating regex cleverness: if comments are not in the string,
 * NO assertion can be satisfied by prose.
 *
 * OPT-IN, NEVER A BLANKET TRANSFORM
 * Some locks assert a comment ON PURPOSE — the comment IS the artifact under
 * test (e.g. c1-application-shape α15's REQ-007 "processing library accepted
 * exception" rationale at documents.service.ts:33). Those MUST keep reading
 * raw, unstripped source. Always audit for intentional comment-asserting
 * locks before converting a sentinel to the stripped read.
 *
 * KNOWN LIMITATION — deliberately simple
 * This is a naive line/block stripper. It does NOT parse string literals,
 * template literals, or regex literals, so a line-comment or block-comment
 * marker INSIDE a string would be treated as a comment. Chosen over a real
 * tokenizer because sentinels read ordinary TypeScript module source where
 * that shape does not occur, and a dependency-free 4-line helper is worth
 * more here than exhaustive correctness. If a future sentinel targets a file
 * embedding comment markers in strings, assert on raw source instead.
 *
 * Shape follows the existing in-repo precedent at
 * modules/accounting/infrastructure/__tests__/contact-ledger-no-enrichment-lookups.sentinel.test.ts
 * (the `(^|[^:])` guard keeps `https://` URLs from being eaten as comments).
 */
export function stripSourceComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
