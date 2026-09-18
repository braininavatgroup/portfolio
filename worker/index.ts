/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { withoutPhantomBody } from "./inbound-request";
import { withPublicPortfolio } from "./public-portfolio";
import {
  withDesignGallery,
  type DesignGalleryEnv,
} from "./design-gallery";
import {
  handlePortfolioFeedbackAdmin,
  withPortfolioFeedback,
  type PortfolioFeedbackEnv,
} from "./portfolio-feedback";
import {
  handlePortfolioInsights,
  runScheduledInsights,
  type PortfolioInsightsEnv,
} from "./portfolio-insights-job";

export { PortfolioChatBudgetObject } from "./portfolio-chat-budget";
export { PortfolioFeedbackObject } from "./portfolio-feedback-store";

type WorkerEnv = Omit<Cloudflare.Env, "ASSETS" | "IMAGES"> &
  Partial<Pick<Cloudflare.Env, "ASSETS" | "IMAGES">> &
  PortfolioFeedbackEnv &
  PortfolioInsightsEnv &
  DesignGalleryEnv;
type ImageOutputFormat = Parameters<ImageTransformer["output"]>[0]["format"];

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

async function serveApplication(
  request: Request,
  env: WorkerEnv,
  ctx: ExecutionContext,
) {
  const url = new URL(request.url);

  const assets = env.ASSETS;
  const images = env.IMAGES;
  if (url.pathname === "/_vinext/image" && assets && images) {
    const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
    return handleImageOptimization(request, {
      fetchAsset: (path) => assets.fetch(new Request(new URL(path, request.url))),
      transformImage: async (body, { width, format, quality }) => {
        const result = await images.input(body).transform(width > 0 ? { width } : {}).output({
          format: format as ImageOutputFormat,
          quality,
        });
        return result.response();
      },
    }, allowedWidths);
  }

  if ((request.method === "GET" || request.method === "HEAD") && env.ASSETS) {
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }
  }

  return handler.fetch(request, env, ctx);
}

const worker = {
  async fetch(
    inbound: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // A bodyless GET or HEAD that still declares Content-Length made the app
    // router throw, which Cloudflare answered with its own error page. Dropping
    // the claim here keeps every layer below working on a coherent request.
    const request = withoutPhantomBody(inbound);
    // The insights dashboard is a different site on a different hostname, with
    // its own Cloudflare Access gate. It answers before every portfolio handler
    // so none of them can route around that gate.
    const insights = await handlePortfolioInsights(request, env);
    if (insights) return insights;
    // The feedback digest authenticates with its own bearer token; every other
    // route is public.
    const admin = await handlePortfolioFeedbackAdmin(request, env);
    if (admin) return admin;
    return withPortfolioFeedback(request, env, () =>
      withPublicPortfolio(request, () =>
        withDesignGallery(request, env, () =>
          serveApplication(request, env, ctx),
        ),
      ),
    );
  },

  // The daily insights run. A failure is this run's failure: the previous
  // dashboard stays served, and each source keeps its own last-known-good
  // value, so tomorrow's run starts from the same place this one did.
  async scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runScheduledInsights(env).then((result) => {
        // The report names assigned links, so only the run's shape is logged.
        console.log(
          JSON.stringify({
            job: "portfolio-insights",
            exitCode: result.exitCode,
            sources: Object.fromEntries(
              Object.entries(result.snapshot?.sources ?? {}).map(([name, state]) => [
                name,
                (state as { status?: string }).status ?? "unknown",
              ]),
            ),
          }),
        );
      }),
    );
  },
};

export default worker;
