import type { Id } from "./CommonTypes/Id";
import type { NonEmptyString } from "./CommonTypes/NonEmptyString";
import type { Url } from "./CommonTypes/Url";
import type { StrictPackage } from "./StrictPackage";

export type Listing = {
  name: NonEmptyString;
  author: NonEmptyString;
  url: Url;
  id: Id;
  packages: {
    [K in Id]: {
      versions: {
        [K in Id]: StrictPackage;
      };
    };
  };
};
