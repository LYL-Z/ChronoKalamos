import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import net from "node:net"
import path from "node:path"

const root = process.cwd()
const serverEntry = path.join(root, "dist", "server", "index.js")
const vinextCli = path.join(root, "node_modules", "vinext", "dist", "cli.js")

if (!existsSync(serverEntry)) {
  throw new Error("Production build missing. Run `npm run build` before this smoke test.")
}

const port = await reservePort()
const child = spawn(
  process.execPath,
  [vinextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
)

let stdout = ""
let stderr = ""

child.stdout.setEncoding("utf8")
child.stderr.setEncoding("utf8")
child.stdout.on("data", (chunk) => {
  stdout += chunk
})
child.stderr.on("data", (chunk) => {
  stderr += chunk
})

try {
  const rootResponse = await fetchUntilReady(`http://127.0.0.1:${port}/`)
  const html = await rootResponse.text()
  const assets = [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)].map(
    (match) => match[1],
  )

  if (assets.length === 0) {
    throw new Error("Production HTML did not reference any built assets.")
  }

  for (const asset of new Set(assets)) {
    const response = await fetch(`http://127.0.0.1:${port}${asset}`)

    if (!response.ok) {
      throw new Error(`Production asset ${asset} returned HTTP ${response.status}.`)
    }
  }

  console.log(
    `[production-smoke] HTML and ${new Set(assets).size} referenced assets returned 200.`,
  )
} catch (error) {
  throw new Error(
    `${error instanceof Error ? error.message : String(error)}\n${stdout}\n${stderr}`,
  )
} finally {
  child.kill()
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ])
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()

      if (!address || typeof address === "string") {
        server.close()
        reject(new Error("Unable to reserve an IPv4 port."))
        return
      }

      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(address.port)
      })
    })
  })
}

async function fetchUntilReady(url) {
  const deadline = Date.now() + 15_000
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)

      if (response.ok) {
        return response
      }

      lastError = new Error(`Production root returned HTTP ${response.status}.`)
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  throw lastError ?? new Error("Production server did not become ready.")
}
