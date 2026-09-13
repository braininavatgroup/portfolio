/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { withPublicPortfolio } from "./public-portfolio";
import {
  handlePortfolioFeedbackAdmin,
  withPortfolioFeedback,
  type PortfolioFeedbackEnv,
} from "./portfolio-feedback";

export { PortfolioChatBudgetObject } from "./portfolio-chat-budget";
export { PortfolioFeedbackObject } from "./portfolio-feedback-store";

type WorkerEnv = Omit<Cloudflare.Env, "ASSETS" | "IMAGES"> &
  Partial<Pick<Cloudflare.Env, "ASSETS" | "IMAGES">> &
  PortfolioFeedbackEnv;
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
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    // The feedback digest authenticates with its own bearer token; every other
    // route is public.
    const admin = await handlePortfolioFeedbackAdmin(request, env);
    if (admin) return admin;
    return withPortfolioFeedback(request, env, () =>
      withPublicPortfolio(request, () =>
        serveApplication(request, env, ctx),
      ),
    );
  },
};

export default worker;
