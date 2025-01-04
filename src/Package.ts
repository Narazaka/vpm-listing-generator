import type { tags } from "typia";
import type { Id } from "./CommonTypes/Id";
import type { NonEmptyString } from "./CommonTypes/NonEmptyString";
import type { Url } from "./CommonTypes/Url";
import type { Version } from "./CommonTypes/Version";

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
