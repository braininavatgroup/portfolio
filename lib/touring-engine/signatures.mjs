// Pure canonical JSON for persisted equality checks. Object keys sort
// recursively; array order remains meaningful; undefined follows JSON rules.
function _signatureCanonicalize(value, inArray) {
  if (value === undefined) return inArray ? null : undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((entry) => _signatureCanonicalize(entry, true));
  }
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const entry = _signatureCanonicalize(value[key], false);
    if (entry !== undefined) out[key] = entry;
  }
  return out;
}

export function canonicalJson(value) {
  return JSON.stringify(_signatureCanonicalize(value, false));
}
