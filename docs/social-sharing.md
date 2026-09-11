# Social sharing previews

Every portfolio record and theme has a canonical `/index/<id>` URL. These routes
render the selected content and page metadata in the initial HTML response.
Navigation writes the canonical path; old root hash links still open their content,
but fragments cannot identify a project to a social crawler.

`lib/portfolio-sharing.ts` owns the metadata and image inventory. Records and themes
inherit their authored titles and descriptions. Supporting routes are listed explicitly.
When adding a public HTML route, add its entry and export `shareMetadata(id)` from
its page, then extend the supporting-route rendered test.

`npm run build:sharing` generates 1200 × 630 PNG cards into `public/sharing/`.
Both `npm run dev` and `npm run build` generate them automatically. The approved editorial A palette is shared across the sites, and the bundled Neue Haas
fonts render the identity and headline.
The generator runs only in Node during development/build; Workers serve static PNGs.
Generated images are ignored by Git and copied into `dist/client/sharing` by the build.
The sharp type-only import addresses the 0.35 package's missing type export; runtime
resolution uses its normal CommonJS export.

`tests/rendered-routes.test.mjs` checks all authored records and themes plus supporting
pages for canonical URLs, Open Graph, Twitter cards, and generated PNG dimensions.
`PortfolioExperience.test.tsx` covers direct selection and navigation/history.

Deploying remains a separate action. After deployment, inspect the actual public
project URLs in LinkedIn's Post Inspector to refresh cached previews, then retry
adding the touring, reporting, and Dubs links to Featured. Local metadata checks do
not prove LinkedIn has fetched the deployed page or refreshed its cache.

The BIV-433 composition uses `scripts/vendor/social-preview.mjs`, vendored unchanged from
music-promo's `tools/social-preview/render.mjs`. Identity, category, headline, and domain
share the BiV layout. Descriptions stay in metadata. Titles cannot shrink below 48px.
The `v=biv-433` image URL distinguishes the new cards from the previous cached images.
