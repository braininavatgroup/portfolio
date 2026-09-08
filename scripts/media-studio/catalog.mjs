/** Keep reviewed sources immutable. Changed footage gets a separate identity. */
export function mergeCatalog(previous, current, publications) {
  const merged = [...previous];
  for (const asset of current) {
    const published = publications.some(
      (p) =>
        p.src === asset.src &&
        p.sha256 === asset.sha256 &&
        previous.some((original) => original.sha256 === p.sourceHash),
    );
    const known = merged.some(
      (p) =>
        p.src === asset.src &&
        p.sha256 === asset.sha256 &&
        (asset.src || p.visualId === asset.visualId),
    );
    if (!published && !known) merged.push(asset);
  }
  return merged;
}
