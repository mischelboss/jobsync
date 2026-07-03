/**
 * Ambient type declaration for pdf-parse's inner lib entry point.
 * We import "pdf-parse/lib/pdf-parse.js" directly (see pdf-extraction.ts) to
 * bypass pdf-parse's index.js, which has a debug-mode branch that reads a
 * test fixture off disk. @types/pdf-parse only covers the package root, so
 * we mirror its shape here for the subpath.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse = require("pdf-parse");
  export = PdfParse;
}
