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
       */
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
