import * as core from "@actions/core";
import { Events, Inputs, RefKey } from "../src/constants";
import run from "../src/restore";
import * as cache from "./cache";
import * as testUtils from "./test-helpers";
import * as actionUtils from "./utils";

jest.mock("./utils");

beforeAll(() => {
  jest
    .spyOn(actionUtils, "isExactKeyMatch")
    .mockImplementation((key, cacheResult) => {
      const actualUtils = jest.requireActual("./utils");
      return actualUtils.isExactKeyMatch(key, cacheResult);
    });

  jest.spyOn(actionUtils, "isValidEvent").mockImplementation(() => {
    const actualUtils = jest.requireActual("./utils");
    return actualUtils.isValidEvent();
  });

  jest
    .spyOn(actionUtils, "getInputAsArray")
    .mockImplementation((name, options) => {
      const actualUtils = jest.requireActual("./utils");
      return actualUtils.getInputAsArray(name, options);
    });
});

beforeEach(() => {
  process.env[Events.Key] = Events.Push;
  process.env[RefKey] = "refs/heads/feature-branch";
});

afterEach(() => {
  testUtils.clearInputs();
  delete process.env[Events.Key];
  delete process.env[RefKey];
});

test("restore with invalid event outputs warning", async () => {
  const logWarningMock = jest.spyOn(actionUtils, "logWarning");
  const failedMock = jest.spyOn(core, "setFailed");
  const invalidEvent = "commit_comment";

  process.env[Events.Key] = invalidEvent;

  delete process.env[RefKey];

  await run();

  expect(logWarningMock).toHaveBeenCalledWith(
    `Event Validation Error: The event type ${invalidEvent} is not supported because it's not tied to a branch or tag ref.`
  );
  expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with no path should fail", async () => {
  const failedMock = jest.spyOn(core, "setFailed");
  const restoreCacheMock = jest.spyOn(cache, "restoreCache");

  await run();

  expect(restoreCacheMock).toHaveBeenCalledTimes(0);
  // this input isn't necessary for restore b/c tarball contains entries relative to workspace
  expect(failedMock).not.toHaveBeenCalledWith(
    "Input required and not supplied: path"
  );
});

test("restore with no key", async () => {
  testUtils.setInput(Inputs.Path, "node_modules");

  const failedMock = jest.spyOn(core, "setFailed");
  const restoreCacheMock = jest.spyOn(cache, "restoreCache");

  await run();

  expect(restoreCacheMock).toHaveBeenCalledTimes(0);
  expect(failedMock).toHaveBeenCalledWith(
    "Input required and not supplied: key"
  );
});

test("restore with no cache found", async () => {
  const path = "node_modules";
  const key = "node-test";

  testUtils.setInputs({
    path: path,
    key,
    "aws-access-key-id": "",
    "aws-default-bucket": "",
    "aws-default-region": "",
    "aws-secret-access-key": "",
  });

  const infoMock = jest.spyOn(core, "info");
  const failedMock = jest.spyOn(core, "setFailed");
  const stateMock = jest.spyOn(core, "saveState");
  const restoreCacheMock = jest
    .spyOn(cache, "restoreCache")
    .mockImplementationOnce(() => {
      return Promise.resolve(undefined);
    });

  await run();

  expect(restoreCacheMock).toHaveBeenCalledTimes(1);
  expect(restoreCacheMock).toHaveBeenCalledWith([path], key, []);
  expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
  expect(failedMock).toHaveBeenCalledTimes(0);
  expect(infoMock).toHaveBeenCalledWith(
    `Cache not found for input keys: ${key}`
  );
});

test("restore with server error should fail", async () => {
  const path = "node_modules";
  const key = "node-test";

  testUtils.setInputs({
    path: path,
    key,
    "aws-access-key-id": "",
    "aws-default-bucket": "",
    "aws-default-region": "",
    "aws-secret-access-key": "",
  });

  const logWarningMock = jest.spyOn(actionUtils, "logWarning");
  const failedMock = jest.spyOn(core, "setFailed");
  const stateMock = jest.spyOn(core, "saveState");

  const restoreCacheMock = jest
    .spyOn(cache, "restoreCache")
    .mockImplementationOnce(() => {
      throw new Error("HTTP Error Occurred");
    });

  const setCacheHitOutputMock = jest.spyOn(actionUtils, "setCacheHitOutput");

  await run();

  expect(restoreCacheMock).toHaveBeenCalledTimes(1);
  expect(restoreCacheMock).toHaveBeenCalledWith([path], key, []);
  expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
  expect(logWarningMock).toHaveBeenCalledTimes(1);
  expect(logWarningMock).toHaveBeenCalledWith("HTTP Error Occurred");
  expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
  expect(setCacheHitOutputMock).toHaveBeenCalledWith(false);
  expect(failedMock).toHaveBeenCalledTimes(0);
});

test("restore with restore keys and no cache found", async () => {
  const path = "node_modules";
  const key = "node-test";

  testUtils.setInputs({
    path: path,
    key,
    "aws-access-key-id": "",
    "aws-default-bucket": "",
    "aws-default-region": "",
    "aws-secret-access-key": "",
  });

  const infoMock = jest.spyOn(core, "info");
  const failedMock = jest.spyOn(core, "setFailed");
  const stateMock = jest.spyOn(core, "saveState");
  const restoreCacheMock = jest
    .spyOn(cache, "restoreCache")
    .mockImplementationOnce(() => {
      return Promise.resolve(undefined);
    });

  await run();

  expect(restoreCacheMock).toHaveBeenCalledTimes(1);
  expect(restoreCacheMock).toHaveBeenCalledWith([path], key, []);
  expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
  expect(failedMock).toHaveBeenCalledTimes(0);
  expect(infoMock).toHaveBeenCalledWith(
    `Cache not found for input keys: ${key}`
  );
});

test("restore with cache found for key", async () => {
  const path = "node_modules";
  const key = "node-test";
  testUtils.setInputs({
    path: path,
    key,
    "aws-access-key-id": "",
    "aws-default-bucket": "",
    "aws-default-region": "",
    "aws-secret-access-key": "",
  });

  const infoMock = jest.spyOn(core, "info");
  const failedMock = jest.spyOn(core, "setFailed");
  const stateMock = jest.spyOn(core, "saveState");
  const setCacheHitOutputMock = jest.spyOn(actionUtils, "setCacheHitOutput");
  const restoreCacheMock = jest
    .spyOn(cache, "restoreCache")
    .mockImplementationOnce(() => {
      return Promise.resolve(key);
    });

  await run();

  expect(restoreCacheMock).toHaveBeenCalledTimes(1);
  expect(restoreCacheMock).toHaveBeenCalledWith([path], key, []);
  expect(stateMock).toHaveBeenCalledWith("CACHE_KEY", key);
  expect(setCacheHitOutputMock).toHaveBeenCalledTimes(1);
  expect(setCacheHitOutputMock).toHaveBeenCalledWith(true);
  expect(infoMock).toHaveBeenCalledWith(`Cache restored from key: ${key}`);
  expect(failedMock).toHaveBeenCalledTimes(0);
});
