import * as core from "@actions/core";
import { S3 } from "aws-sdk";
import type { PathLike } from "fs";
import { readFileSync } from "fs";
import { S3StorageRefs } from "../constants";

export interface Storage {
  upload(key: string, path: PathLike, checksum: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  download(key: string): Promise<Uint8Array>;
}

function getObject(s3: S3, bucket: string, key: string): Promise<Uint8Array> {
  return new Promise(function (resolve, reject) {
    s3.getObject({ Bucket: bucket, Key: key }, function (error, data) {
      if (error) {
        reject(error);
      } else {
        if (data.Body === undefined) {
          reject("S3 returned `undefined` as an object");
        } else {
          resolve((data.Body as unknown) as Uint8Array);
        }
      }
    });
  });
}

function headObject(s3: S3, bucket: string, key: string): Promise<boolean> {
  return new Promise(function (resolve, reject) {
    s3.headObject({ Bucket: bucket, Key: key }, function (error, data) {
      if (error) {
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

function putObject(
  s3: S3,
  bucket: string,
  key: string,
  checksum: string,
  body: Uint8Array
): Promise<void> {
  return new Promise(function (resolve, reject) {
    s3.putObject(
      { Body: body, Bucket: bucket, Key: key, ContentMD5: checksum },
      function (error) {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
}

function getInput(env: string, ref: string): string {
  try {
    return core.getInput(ref, { required: true });
  } catch (_) {
    const value = process.env[env];

    if (value === undefined) {
      throw new Error(`Missing environment variable \`${env}\``);
    }

    return value;
  }
}

export default class S3Storage implements Storage {
  backend = new S3({
    credentials: {
      accessKeyId: getInput(
        S3StorageRefs.AccessKeyEnv,
        S3StorageRefs.AccessKeyRef
      ),
      secretAccessKey: getInput(
        S3StorageRefs.SecretKeyEnv,
        S3StorageRefs.SecretKeyRef
      ),
    },
    region: getInput(S3StorageRefs.RegionEnv, S3StorageRefs.RegionRef),
  });

  get bucket(): string {
    return getInput(S3StorageRefs.BucketEnv, S3StorageRefs.BucketRef);
  }

  async upload(key: string, path: PathLike, checksum: string): Promise<void> {
    return await putObject(
      this.backend,
      this.bucket,
      key,
      checksum,
      readFileSync(path)
    );
  }

  async exists(key: string): Promise<boolean> {
    return await headObject(this.backend, this.bucket, key);
  }

  async download(key: string): Promise<Uint8Array> {
    return await getObject(this.backend, this.bucket, key);
  }
}
