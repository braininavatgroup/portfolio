// The design gallery is a development tool, not a portfolio page. It renders
// every token and component in its meaningful states, including a full Three.js
// composition, and it exists so Bradley can look at the design system while
// working on it — there is nothing in it for a visitor.
//
// It used to be reachable in production behind the main-preview password. That
// gate is gone (PER-16), so the route is dormant by default and only answers
// where PORTFOLIO_DESIGN_GALLERY_ENABLED is "true", which only the local Vite
// Worker sets. Deployed, it 404s like any unknown path: no redirect, no login,
// and no signal that the route exists at all.

export interface DesignGalleryEnv {
  PORTFOLIO_DESIGN_GALLERY_ENABLED?: string;
}

const DESIGN_GALLERY_ROUTE = "/design";

export function isDesignGalleryRoute(pathname: string) {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return normalized === DESIGN_GALLERY_ROUTE;
}

export async function withDesignGallery(
  request: Request,
  env: DesignGalleryEnv,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  if (
    isDesignGalleryRoute(url.pathname) &&
    env.PORTFOLIO_DESIGN_GALLERY_ENABLED !== "true"
  ) {
    // Fail closed on an absent or malformed flag: a typo must not publish the
    // gallery. 404 rather than 403 so the deployed site does not advertise it.
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    });
  }
  return next();
}
