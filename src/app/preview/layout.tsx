import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "University OS — الاتجاه الجديد",
  // A design mockup is not something to find in a search result.
  robots: { index: false, follow: false },
};

/**
 * Its own layout, deliberately outside the `(app)` group.
 *
 * The app group mounts the shell and the forest environment, and the whole
 * point of this direction is that the ground is black rather than a
 * photograph — rendering it inside that layout would be showing the thing it
 * is arguing against. Nothing here imports from the live app, so the preview
 * cannot drift into it and the app cannot drift into the preview.
 */
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-black">
      {children}
    </div>
  );
}
