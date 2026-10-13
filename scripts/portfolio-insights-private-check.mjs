// Keep source details, including private campaign codes, out of check output.
export async function checkPrivateAssignments(read, minimum) {
  if (!Number.isSafeInteger(minimum) || minimum < 0) {
    throw new Error("Minimum assignment count must be a nonnegative integer");
  }
  let assignments;
  try {
    assignments = await read();
  } catch {
    throw new Error("Private assignment read failed; inspect the scoped source configuration");
  }
  if (assignments.length < minimum) throw new Error(`Assignment count ${assignments.length} is below ${minimum}`);
  return `Private assignment read passed: ${assignments.length} assignments, ${assignments.filter((item) => item.person).length} named`;
}
