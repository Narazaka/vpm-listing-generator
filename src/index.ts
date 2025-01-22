import type { Octokit } from "octokit";
import PQueue from "p-queue";
import { type Listing, assertListing } from "./Listing.js";
import { type Package, assertPackage } from "./Package.js";
import { type Source, assertSource } from "./Source.js";
import { assertStrictPackage, type StrictPackage } from "./StrictPackage.js";

type PromiseValue<T> = T extends Promise<infer V> ? V : never;

function genFetchReleases(octokit: Octokit) {
  return function fetchReleases(githubRepo: string) {
    const [owner, repo] = githubRepo.split("/");
    return octokit.paginate(octokit.rest.repos.listReleases, {
      owner,
      repo,
    });
  };
}

type Release = PromiseValue<
  ReturnType<ReturnType<typeof genFetchReleases>>
>[number];

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
    /** fetch concurrency */
    concurrency?: number;
    /** skip assert if false */
    check?: boolean;
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
  } = options;

  async function fetchPackageJson(url: string) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Failed to fetch package.json from ${url}`);
    }
    const json = (await res.json()) as Package;
    return check ? assertPackage(json) : json;
  }

  if (check) assertSource(source);

  const log = logger ?? (() => {});
  const githubRepos = source.githubRepos ?? [];
  const packages: Listing["packages"] = {};

  const fetchQueue = new PQueue({ concurrency });

  const fetchReleases = genFetchReleases(octokit);
  const allReleases: {
    [name: string]: Release[];
  } = {};
  await Promise.all(
    githubRepos.map(async (githubRepo) => {
      const releases = (await fetchQueue.add(() => {
        log(`Fetching releases from [${githubRepo}]`);
        return fetchReleases(githubRepo);
      })) as Release[];
      allReleases[githubRepo] = releases;
    }),
  );

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

async function fetchZipSHA256(url: string) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch zip file from ${url}`);
  }
  const buffer = await res.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
