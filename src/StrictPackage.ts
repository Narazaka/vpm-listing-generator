import type { Package } from "./Package";

export type StrictPackage = Package & {
  zipSHA256: Required<Package>["zipSHA256"];
  url: Required<Package>["url"];
};
