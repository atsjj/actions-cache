import * as core from "@actions/core";
import * as glob from "@actions/glob";
import * as io from "@actions/io";
import { createHash } from "crypto";
import type { PathLike } from "fs";
import { readFileSync, statSync, unlinkSync } from "fs";
import { join, relative } from "path";
import { v4 as uuidV4 } from "uuid";
import {
  CacheFilename,
  CompressionMethod,
  Outputs,
  PathRegexp,
  RefKey,
  State,
} from "./constants";

export async function getCompressionMethod(): Promise<CompressionMethod> {
  return CompressionMethod.Sz;
}

export function getCacheFileName(
  _compressionMethod: CompressionMethod
): string {
  return CacheFilename.Sz;
}

export function getWorkingDirectory(): string {
  return process.env["GITHUB_WORKSPACE"] ?? process.cwd();
}

export async function getChecksum(filePath: PathLike): Promise<string> {
  const hash = createHash("md5");

  hash.update(readFileSync(filePath));

  return hash.digest("base64");
}

export async function getArchiveFileSizeIsBytes(
  filePath: PathLike
): Promise<number> {
  return statSync(filePath).size;
}

export async function resolvePaths(patterns: string[]): Promise<string[]> {
  const paths: string[] = [];
  const workspace = process.env["GITHUB_WORKSPACE"] ?? process.cwd();
  const globber = await glob.create(patterns.join("\n"), {
    implicitDescendants: false,
  });

  for await (const file of globber.globGenerator()) {
    const relativeFile = relative(workspace, file).replace(PathRegexp, "/");

    core.debug(`Matched: ${relativeFile}`);

    // Paths are made relative so the tar entries are all relative to the root of the workspace.
    paths.push(`${relativeFile}`);
  }

  return paths;
}

// From https://github.com/actions/toolkit/blob/main/packages/tool-cache/src/tool-cache.ts#L23
export async function createTempDirectory(): Promise<string> {
  const IS_WINDOWS = process.platform === "win32";

  let tempDirectory: string = process.env["RUNNER_TEMP"] || "";

  if (!tempDirectory) {
    let baseLocation: string;

    if (IS_WINDOWS) {
      // On Windows use the USERPROFILE env variable
      baseLocation = process.env["USERPROFILE"] || "C:\\";
    } else {
      if (process.platform === "darwin") {
        baseLocation = "/Users";
      } else {
        baseLocation = "/home";
      }
    }
    tempDirectory = join(baseLocation, "actions", "temp");
  }

  const dest = join(tempDirectory, uuidV4());

  await io.mkdirP(dest);

  return dest;
}

export function unlinkFile(filePath: PathLike): void {
  unlinkSync(filePath);
}

export function isExactKeyMatch(key: string, cacheKey?: string): boolean {
  return !!(
    cacheKey &&
    cacheKey.localeCompare(key, undefined, {
      sensitivity: "accent",
    }) === 0
  );
}

export function setCacheState(state: string): void {
  core.saveState(State.CacheMatchedKey, state);
}

export function setCacheHitOutput(isCacheHit: boolean): void {
  core.setOutput(Outputs.CacheHit, isCacheHit.toString());
}

export function setOutputAndState(key: string, cacheKey?: string): void {
  setCacheHitOutput(isExactKeyMatch(key, cacheKey));
  // Store the matched cache key if it exists
  cacheKey && setCacheState(cacheKey);
}

export function getCacheState(): string | undefined {
  const cacheKey = core.getState(State.CacheMatchedKey);

  if (cacheKey) {
    core.debug(`Cache state/key: ${cacheKey}`);

    return cacheKey;
  }

  return undefined;
}

export function logWarning(message: string): void {
  const warningPrefix = "[warning]";

  core.info(`${warningPrefix}${message}`);
}

// Cache token authorized for all events that are tied to a ref
// See GitHub Context https://help.github.com/actions/automating-your-workflow-with-github-actions/contexts-and-expression-syntax-for-github-actions#github-context
export function isValidEvent(): boolean {
  return RefKey in process.env && Boolean(process.env[RefKey]);
}

export function getInputAsArray(
  name: string,
  options?: core.InputOptions
): string[] {
  return core
    .getInput(name, options)
    .split("\n")
    .map((s) => s.trim())
    .filter((x) => x !== "");
}

export function getInputAsInt(
  name: string,
  options?: core.InputOptions
): number | undefined {
  const value = parseInt(core.getInput(name, options));

  if (isNaN(value) || value < 0) {
    return undefined;
  }

  return value;
}
