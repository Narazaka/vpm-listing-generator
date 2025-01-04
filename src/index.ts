import typia from "typia";
import type { Listing } from "./Listing";
import type { Source } from "./Source";

const assertSource = /*#__PURE__*/ typia.createAssert<Source>();

export function generate(source: Source): Listing {
  assertSource(source);
  return {
    id: source.id,
    name: source.name,
    author: source.author.name,
    url: source.url,
    packages: {},
  };
}
