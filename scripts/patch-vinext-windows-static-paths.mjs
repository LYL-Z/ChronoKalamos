import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const vinextRoot = path.join(process.cwd(), "node_modules", "vinext")
const cacheModulePath = path.join(
  vinextRoot,
  "dist",
  "server",
  "static-file-cache.js",
)

const windowsRelativePath =
  'relativePath: path.relative(base, batch[j]),'
const portableRelativePath =
  'relativePath: path.relative(base, batch[j]).split(path.sep).join("/"),'

const source = await readFile(cacheModulePath, "utf8")

if (source.includes(portableRelativePath)) {
  console.log("[postinstall] vinext static paths are already portable.")
  process.exit(0)
}

if (!source.includes(windowsRelativePath)) {
  throw new Error(
    "vinext static-file-cache.js changed. Review whether the Windows asset-path patch is still required before installing.",
  )
}

await writeFile(
  cacheModulePath,
  source.replace(windowsRelativePath, portableRelativePath),
  "utf8",
)

console.log(
  "[postinstall] Patched vinext Windows static asset paths to use URL separators.",
)
