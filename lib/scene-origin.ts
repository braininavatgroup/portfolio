import type { Point3 } from "./graph-camera";

// Single world-space origin shared by the head brain, the graph root entity,
// and every cable start so the entry transition lands on one coherent point.
export const brainWorldOrigin: Point3 = [0, 1.75, 0];
