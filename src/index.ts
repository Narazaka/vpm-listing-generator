import type { Octokit } from "octokit";
import PQueue from "p-queue";
import { type Listing, assertListing } from "./Listing.js";
import { type Package, assertPackage } from "./Package.js";
import { type Source, assertSource } from "./Source.js";
import { type StrictPackage, assertStrictPackage } from "./StrictPackage.js";
import fetchBuilder from "fetch-retry";
import type { GqlResponse } from "./GqlTypes.js";
const fetch = fetchBuilder(globalThis.fetch);

// The old Release type was based on the REST API.
// We create a new compatible type for the processing loop.
type Release = {
  name: string;
  tag_name: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
};

export type RetryDelayFunction = (
  attempt: number,
  error: Error | null,
  response: Response | null,
) => number;

export type RetryDelayOption = number | RetryDelayFunction;

export type RetryOnFunction = (
  attempt: number,
  error: Error | null,
  response: Response | null,
) => boolean | Promise<boolean>;

export type RetryOnOption = number[] | RetryOnFunction;

/** generate vpm repository listing json */
export async function generate(
  /** source json */
  source: Source,
  /** options */
  options: {
    /** octokit to call Github API */
    octokit: Octokit;
    /** generate zipSHA256 */
    calcSHA256?: boolean;
    /** logger ex: console.log */
    logger?: (message: string) => unknown;
    /** fetch ZIP concurrency */
    concurrency?: number;
    /** @deprecated Not used anymore since switching to batched GraphQL queries. */
    apiConcurrency?: number;
    /** skip assert if false */
    check?: boolean;
    retries?: number;
    retryDelay?: RetryDelayOption;
    retryOn?: RetryOnOption;
    /** additional kv on version entry */
    additionalOnVersion?: (context: {
      githubRepo: string;
      package: Package;
      release: Release;
      addFetchQueue<T>(job: () => T): Promise<T>;
    }) => Promise<Record<string, unknown>> | Record<string, unknown>;
  },
): Promise<Listing> {
  const {
    octokit,
    logger,
    calcSHA256 = true,
    concurrency = 6,
    additionalOnVersion,
    check = true,
    retries = 6,
    retryDelay = (attempt) => 2 ** attempt * 1000,
    retryOn = [400, 403, 408, 429, 500, 503, 504, 618],
  } = options;

  async function fetchPackageJson(url: string) {
    const res = await fetch(url, {
      redirect: "follow",
      retries,
      retryDelay,
      retryOn,
    });
    if (!res.ok) {
      throw new Error(
        `[${res.status}] Failed to fetch package.json from ${url}`,
      );
    }
    const json = (await res.json()) as Package;
    return check ? assertPackage(json) : json;
  }

  async function fetchZipSHA256(url: string) {
    const res = await fetch(url, {
      redirect: "follow",
      retries,
      retryDelay,
      retryOn,
    });
    if (!res.ok) {
      throw new Error(`[${res.status}] Failed to fetch zip file from ${url}`);
    }
    const buffer = await res.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  if (check) assertSource(source);

  const log = logger ?? (() => {});
  const githubRepos = source.githubRepos ?? [];
  const packages: Listing["packages"] = {};

  const fetchQueue = new PQueue({ concurrency });

  const allReleases: {
    [name: string]: Release[];
  } = {};
  for (const repo of githubRepos) {
    allReleases[repo] = [];
  }

  let reposToFetch: { name: string; cursor: string | null }[] = githubRepos.map(
    (repo) => ({ name: repo, cursor: null }),
  );

  while (reposToFetch.length > 0) {
    const queryFragments = reposToFetch.map(({ name, cursor }, i) => {
      const [owner, repo] = name.split("/");
      const after = cursor ? `, after: "${cursor}"` : "";
      return `
        repo_${i}: repository(owner: "${owner}", name: "${repo}") {
          releases(first: 100, orderBy: {field: CREATED_AT, direction: DESC}${after}) {
            nodes {
              name
              tagName
              releaseAssets(first: 100) {
                nodes {
                  name
                  downloadUrl
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }`;
    });

    const query = `query {\n${queryFragments.join("\n")}\n}`;

    log(`Fetching releases for ${reposToFetch.length} repositories.`);
    const gqlResponse = (await octokit.graphql(query)) as GqlResponse;

    const nextReposToFetch: { name: string; cursor: string | null }[] = [];
    for (let i = 0; i < reposToFetch.length; i++) {
      const repoName = reposToFetch[i].name;
      const repoData = gqlResponse[`repo_${i}`];
      if (!repoData) {
        log(`[${repoName}] No data returned from GraphQL.`);
        continue;
      }

      const releases = repoData.releases.nodes.map((release) => ({
        name: release.name,
        tag_name: release.tagName,
        assets: release.releaseAssets.nodes.map((asset) => ({
          name: asset.name,
          browser_download_url: asset.downloadUrl,
        })),
      }));
      allReleases[repoName].push(...releases);

      if (repoData.releases.pageInfo.hasNextPage) {
        nextReposToFetch.push({
          name: repoName,
          cursor: repoData.releases.pageInfo.endCursor,
        });
      }
    }
    reposToFetch = nextReposToFetch;
  }

  await Promise.all(
    githubRepos.map(async (githubRepo) => {
      const releases = allReleases[githubRepo];
      let packageId = "";
      const versions: Listing["packages"][string]["versions"] = {};
      await Promise.all(
        releases.map(async (release) => {
          const packageJson = release.assets.find(
            (asset) => asset.name === "package.json",
          );
          if (!packageJson) {
            log(
              `[${githubRepo}](${release.name}) Skipping release because it does not contain package.json`,
            );
            return;
          }

          const pkg = await fetchQueue.add(() => {
            log(
              `[${githubRepo}](${release.name}) Fetching package.json from ${packageJson.browser_download_url}`,
            );
            return fetchPackageJson(packageJson.browser_download_url);
          });
          if (!pkg) throw new Error("Failed to fetch package.json");
          packageId = pkg.name;
          const zipName = `${pkg.name}-${pkg.version}.zip`;
          const zip = release.assets.find((asset) => asset.name === zipName);
          if (!zip) {
            throw new Error(
              `Failed to find zip file ${zipName} in release ${githubRepo} ${release.name}`,
            );
          }
          let zipSHA256: undefined | string;
          if (calcSHA256) {
            const res = await fetchQueue.add(() => {
              log(
                `[${githubRepo}](${release.name}) \"${zipName}\" Fetching zip file from ${zip.browser_download_url}`,
              );
              return fetchZipSHA256(zip.browser_download_url);
            });
            if (res) zipSHA256 = res;
          }
          const additional = additionalOnVersion
            ? await additionalOnVersion({
                githubRepo,
                package: pkg,
                release,
                addFetchQueue: fetchQueue.add,
              })
            : {};
          const strictPackage: StrictPackage = zipSHA256
            ? {
                ...pkg,
                url: zip.browser_download_url,
                zipSHA256,
                ...additional,
              }
            : {
                ...pkg,
                url: zip.browser_download_url,
                ...additional,
              };
          versions[pkg.version] = check
            ? assertStrictPackage(strictPackage)
            : strictPackage;
        }),
      );
      if (!packageId) return;
      packages[packageId] = { versions };
    }),
  );
  const listing: Listing = {
    id: source.id,
    name: source.name,
    author: source.author.name,
    url: source.url,
    packages,
  };
  return check ? assertListing(listing) : listing;
}
