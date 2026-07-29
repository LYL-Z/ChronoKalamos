const required = [
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_PUBLISHABLE_KEY",
  "SUPABASE_TEST_SECRET_KEY",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing required live-test secrets: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Required live Supabase test configuration is present.");
}
