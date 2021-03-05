import { sep } from "path";

export enum CacheFilename {
  Sz = "cache.7z",
}

export enum CompressionMethod {
  Sz = "Sz",
}

export enum Events {
  Key = "GITHUB_EVENT_NAME",
  Push = "push",
  PullRequest = "pull_request",
}

export enum Inputs {
  Key = "key",
  Path = "path",
  RestoreKeys = "restore-keys",
  UploadChunkSize = "upload-chunk-size",
}

export enum Outputs {
  CacheHit = "cache-hit",
}

export const PathRegexp = new RegExp(`\\${sep}`, "g");

export enum State {
  CachePrimaryKey = "CACHE_KEY",
  CacheMatchedKey = "CACHE_RESULT",
}

export const RefKey = "GITHUB_REF";

export enum S3StorageRefs {
  AccessKeyEnv = "AWS_ACCESS_KEY_ID",
  AccessKeyRef = "aws-access-key-id",
  BucketEnv = "AWS_DEFAULT_BUCKET",
  BucketRef = "aws-default-bucket",
  RegionEnv = "AWS_DEFAULT_REGION",
  RegionRef = "aws-default-region",
  SecretKeyEnv = "AWS_SECRET_ACCESS_KEY",
  SecretKeyRef = "aws-secret-access-key",
}
