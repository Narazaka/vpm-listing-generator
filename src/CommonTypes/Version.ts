import type { tags } from "typia";

export type Version = string &
  tags.Pattern<"^[0-9]+\\.[0-9]+\\.[0-9]+(?:-.+)?$">;
