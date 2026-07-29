import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const assignmentNames = [
  "DEEPSEEK_API_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_TEST_SECRET_KEY",
  "TWILIO_AUTH_TOKEN",
  "TURNSTILE_SECRET",
  "PHONE_AUTH_AUDIT_SALT",
  "SECURITY_AUDIT_SALT",
];
const patterns = [
  {
    label: "Supabase secret key",
    regex: /\bsb_secret_[A-Za-z0-9._-]{12,}/g,
  },
  {
    label: "sensitive environment assignment",
    regex: new RegExp(
      `^(?:${assignmentNames.join("|")})[ \\t]*=[ \\t]*[^\\s#'"][^\\r\\n]*$`,
      "gm",
    ),
  },
  {
    label: "secret exposed with NEXT_PUBLIC_",
    regex: /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|AUTH_TOKEN|PRIVATE_KEY)\b/g,
  },
];

const findings = [];
for (const file of files) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;
  for (const { label, regex } of patterns) {
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${file}:${line} ${label}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Tracked secret scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Tracked secret scan passed (${files.length} files).`);
}
