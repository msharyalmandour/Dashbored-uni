import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdfjs is loaded from node_modules rather than bundled.
   *
   * Bundled, it resolved its own worker to a path inside the build output that
   * nothing ever wrote — so every PDF failed in production with "Cannot find
   * module .next/server/chunks/ssr/pdf.worker.mjs" while working perfectly in
   * development. Text extraction had never once succeeded on the deployed app.
   *
   * The agent no longer depends on this working — a PDF now goes to the model
   * whole (see `organize.ts`) — but extraction still feeds search and the
   * library, and a dependency that cannot find its own files is not something
   * to leave in place because the one caller that mattered stopped needing it.
   */
  serverExternalPackages: ["pdfjs-dist"],
  /**
   * Ship pdf.js's worker with the functions that call it.
   *
   * `serverExternalPackages` above keeps pdfjs-dist out of the bundle, which
   * was the right half of the fix and only half. File tracing walks static
   * imports; pdf.js reaches its worker through a *dynamic* one, so the tracer
   * never saw it and the deployed function got a pdfjs-dist with no worker in
   * it. Every attached lecture then failed with "Cannot find module
   * .../pdf.worker.mjs" — recorded on the Document rows, in production, since
   * the first deploy.
   *
   * Two routes do server-side PDF work: the cron sweep, and the agent, which
   * is reached from Server Actions and so is traced under the app routes that
   * call them. `/*` covers both without anyone having to remember this file
   * when a third one appears — it is one 1.4MB file, and being wrong in the
   * other direction costs a feature.
   */
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      // Read from disk by the server-side extractor, not served over HTTP.
      // cmaps is what makes an Arabic lecture extract as text rather than as
      // nothing — see resolveAssets() in src/lib/processors/pdf-text-processor.ts.
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/pdfjs-dist/cmaps/**/*",
    ],
  },
  images: {
    /**
     * The one quality the app actually asks for.
     *
     * `images.qualities` defaults to [75], and the environment backdrop requests
     * 78 — so every page render logged "quality 78 is not configured" and the
     * optimiser fell back. Harmless-looking, and exactly the kind of warning
     * that gets scrolled past forever. The backdrop is a full-bleed photograph
     * behind the whole app, which is the one image where the three extra points
     * are worth having, so the config admits it rather than the component
     * quietly asking for something the platform refuses.
     */
    qualities: [75, 78],
  },
  experimental: {
    serverActions: {
      /**
       * Metadata only, now that files do not travel this way.
       *
       * Uploads used to be sent inside a Server Action's request body, whose
       * 1MB default rejected every real drop — a phone photograph is two to
       * five — before a line of application code ran. Raising it only moved
       * the wall: the platform refuses a request body over 4.5MB regardless.
       *
       * So the bytes were moved out of the request entirely (browser → Storage
       * with a signed slot, see `upload-direct.ts`), and what crosses here is
       * a path and a file name. 2mb is generous for that, and leaves room for
       * the other actions in the app without inviting anything large back into
       * a place that cannot hold it.
       *
       * This comment used to say that and be wrong: one upload — attaching a
       * lecture, of all things — was still sending the whole file through, and
       * failed with a framework 413 that had no message to show anybody. It is
       * enforced now rather than asserted: scripts/verify-uploads.ts fails if
       * any Server Action accepts a File or a Blob.
       */
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
