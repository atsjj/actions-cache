import * as core from "@actions/core";
import { writeFileSync } from "fs";
import * as path from "path";
import { createTar, extractTar, listTar } from "./archive";
import S3Storage from "./storage/s3-storage";
import * as utils from "./utils";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ReserveCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReserveCacheError";
    Object.setPrototypeOf(this, ReserveCacheError.prototype);
  }
}

function checkPaths(paths: string[]): void {
  if (!paths || paths.length === 0) {
    throw new ValidationError(
      `Path Validation Error: At least one directory or file path is required`
    );
  }
}

function checkKey(key: string): void {
  if (key.length > 512) {
    throw new ValidationError(
      `Key Validation Error: ${key} cannot be larger than 512 characters.`
    );
  }

  const regex = /^[^,]*$/;

  if (!regex.test(key)) {
    throw new ValidationError(
      `Key Validation Error: ${key} cannot contain commas.`
    );
  }
}

/**
 * Restores cache from keys
 *
 * @param paths a list of file paths to restore from the cache
 * @param primaryKey an explicit key for restoring the cache
 * @param restoreKeys an optional ordered list of keys to use for restoring the cache if no cache hit occurred for key
 * @param downloadOptions cache download options
 * @returns string returns the key for the cache hit, otherwise returns undefined
 */
export async function restoreCache(
  paths: string[],
  primaryKey: string,
  _restoreKeys?: string[],
  _options?: Record<string, unknown>
): Promise<string | undefined> {
  const compressionMethod = await utils.getCompressionMethod();
  const storage = new S3Storage();

  checkPaths(paths);

  core.debug("Resolved Keys:");
  core.debug(primaryKey);

  checkKey(primaryKey);

  if (!(await storage.exists(primaryKey))) {
    return undefined;
  }

  const archivePath = path.join(
    await utils.createTempDirectory(),
    utils.getCacheFileName(compressionMethod)
  );

  core.debug(`Archive Path: ${archivePath}`);

  try {
    // Download the cache from the cache entry
    writeFileSync(archivePath, await storage.download(primaryKey));

    if (core.isDebug()) {
      await listTar(archivePath, compressionMethod);
    }

    const archiveFileSize = await utils.getArchiveFileSizeIsBytes(archivePath);

    core.info(
      `Cache Size: ~${Math.round(
        archiveFileSize / (1024 * 1024)
      )} MB (${archiveFileSize} B)`
    );

    await extractTar(archivePath, compressionMethod);

    core.info("Cache restored successfully");
  } finally {
    // Try to delete the archive to save space
    try {
      utils.unlinkFile(archivePath);
    } catch (error) {
      core.debug(`Failed to delete archive: ${error}`);
    }
  }

  return primaryKey;
}

/**
 * Saves a list of files with the specified key
 *
 * @param paths a list of file paths to be cached
 * @param key an explicit key for restoring the cache
 * @param options cache upload options
 * @returns number returns cacheId if the cache was saved successfully and throws an error if save fails
 */
export async function saveCache(
  paths: string[],
  key: string,
  _options?: Record<string, unknown>
): Promise<string> {
  const storage = new S3Storage();
  const compressionMethod = await utils.getCompressionMethod();

  checkPaths(paths);
  checkKey(key);

  core.debug("Reserving Cache");

  core.debug(`Cache ID: ${key}`);

  const cachePaths = await utils.resolvePaths(paths);

  core.debug("Cache Paths:");
  core.debug(`${JSON.stringify(cachePaths)}`);

  const archiveFolder = await utils.createTempDirectory();

  const archivePath = path.join(
    archiveFolder,
    utils.getCacheFileName(compressionMethod)
  );

  core.debug(`Archive Path: ${archivePath}`);

  await createTar(archiveFolder, cachePaths, compressionMethod);

  if (core.isDebug()) {
    await listTar(archivePath, compressionMethod);
  }

  const fileSizeLimit = 5 * 1024 * 1024 * 1024; // 5GB per repo limit
  const archiveFileSize = await utils.getArchiveFileSizeIsBytes(archivePath);

  core.debug(`File Size: ${archiveFileSize}`);

  if (archiveFileSize > fileSizeLimit) {
    throw new Error(
      `Cache size of ~${Math.round(
        archiveFileSize / (1024 * 1024)
      )} MB (${archiveFileSize} B) is over the 5GB limit, not saving cache.`
    );
  }

  core.debug(`Saving Cache (ID: ${key})`);

  storage.upload(key, archivePath, await utils.getChecksum(archivePath));

  return key;
}
