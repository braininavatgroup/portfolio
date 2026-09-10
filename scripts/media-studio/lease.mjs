import {
  openSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  closeSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

/** One editor or catalog refresh may own a private library at a time. */
export function acquireLibrary(dir) {
  const file = path.join(dir, "library.lock");
  const owner = JSON.stringify({ pid: process.pid, token: randomUUID() });
  let fd;
  try {
    fd = openSync(file, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        `This library is already open. Stop its studio before starting another or scanning. If the previous process crashed, check the PID in ${file} before removing that stale lock.`,
      );
    throw error;
  }
  try {
    writeFileSync(fd, owner);
  } finally {
    closeSync(fd);
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    if (readFileSync(file, "utf8") === owner) unlinkSync(file);
    process.removeListener("exit", release);
  };
  process.once("exit", release);
  return release;
}
