import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const contentUrl = (name) => new URL(`content/tang-changan-742/${name}.json`, root);
const [sources, claims, origins, mapFeatures] = await Promise.all([
  readFile(contentUrl("sources"), "utf8").then(JSON.parse),
  readFile(contentUrl("claims"), "utf8").then(JSON.parse),
  readFile(contentUrl("origins"), "utf8").then(JSON.parse),
  readFile(contentUrl("map-features"), "utf8").then(JSON.parse),
]);

const fail = (message) => {
  throw new Error(`Phase 4 content validation failed: ${message}`);
};
const unique = (items, label) => {
  const ids = items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) fail(`${label} contains duplicate ids`);
};
const sourceIds = new Set(sources.map((item) => item.id));
const claimIds = new Set(claims.map((item) => item.id));
const requireSources = (ids, owner) => ids.forEach((id) => {
  if (!sourceIds.has(id)) fail(`${owner} references missing source ${id}`);
});

unique(sources, "sources");
unique(claims, "claims");
unique(origins, "origins");
unique(mapFeatures, "map features");

for (const claim of claims) {
  if (!claim.id || !claim.textZh || !claim.textEn) fail(`${claim.id || "unknown claim"} is incomplete`);
  if (!["史料记载", "合理重建", "叙事虚构"].includes(claim.classification)) fail(`${claim.id} has invalid classification`);
  if (claim.validFrom > claim.validTo) fail(`${claim.id} has inverted dates`);
  requireSources(claim.sourceIds, claim.id);
  if (claim.published && claim.classification !== "叙事虚构" && claim.sourceIds.length === 0) fail(`${claim.id} is published without a source`);
  if (claim.published && claim.classification === "叙事虚构" && claim.sourceIds.length > 0) fail(`${claim.id} fiction has source ids`);
}

for (const origin of origins) {
  if (!origin.published) fail(`${origin.id} is not published`);
  requireSources(origin.sourceIds, origin.id);
  origin.claimIds.forEach((id) => { if (!claimIds.has(id)) fail(`${origin.id} references missing claim ${id}`); });
}

for (const feature of mapFeatures) {
  if (!feature.published) fail(`${feature.id} is not published`);
  if (feature.validFrom > 742 || feature.validTo < 742) fail(`${feature.id} is not active in 742`);
  requireSources(feature.sourceIds, feature.id);
  if (!feature.uncertaintyCode || !feature.uncertaintyNoteZh) fail(`${feature.id} is missing uncertainty metadata`);
  if (!feature.licenseCode || !feature.attribution) fail(`${feature.id} is missing license attribution`);
}

const blocked = new Set(["S-011", "S-012"]);
for (const claim of claims) {
  if (claim.sourceIds.some((id) => blocked.has(id))) fail(`${claim.id} imports a blocked commercial source`);
}

console.log(JSON.stringify({
  scenario: "tang-changan-742",
  year: 742,
  sources: sources.length,
  claims: claims.length,
  origins: origins.length,
  mapFeatures: mapFeatures.length,
  publishedClaims: claims.filter((claim) => claim.published).length,
  sourcedPublishedClaims: claims.filter((claim) => claim.published && claim.classification !== "叙事虚构" && claim.sourceIds.length > 0).length,
  fictionClaims: claims.filter((claim) => claim.classification === "叙事虚构").length,
  blockedSourcesReferenced: 0,
  status: "passed",
}, null, 2));
