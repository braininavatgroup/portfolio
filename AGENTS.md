Bradley's public portfolio, bradleyberkman.com: a vinext app with a map, a reader and a chat assistant, served by one Cloudflare Worker.
The check is `npm test`: typecheck, lint, vitest, the studio tests, then a full build and `test:rendered`, which proves the sentinel keys never reach the client bundle.
A merge to main deploys to production automatically (bradleyberkman.com, www and insights.braininavat.dance); the Worker `bradley-portfolio-main-preview` and everything named "main-preview" is production, not a preview.
Live: after a merge, check the deploy job with `gh run list --workflow ci -L 1` and open bradleyberkman.com in the browser skill.
Copy lives in `content/portfolio-content.json`; before UI work read `docs/design-conventions.md` and the component's sheet in `docs/components/`; social video is a JSON spec in `scripts/clip-studio/specs/` (see `docs/clip-studio.md`).
