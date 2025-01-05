import typia from "typia";
import type { Id } from "./CommonTypes/Id.js";
import type { NonEmptyString } from "./CommonTypes/NonEmptyString.js";
import type { Url } from "./CommonTypes/Url.js";
import type { Version } from "./CommonTypes/Version.js";
import type { StrictPackage } from "./StrictPackage.js";

export type Listing = {
  name: NonEmptyString;
  author: NonEmptyString;
  url: Url;
  id: Id;
  packages: {
    [K in Id]: {
      versions: {
        [K in Version]: StrictPackage;
      };
    };
  };
};

export const assertListing = /*#__PURE__*/ typia.createAssert<Listing>();
