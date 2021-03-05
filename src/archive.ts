import { cmd as cmd7z } from "7zip-min";
import * as io from "@actions/io";
import { join } from "path";
import { CompressionMethod, PathRegexp } from "./constants";
import { getCacheFileName, getWorkingDirectory } from "./utils";

export async function cmd(...args: string[]): Promise<void> {
  return new Promise(function (resolve, reject) {
    cmd7z(args, function (error) {
      if (error) {
        reject(new Error(`7z failed with error: ${error}`));
      } else {
        resolve();
      }
    });
  });
}

export async function createTar(
  archiveFolder: string,
  sourceDirectories: string[],
  compressionMethod: CompressionMethod
): Promise<void> {
  const cacheFileName = getCacheFileName(compressionMethod);
  const workingDirectory = getWorkingDirectory();

  await cmd(
    "a",
    "-spf",
    join(archiveFolder, cacheFileName).replace(PathRegexp, "/"),
    ...sourceDirectories
  );
}

export async function extractTar(
  archivePath: string,
  _compressionMethod: CompressionMethod
): Promise<void> {
  const workingDirectory = getWorkingDirectory();

  await io.mkdirP(workingDirectory);

  await cmd("x", "-spf", archivePath.replace(PathRegexp, "/"));
}

export async function listTar(
  archivePath: string,
  _compressionMethod: CompressionMethod
): Promise<void> {
  await cmd("l", archivePath.replace(PathRegexp, "/"));
}
