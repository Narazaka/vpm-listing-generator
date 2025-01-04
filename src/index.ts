import type { Octokit } from "octokit";
import typia from "typia";
import type { Listing } from "./Listing.js";
import type { Package } from "./Package.js";
import type { Source } from "./Source.js";

const assertSource = /*#__PURE__*/ typia.createAssert<Source>();
const assertPackage = /*#__PURE__*/ typia.createAssert<Package>();
const assertListing = /*#__PURE__*/ typia.createAssert<Listing>();

export async function generate(
  source: Source,
  octokit: Octokit,
): Promise<Listing> {
  assertSource(source);
  const githubRepos = source.githubRepos ?? [];
  const packages: Listing["packages"] = {};
  for (const githubRepo of githubRepos) {
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
      if (!packageJson) continue;
      const pkg = await fetchPackageJson(packageJson.browser_download_url);
      packageId = pkg.name;
      const zipName = `${pkg.name}-${pkg.version}.zip`;
      const zip = release.assets.find((asset) => asset.name === zipName);
      if (!zip) {
        throw new Error(
          `Failed to find zip file ${zipName} in release ${githubRepo} ${release.name}`,
        );
      }
      versions[pkg.version] = {
        ...pkg,
        url: zip.browser_download_url,
        zipSHA256: await fetchZipSHA256(zip.browser_download_url),
      };
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
