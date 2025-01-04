import type { tags } from "typia";
import type { Id } from "./CommonTypes/Id";
import type { NonEmptyString } from "./CommonTypes/NonEmptyString";
import type { Url } from "./CommonTypes/Url";

export type Source = {
  name: NonEmptyString;
  id: Id;
  url: Url;
  author: {
    name: NonEmptyString;
  };
  githubRepos?: (string & tags.Pattern<"^[^/]+/[^/]+$">)[];
  packages?: {
    name: Id;
    releases: Url[];
  }[];
};
