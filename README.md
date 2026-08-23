# Bradley Berkman portfolio

An experimental spatial portfolio for Bradley Berkman's product, systems, and creative technology work. The main view turns projects into an explorable graph; every project also has a conventional HTML page.

This repository contains the portfolio itself. Job-search research, opportunity tracking, and application materials live elsewhere.

## Run it

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

The development server prints its local URL, normally `http://localhost:3000`.

## Routes

- `/` contains the pointer-responsive figure, transition into the graph, graph controls, node details, and portfolio chat.
- `/work` is the complete HTML project index and works without WebGL.
- `/work/[slug]` contains a project's case study and evidence state.

The current graph and case-study categories are prototype assumptions, not a permanent content schema. The next modeling pass will test whether a shared schema helps, what belongs in it, and how strict it should be.

## Evidence policy

The prototype never invents campaign counts, outcomes, artist photos, screenshots, release links, or handoff proof. Missing inputs are labeled `Evidence needed` and occupy replaceable slots. The current procedural figure is a stand-in for Bradley's final 3D model.

Inputs still needed for a production version include the real 3D model, roster press photos and verified campaign count, current resume, representative music outcomes, consulting before-and-afters, Dubs and Rit builds, three-maturity interfaces, the personal-tooling map, and one complete spec-to-agent record.

## Verification

```bash
npm test
npm run lint
npm run build
npm run test:rendered
```

`Show performance` appears only in development and reports a rolling browser frame rate. The code lowers scene complexity, caps device pixel ratio, and removes ambient motion before dropping the 3D scene. Final performance proof still requires representative physical devices.

This prototype is local only. No deployment or public activation is configured or authorized.
