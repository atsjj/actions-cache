import { Inputs } from "./constants";

// See: https://github.com/actions/toolkit/blob/master/packages/core/src/core.ts#L67
function getInputName(name: string): string {
  return `INPUT_${name.replace(/[\s-]/g, "_").toUpperCase()}`;
}

export function setInput(name: string, value: string): void {
  process.env[getInputName(name)] = value;
}

interface CacheInput {
  path: string;
  key: string;
  restoreKeys?: string[];
  "aws-access-key-id"?: string;
  "aws-default-bucket"?: string;
  "aws-default-region"?: string;
  "aws-secret-access-key"?: string;
}

export function setInputs(input: CacheInput): void {
  setInput(Inputs.Path, input.path);
  setInput(Inputs.Key, input.key);
  input.restoreKeys &&
    setInput(Inputs.RestoreKeys, input.restoreKeys.join("\n"));
}

export function clearInputs(): void {
  delete process.env[getInputName(Inputs.Path)];
  delete process.env[getInputName(Inputs.Key)];
  delete process.env[getInputName(Inputs.RestoreKeys)];
  delete process.env[getInputName(Inputs.UploadChunkSize)];
}
