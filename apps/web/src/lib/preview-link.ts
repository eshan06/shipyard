/**
 * Where the dashboard's "Open" action should point for a preview.
 *
 * With the mock deploy driver (local dev / the seeded demo) preview URLs like
 * `https://<slug>.preview.localhost` are fabricated for realism — nothing is
 * actually served there, so opening one yields a browser "can't be reached"
 * error. In that mode we instead route to an in-app **simulated preview**
 * (`/preview/<id>`) that always loads and shows the running environment.
 *
 * In a real deploy mode (`NEXT_PUBLIC_DEPLOY_DRIVER=docker`) the URL is a live
 * deployment, so we link straight to it.
 *
 * @module
 */

/** True when previews are simulated (mock driver) and their URLs aren't real. */
export const MOCK_DEPLOY =
  (process.env.NEXT_PUBLIC_DEPLOY_DRIVER ?? "mock").toLowerCase() === "mock";

/** A resolved "Open" target: where to point, and whether it leaves the app. */
export interface OpenTarget {
  /** The href to navigate to, or `null` when there is nothing to open. */
  readonly href: string | null;
  /** `true` for a real external deployment, `false` for the in-app simulation. */
  readonly external: boolean;
}

/**
 * Resolve the "Open" target for a preview.
 *
 * @param preview - The preview's id and (possibly live) URL.
 * @returns Where "Open" should go and whether it is an external link.
 */
export function previewOpenTarget(preview: {
  id: string;
  url: string | null;
}): OpenTarget {
  if (MOCK_DEPLOY) {
    return { href: `/preview/${preview.id}`, external: false };
  }
  return { href: preview.url, external: true };
}
