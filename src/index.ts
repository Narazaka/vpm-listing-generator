import type { Octokit } from "octokit";
import typia from "typia";
import type { Listing } from "./Listing.js";
import type { Package } from "./Package.js";
import type { Source } from "./Source.js";
import type { StrictPackage } from "./StrictPackage.js";

const assertSource = /*#__PURE__*/ typia.createAssert<Source>();
const assertPackage = /*#__PURE__*/ typia.createAssert<Package>();
const assertStrictPackage = /*#__PURE__*/ typia.createAssert<StrictPackage>();
const assertListing = /*#__PURE__*/ typia.createAssert<Listing>();

export async function generate(
  source: Source,
  options: {
    octokit: Octokit;
    calcSHA256?: boolean;
    logger?: (message: string) => unknown;
  },
): Promise<Listing> {
  const { octokit, logger, calcSHA256 = true } = options;
  const log = logger ?? (() => {});
  assertSource(source);
  const githubRepos = source.githubRepos ?? [];
  const packages: Listing["packages"] = {};
  for (const githubRepo of githubRepos) {
    log(`--- Fetching releases from [${githubRepo}]`);
    const [owner, repo] = githubRepo.split("/");
    const releases = await octokit.paginate(octokit.rest.repos.listReleases, {
      owner,
      repo,
    });
    let packageId = "";
    const versions: Listing["packages"][string]["versions"] = {};
    for (const release of releases) {
      const packageJson = release.assets.find(
        (asset) => asset.name === "package.json",
      );
      if (!packageJson) {
        log(
          `[${githubRepo}](${release.name}) Skipping release because it does not contain package.json`,
        );
        continue;
      }
      log(
        `[${githubRepo}](${release.name}) Fetching package.json from ${packageJson.browser_download_url}`,
      );
      const pkg = await fetchPackageJson(packageJson.browser_download_url);
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
        log(
          `[${githubRepo}](${release.name}) \"${zipName}\" Fetching zip file from ${zip.browser_download_url}`,
        );
        zipSHA256 = await fetchZipSHA256(zip.browser_download_url);
      }
      versions[pkg.version] = assertStrictPackage(
        zipSHA256
          ? {
              ...pkg,
              url: zip.browser_download_url,
              zipSHA256,
            }
          : {
              ...pkg,
              url: zip.browser_download_url,
            },
      );
    }
    if (!packageId) continue;
    packages[packageId] = { versions };
  }
  return assertListing({
    id: source.id,
    name: source.name,
    author: source.author.name,
    url: source.url,
    packages,
  });
}

async function fetchPackageJson(url: string) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch package.json from ${url}`);
  }
  return assertPackage(await res.json());
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
