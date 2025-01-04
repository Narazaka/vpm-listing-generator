import type { tags } from "typia";
import type { Id } from "./CommonTypes/Id.js";
import type { NonEmptyString } from "./CommonTypes/NonEmptyString.js";
import type { Url } from "./CommonTypes/Url.js";

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
