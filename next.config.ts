import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
