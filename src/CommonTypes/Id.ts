import type { tags } from "typia";

export type Id = string & tags.Pattern<"^[a-z.-]+$">;
