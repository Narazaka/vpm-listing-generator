import typia from "typia";
import type { Package } from "./Package.js";

export type StrictPackage = Package & {
  url: Required<Package>["url"];
};

export const assertStrictPackage =
  /*#__PURE__*/ typia.createAssert<StrictPackage>();
