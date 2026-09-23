import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /* Third-party pdf.js, copied out of node_modules before every build by
       scripts/copy-pdfjs-assets.mjs and gitignored. Linting a minified vendor
       bundle produced 10 errors and 1855 warnings about code nobody here
       wrote — which made `npm run lint` exit non-zero always, so its verdict
       stopped meaning anything and a real error in our own code would have
       arrived in the same stream as `__indirect_function_table is unused`. */
    "public/pdfjs/**",
  ]),
]);

export default eslintConfig;
