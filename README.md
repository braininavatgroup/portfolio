# Portfolio prototype

A local, transition-first prototype of Bradley Berkman's spatial portfolio.

## Run it

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The development server prints its local URL, normally `http://localhost:3000`.

## Routes

- `/` contains the procedural body, glass-head transition, brain graph, deterministic portfolio query, mobile domain tour, and keyboard node map.
- `/work` is the complete flat HTML index. It works without WebGL.
- `/work/[slug]` presents an artifact's full judgment-to-operation chain on one page.

## Evidence policy

The prototype never invents campaign counts, outcomes, artist photos, screenshots, release links, or handoff proof. Missing inputs are labeled `Evidence needed` and occupy replaceable slots. The current procedural body is a stand-in for Bradley's final 3D model.

Inputs still needed for a production version include the real 3D model, roster press photos and verified campaign count, current resume, representative music outcomes, consulting before-and-afters, Dubs and Rit builds, three-maturity interfaces, the personal-tooling map, and one complete spec-to-agent record.

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:rendered
```

`Show performance` appears only in development and reports a rolling browser frame rate. The code disables glass transmission, lowers geometry, caps device pixel ratio, and removes ambient motion before dropping the 3D scene. Final proof of sixty frames per second on a two-year-old laptop and thirty on a mid-range phone still requires those physical devices.

This prototype is local only. No deployment or public activation is configured or authorized.
