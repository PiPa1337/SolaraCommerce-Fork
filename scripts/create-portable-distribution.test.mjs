import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldKeepPortableStore } from "./create-portable-distribution.mjs";

async function writeStoreManifest(dir, version) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), JSON.stringify({ current: { version } }), "utf8");
}

describe("shouldKeepPortableStore", () => {
  it("mantiene la tienda del portable cuando tiene un guardado más nuevo", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-keep-"));
    try {
      const preserved = join(root, "preserved");
      const repo = join(root, "repo");
      await writeStoreManifest(preserved, 41);
      await writeStoreManifest(repo, 40);
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("no pisa la versión del repo cuando es igual o más nueva", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-skip-"));
    try {
      const preserved = join(root, "preserved");
      const repo = join(root, "repo");
      await writeStoreManifest(preserved, 40);
      await writeStoreManifest(repo, 40);
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(false);
      await writeStoreManifest(repo, 42);
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recupera la tienda del portable si el repo no la tiene", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-only-"));
    try {
      const preserved = join(root, "preserved");
      await writeStoreManifest(preserved, 7);
      expect(await shouldKeepPortableStore(preserved, join(root, "repo-missing"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("ignora carpetas sin manifest o vacías", async () => {
    const root = await mkdtemp(join(tmpdir(), "portable-empty-"));
    try {
      const preserved = join(root, "preserved");
      const repo = join(root, "repo");
      await mkdir(preserved, { recursive: true });
      await mkdir(repo, { recursive: true });
      expect(await shouldKeepPortableStore(preserved, repo)).toBe(false);
      expect(await shouldKeepPortableStore(join(root, "missing"), repo)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
