import typia from "typia";
import { expect, test } from "vitest";
import type { StrictPackage } from "./StrictPackage";

const assertStrictPackage = /*#__PURE__*/ typia.createAssert<StrictPackage>();

const packageJson = {
  name: "net.narazaka.unity.copy-assets-with-dependency",
  version: "1.0.0",
  displayName: "CopyAssetsWithDependency",
  description: "Copy Assets with dependency",
  author: {
    name: "Narazaka",
    url: "https://github.com/Narazaka",
  },
  license: "Zlib",
  type: "tool",
  url: "https://github.com/Narazaka/CopyAssetsWithDependency.git",
  legacyFolders: {
    "Assets\\CopyAssetsWithDependency": "d12c5aff8a18ec64ba0f3afdd8d31b08",
  },
};

test("Package", () => {
  expect(typia.validate<StrictPackage>(packageJson).success).toBeTruthy();
});
