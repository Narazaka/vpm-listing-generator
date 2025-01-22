import { Octokit } from "octokit";
import { expect, test } from "vitest";
import { generate } from "./index";

const source = {
  name: "Narazaka VPM Listing",
  id: "net.narazaka.vpm",
  url: "https://vpm.narazaka.net/index.json",
  author: {
    email: "",
    name: "Narazaka",
    url: "https://github.com/Narazaka",
  },
  description: "Narazaka VPM packages",
  infoLink: {
    url: "https://github.com/Narazaka/vpm-repos",
    text: "View on GitHub",
  },
  bannerUrl: "banner.png",
  githubRepos: [
    "Narazaka/BoneSelector",
    "Narazaka/BoneSelectTool",
    "Narazaka/PhysBoneSelector",
    "Narazaka/UnusedBonesByReferencesTool",
    "Narazaka/AvatarMenuCreaterForMA",
    "Narazaka/AvatarParametersSaver",
    "Narazaka/ManualBaker",
    "Narazaka/CheckMissingScripts",
    "Narazaka/MagicalDresserInventorySystemModularAvatarExtension",
    "Narazaka/BreastPBAdjuster",
    "Narazaka/TeleportSetter",
    "Narazaka/FloorAdjuster",
    "Narazaka/SyncTexture",
    "Narazaka/RenderTexture2D",
    "Narazaka/ShaderValueIO",
    "Narazaka/YutoroomEssentials",
    "Narazaka/AvatarParametersDriver",
    "Narazaka/AvatarParametersExclusiveGroup",
    "Narazaka/AvatarParametersUtil",
    "Narazaka/SimpleHash",
    "Narazaka/DeleteEditorOnly",
    "Narazaka/VRCRenderQueueDebug",
    "Narazaka/SyncTextureShaderDXT",
    "Narazaka/ShaderDXT",
    "Narazaka/MaterialVariantCreator",
    "Narazaka/OnlyVRCFallbackShader",
    "Narazaka/tiled-number-shader",
    "Narazaka/SimpleClock",
    "Narazaka/SimplePlayerCount",
    "Narazaka/SimplePlatformPlayerCount",
    "Narazaka/AvatarStatusWindowMaker",
    "Narazaka/AnimatorLayerFilter",
    "Narazaka/tmp-fallback-fonts-jp",
    "Narazaka/ParameterIconGenerator",
    "Narazaka/Mirror4Avatar",
    "Narazaka/NOPShader",
    "Narazaka/AddMaterialSlots",
    "Narazaka/AvatarOnlyMe",
    "Narazaka/SmartCollider",
    "Narazaka/UIRelay",
    "Narazaka/URLBookmarks",
    "Narazaka/BedGimmicks",
    "Narazaka/MakeUPMPackage",
    "Narazaka/CopyAssetsWithDependency",
  ],
  packages: [],
};

const timeout = 1000 * 60 * 30;

test("generate", { timeout }, async () => {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const listing = generate(source, {
    octokit,
    logger: console.log,
  });
  expect(listing).resolves.toBeDefined();
});

const invalidSource = {
  name: "XXX",
  id: "fr.spokeek.XXX",
  url: "https://github.com/Spokeek/XXX",
  author: {
    email: "XXX",
    name: "XXX",
    url: "XXX",
  },
  description: "XXX",
  githubRepos: ["bdunderscore/modular-avatar"],
};

test("generate invalid fails", { timeout }, async () => {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const listing = generate(invalidSource, {
    octokit,
    logger: console.log,
  });
  expect(listing).rejects.toBeDefined();
});

test("generate invalid success without check", { timeout }, async () => {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const listing = generate(invalidSource, {
    octokit,
    check: false,
    logger: console.log,
  });
  expect(listing).resolves.toBeDefined();
});
