import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /**
       * How large a dropped file may be.
       *
       * Server Actions cap the request body at 1MB by default, and this app is
       * built around handing it a photograph of a timetable — which comes off a
       * phone at two to five. So every real drop failed at the platform door,
       * before a line of application code ran: no capture row, no error we
       * could record, just React's placeholder for "the server threw and the
       * message is hidden in production". Nothing in the app was wrong, which
       * is exactly why it took a screenshot and a database query to find.
       *
       * 4.5mb, not the 40 the upload path used to advertise. The ceiling here is
       * not Next's to raise — a serverless request body tops out at 4.5MB on
       * the platform this deploys to, so anything above that fails again one
       * layer down, and the honest number is the one the whole chain can carry.
       * `MAX_FILE_BYTES` sits at 4 MB beneath it, leaving room for the
       * multipart boundaries and part headers that count toward the same limit.
       *
       * Genuinely large files need a different shape entirely — the browser
       * uploading straight to storage with a signed URL, never passing through
       * a Server Action. Until that exists, `MAX_FILE_BYTES` states this limit
       * and the panel refuses an oversized file before it wastes the upload.
       */
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
