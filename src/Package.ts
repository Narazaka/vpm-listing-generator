import type { tags } from "typia";
import typia from "typia";
import type { Id } from "./CommonTypes/Id.js";
import type { NonEmptyString } from "./CommonTypes/NonEmptyString.js";
import type { Url } from "./CommonTypes/Url.js";
import type { Version } from "./CommonTypes/Version.js";

export type Package = {
  name: Id;
  displayName: NonEmptyString;
  version: Version;
  description?: string;
  changelogUrl?: Url;
  documentationUrl?: Url;
  author?: { name?: string; url?: Url; email?: string & tags.Format<"email"> };
  license?: NonEmptyString;
  zipSHA256?: NonEmptyString;
  url?: Url;
  unity?: NonEmptyString;
  vpmDependencies?: {
    [name: string]: string;
  };
  legacyFolders?: {
    [path: string]: string;
  };
  legacyFiles?: {
    [path: string]: string;
  };
  legacyPackages?: Id[];
};

export const assertPackage = /*#__PURE__*/ typia.createAssert<Package>();
