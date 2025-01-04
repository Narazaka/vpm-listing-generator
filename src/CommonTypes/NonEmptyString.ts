import type { tags } from "typia";

export type NonEmptyString = string & tags.MinLength<1>;
