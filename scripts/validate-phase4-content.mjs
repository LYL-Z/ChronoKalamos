import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const contentUrl = (name) => new URL(`content/tang-changan-742/${name}.json`, root);
const [sources, claims, origins, mapFeatures, chapters, events, npcs, items, risks, publicationGate] = await Promise.all([
  readFile(contentUrl("sources"), "utf8").then(JSON.parse),
  readFile(contentUrl("claims"), "utf8").then(JSON.parse),
  readFile(contentUrl("origins"), "utf8").then(JSON.parse),
  readFile(contentUrl("map-features"), "utf8").then(JSON.parse),
  readFile(contentUrl("chapters"), "utf8").then(JSON.parse),
  readFile(contentUrl("events"), "utf8").then(JSON.parse),
  readFile(contentUrl("npcs"), "utf8").then(JSON.parse),
  readFile(contentUrl("items"), "utf8").then(JSON.parse),
  readFile(contentUrl("risks"), "utf8").then(JSON.parse),
  readFile(contentUrl("publication-gate"), "utf8").then(JSON.parse),
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
unique(chapters, "chapters");
unique(events.map((event) => ({ id: event.eventId })), "events");
unique(npcs, "NPCs");
unique(items, "items");
unique(risks, "risks");

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
  if (!feature.published && feature.publicationStatus !== "provisional") {
    fail(`${feature.id} is neither published nor a provisional candidate`);
  }
  if (feature.validFrom > 742 || feature.validTo < 742) fail(`${feature.id} is not active in 742`);
  requireSources(feature.sourceIds, feature.id);
  if (!feature.uncertaintyCode || !feature.uncertaintyNoteZh) fail(`${feature.id} is missing uncertainty metadata`);
  if (!feature.licenseCode || !feature.attribution) fail(`${feature.id} is missing license attribution`);
}

const eventIds = new Set(events.map((event) => event.eventId));
const npcIds = new Set(npcs.map((npc) => npc.id));
const locationIds = new Set([
  "western-market",
  "jin-guang-gate",
  "jingzhao-fu",
  "craft-ward",
  "daming-palace",
  "ward-grid",
  "eastern-market",
  "mingde-gate",
  "imperial-city",
]);

if (publicationGate.reviewStatus !== "pending") fail("external review status must remain pending");
if (publicationGate.reviewers.length !== 0) fail("reviewers must be empty until a real signed review is recorded");
if (publicationGate.publicRuntimeEnabled) fail("phase 11 candidate must not be public-runtime enabled");
if (!publicationGate.externalReviewRequired) fail("external historical review gate is missing");

for (const npc of npcs) {
  if (npc.publicationStatus !== "provisional" || npc.classification !== "叙事虚构") {
    fail(`${npc.id} must remain provisional narrative fiction`);
  }
  npc.claimIds.forEach((id) => { if (!claimIds.has(id)) fail(`${npc.id} references missing claim ${id}`); });
  if (npc.sourceIds.length !== 0) fail(`${npc.id} must not masquerade as a sourced historical person`);
}

for (const item of items) {
  if (item.publicationStatus !== "provisional") fail(`${item.id} must remain provisional`);
  requireSources(item.sourceIds, item.id);
  item.claimIds.forEach((id) => { if (!claimIds.has(id)) fail(`${item.id} references missing claim ${id}`); });
}

for (const risk of risks) {
  if (risk.publicationStatus !== "provisional") fail(`${risk.id} must remain provisional`);
  requireSources(risk.sourceIds, risk.id);
  risk.claimIds.forEach((id) => { if (!claimIds.has(id)) fail(`${risk.id} references missing claim ${id}`); });
}

for (const event of events) {
  if (event.publicationStatus !== "provisional") fail(`${event.eventId} must remain provisional`);
  if (!locationIds.has(event.locationId)) fail(`${event.eventId} references missing evidence location ${event.locationId}`);
  if (event.choices.length !== 3) fail(`${event.eventId} must expose exactly three bounded choices`);
  requireSources(event.evidenceRefs, event.eventId);
  event.claimIds.forEach((id) => { if (!claimIds.has(id)) fail(`${event.eventId} references missing claim ${id}`); });
  event.npcIds.forEach((id) => { if (!npcIds.has(id)) fail(`${event.eventId} references missing NPC ${id}`); });
  const nextIds = new Set(event.choices.map((choice) => choice.nextEventId));
  if (nextIds.size !== 1) fail(`${event.eventId} choices diverge outside the editor-owned sequence`);
  const nextId = [...nextIds][0];
  if (event.phase === "ending" && nextId !== null) fail(`${event.eventId} ending does not terminate`);
  if (event.phase !== "ending" && !eventIds.has(nextId)) fail(`${event.eventId} references missing next event ${nextId}`);
}

for (const chapter of chapters) {
  if (chapter.publicationStatus !== "provisional") fail(`${chapter.id} must remain provisional`);
  if (chapter.eventIds.length !== 9) fail(`${chapter.id} must contain nine events`);
  if (chapter.npcIds.length < 4) fail(`${chapter.id} must contain at least four functional NPCs`);
  chapter.eventIds.forEach((id) => { if (!eventIds.has(id)) fail(`${chapter.id} references missing event ${id}`); });
  chapter.npcIds.forEach((id) => { if (!npcIds.has(id)) fail(`${chapter.id} references missing NPC ${id}`); });
  chapter.claimIds.forEach((id) => { if (!claimIds.has(id)) fail(`${chapter.id} references missing claim ${id}`); });
  const ordered = chapter.eventIds.map((id) => events.find((event) => event.eventId === id));
  if (ordered.some((event, index) => event.sequence !== index + 1 || event.chapterId !== chapter.id)) {
    fail(`${chapter.id} event order is invalid`);
  }
  if (ordered[0].phase !== "opening" || ordered.at(-1).phase !== "ending") {
    fail(`${chapter.id} lacks its opening or ending`);
  }
  if (ordered.filter((event) => event.phase === "consequence").length !== 2) {
    fail(`${chapter.id} must contain exactly two consequence events`);
  }
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
  chapters: chapters.length,
  events: events.length,
  choices: events.reduce((sum, event) => sum + event.choices.length, 0),
  npcs: npcs.length,
  items: items.length,
  risks: risks.length,
  publishedClaims: claims.filter((claim) => claim.published).length,
  provisionalClaims: claims.filter((claim) => claim.publicationStatus === "provisional").length,
  provisionalMapFeatures: mapFeatures.filter((feature) => feature.publicationStatus === "provisional").length,
  externalReviewStatus: publicationGate.reviewStatus,
  publicRuntimeEnabled: publicationGate.publicRuntimeEnabled,
  sourcedPublishedClaims: claims.filter((claim) => claim.published && claim.classification !== "叙事虚构" && claim.sourceIds.length > 0).length,
  fictionClaims: claims.filter((claim) => claim.classification === "叙事虚构").length,
  blockedSourcesReferenced: 0,
  status: "passed",
}, null, 2));
