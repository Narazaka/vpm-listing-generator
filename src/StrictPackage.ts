import type { Package } from "./Package.js";

export type StrictPackage = Package & {
  url: Required<Package>["url"];
};
