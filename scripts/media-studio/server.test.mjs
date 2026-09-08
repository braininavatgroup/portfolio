import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { once } from "node:events";
import net from "node:net";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("local studio protects saves and serves immutable originals with media ranges", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "portfolio-studio-api-"));
  const reserve = net.createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  const bytes = Buffer.from("original-video");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const asset = {
    id: "video",
    name: "Test",
    src: "/visuals/test.mp4",
    sha256,
    kind: "video",
    duration: 10,
    checkpoints: [0],
  };
  const project = {
    version: 1,
    assets: {
      video: {
        sourceHash: sha256,
        status: "marked",
        notes: "",
        checkpoints: [0],
        tracks: [],
      },
    },
  };
  let child;
  try {
    await mkdir(path.join(dir, "originals"));
    await writeFile(path.join(dir, "originals", sha256), bytes);
    await writeFile(path.join(dir, "manifest.json"), JSON.stringify([asset]));
    await writeFile(
      path.join(dir, "manifest-meta.json"),
      JSON.stringify({ baseCommit: "fixture" }),
    );
    await writeFile(
      path.join(dir, "decisions.json"),
      JSON.stringify({ revision: 7, project }),
    );
    child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./server.mjs", import.meta.url))],
      {
        env: {
          ...process.env,
          PORTFOLIO_STUDIO_DATA_DIR: dir,
          PORTFOLIO_STUDIO_PORT: String(port),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error("Studio failed to start");
      }),
    ]);
    const origin = `http://127.0.0.1:${port}`;
    const get = await fetch(origin + "/api/project");
    assert.equal((await get.json()).revision, 7);
    const media = await fetch(origin + "/media/video", {
      headers: { Range: "bytes=0-7" },
    });
    assert.equal(media.status, 206);
    assert.equal(media.headers.get("content-type"), "video/mp4");
    assert.equal(await media.text(), "original");
    assert.equal((await fetch(origin + "/originals/" + sha256)).status, 404);
    const hostileHost = await new Promise((resolve, reject) => {
      http
        .get(
          origin + "/api/project",
          { headers: { Host: "attacker.test" } },
          (res) => {
            res.resume();
            resolve(res.statusCode);
          },
        )
        .on("error", reject);
    });
    assert.equal(hostileHost, 403);
    const save = async (revision, originHeader = origin, p = project) =>
      fetch(origin + "/api/project", {
        method: "POST",
        headers: { "content-type": "application/json", Origin: originHeader },
        body: JSON.stringify({ revision, project: p }),
      });
    assert.equal((await save(7, "https://attacker.test")).status, 403);
    assert.equal((await save(6)).status, 409);
    const invalid = structuredClone(project);
    invalid.assets.video.sourceHash = "changed";
    assert.equal((await save(7, origin, invalid)).status, 400);
    assert.equal((await save(7)).status, 200);
    assert.equal((await save(7)).status, 409);
    assert.equal(
      JSON.parse(
        await readFile(path.join(dir, "backups/decisions-7.json"), "utf8"),
      ).revision,
      7,
    );
    assert.equal(
      JSON.parse(await readFile(path.join(dir, "decisions.json"), "utf8"))
        .revision,
      8,
    );
  } finally {
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    await rm(dir, { recursive: true, force: true });
  }
});
