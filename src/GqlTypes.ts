export type GqlAsset = {
  name: string;
  downloadUrl: string;
};

export type GqlRelease = {
  name: string;
  tagName: string;
  releaseAssets: {
    nodes: GqlAsset[];
  };
};

export type GqlReleases = {
  nodes: GqlRelease[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
};

export type GqlRepository = {
  releases: GqlReleases;
};

export type GqlResponse = Record<string, GqlRepository>;
