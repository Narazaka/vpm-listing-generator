import { expect, test, vi } from "vitest";

type GqlRelease = {
  name: string;
  tagName: string;
  releaseAssets: {
    nodes: { name: string; downloadUrl: string }[];
  };
};

type PkgJson = {
  name: string;
  displayName: string;
  version: string;
};

const source = {
  name: "Test VPM",
  id: "test.vpm",
  url: "https://example.com/index.json",
  author: { name: "Tester" },
};

function makeRelease(pkg: PkgJson, assetBase: string): GqlRelease {
  return {
    name: `${pkg.name} ${pkg.version}`,
    tagName: `${pkg.name}-v${pkg.version}`,
    releaseAssets: {
      nodes: [
        {
          name: "package.json",
          downloadUrl: `${assetBase}/${pkg.name}-${pkg.version}/package.json`,
        },
        {
          name: `${pkg.name}-${pkg.version}.zip`,
          downloadUrl: `${assetBase}/${pkg.name}-${pkg.version}/${pkg.name}-${pkg.version}.zip`,
        },
      ],
    },
  };
}

function makeGraphqlMock(reposReleases: Record<string, PkgJson[]>) {
  return vi.fn(async (query: string) => {
    const result: Record<string, unknown> = {};
    const matches = [
      ...query.matchAll(
        /repo_(\d+): repository\(owner: "([^"]+)", name: "([^"]+)"\)/g,
      ),
    ];
    for (const m of matches) {
      const alias = `repo_${m[1]}`;
      const fullName = `${m[2]}/${m[3]}`;
      const pkgs = reposReleases[fullName] ?? [];
      result[alias] = {
        releases: {
          nodes: pkgs.map((p) =>
            makeRelease(p, `https://dl.example.com/${fullName}`),
          ),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };
    }
    return result;
  });
}

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { generate } = await import("./index.js");

function setupFetch(packageJsonMap: Record<string, PkgJson>) {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    const pkg = packageJsonMap[url];
    if (!pkg) {
      return new Response("not found", { status: 404 });
    }
    return new Response(JSON.stringify(pkg), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
}

test("single repo yields two distinct packages when releases have different names", async () => {
  const repo = "owner/multi-package-repo";
  const pkgAv1: PkgJson = {
    name: "test.package-a",
    displayName: "Package A",
    version: "1.0.0",
  };
  const pkgAv2: PkgJson = {
    name: "test.package-a",
    displayName: "Package A",
    version: "1.1.0",
  };
  const pkgB: PkgJson = {
    name: "test.package-b",
    displayName: "Package B",
    version: "1.0.0",
  };

  const base = `https://dl.example.com/${repo}`;
  setupFetch({
    [`${base}/test.package-a-1.0.0/package.json`]: pkgAv1,
    [`${base}/test.package-a-1.1.0/package.json`]: pkgAv2,
    [`${base}/test.package-b-1.0.0/package.json`]: pkgB,
  });

  const octokit = {
    graphql: makeGraphqlMock({ [repo]: [pkgAv1, pkgAv2, pkgB] }),
  } as never;

  const listing = await generate(
    { ...source, githubRepos: [repo] },
    { octokit, calcSHA256: false, check: false },
  );

  expect(Object.keys(listing.packages).sort()).toEqual([
    "test.package-a",
    "test.package-b",
  ]);
  expect(
    Object.keys(listing.packages["test.package-a"].versions).sort(),
  ).toEqual(["1.0.0", "1.1.0"]);
  expect(Object.keys(listing.packages["test.package-b"].versions)).toEqual([
    "1.0.0",
  ]);
});

test("same package name across multiple repos gets versions merged", async () => {
  const repoA = "owner/same-package-repo-a";
  const repoB = "owner/same-package-repo-b";
  const fromRepoA: PkgJson = {
    name: "test.same-package",
    displayName: "Same Package",
    version: "1.0.0",
  };
  const fromRepoB: PkgJson = {
    name: "test.same-package",
    displayName: "Same Package",
    version: "2.0.0",
  };

  setupFetch({
    [`https://dl.example.com/${repoA}/test.same-package-1.0.0/package.json`]:
      fromRepoA,
    [`https://dl.example.com/${repoB}/test.same-package-2.0.0/package.json`]:
      fromRepoB,
  });

  const octokit = {
    graphql: makeGraphqlMock({
      [repoA]: [fromRepoA],
      [repoB]: [fromRepoB],
    }),
  } as never;

  const listing = await generate(
    { ...source, githubRepos: [repoA, repoB] },
    { octokit, calcSHA256: false, check: false },
  );

  expect(Object.keys(listing.packages)).toEqual(["test.same-package"]);
  expect(
    Object.keys(listing.packages["test.same-package"].versions).sort(),
  ).toEqual(["1.0.0", "2.0.0"]);
});

test("single package with multiple versions still works (regression)", async () => {
  const repo = "owner/single-package-repo";
  const v1: PkgJson = {
    name: "test.single-package",
    displayName: "Single Package",
    version: "1.0.0",
  };
  const v2: PkgJson = {
    name: "test.single-package",
    displayName: "Single Package",
    version: "1.0.1",
  };

  const base = `https://dl.example.com/${repo}`;
  setupFetch({
    [`${base}/test.single-package-1.0.0/package.json`]: v1,
    [`${base}/test.single-package-1.0.1/package.json`]: v2,
  });

  const octokit = {
    graphql: makeGraphqlMock({ [repo]: [v1, v2] }),
  } as never;

  const listing = await generate(
    { ...source, githubRepos: [repo] },
    { octokit, calcSHA256: false, check: false },
  );

  expect(Object.keys(listing.packages)).toEqual(["test.single-package"]);
  expect(
    Object.keys(listing.packages["test.single-package"].versions).sort(),
  ).toEqual(["1.0.0", "1.0.1"]);
});
