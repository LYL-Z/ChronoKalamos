import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";

const artifactArg = process.argv[2];
const expectedSha256 = process.argv[3]?.trim().toLowerCase();

if (!artifactArg) {
  throw new Error(
    "usage: npm run review:verify:phase11 -- <signed.pdf|signed.png|signed.jpg> [expected-sha256]",
  );
}

const artifactPath = resolve(artifactArg);
const extension = extname(artifactPath).toLowerCase();
if (![".pdf", ".png", ".jpg", ".jpeg"].includes(extension)) {
  throw new Error("phase11_review_artifact_must_be_pdf_png_or_jpeg");
}

const metadata = await stat(artifactPath);
if (!metadata.isFile()) throw new Error("phase11_review_artifact_is_not_a_file");
if (metadata.size < 1024) throw new Error("phase11_review_artifact_is_too_small");
if (metadata.size > 20 * 1024 * 1024) throw new Error("phase11_review_artifact_exceeds_20mb");

const bytes = await readFile(artifactPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");

if (expectedSha256 && expectedSha256 !== sha256) {
  throw new Error("phase11_review_artifact_sha256_mismatch");
}

console.log(JSON.stringify({
  evidenceVerifiedAsFile: true,
  artifactPath,
  extension,
  bytes: metadata.size,
  sha256,
  warning:
    "This verifies file integrity only. It does not authenticate the signer or prove institutional approval.",
}, null, 2));
