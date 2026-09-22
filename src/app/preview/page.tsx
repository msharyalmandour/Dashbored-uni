import { Bento } from "./bento";

export const dynamic = "force-static";

/**
 * The proposed direction, running as real code so it can be judged on a real
 * phone with real motion — which a still image cannot show.
 *
 * Every number on this page is invented and fixed. It reads nothing from the
 * database and belongs to no account: it is a drawing that happens to be made
 * of React, and it must never grow a data source. When the direction is
 * settled this whole folder is deleted, not promoted.
 */
export default function PreviewPage() {
  return <Bento />;
}
