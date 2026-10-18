// Vite's own target setting leaves some dependency code (React DOM's ??=,
// ?.) untouched, and old Android WebViews (Fire tablets) fail to parse it,
// leaving a blank page. Re-run the built bundles through esbuild to lower
// them to syntax those WebViews understand.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";

const dir = "dist/assets";
for (const file of readdirSync(dir).filter((f) => f.endsWith(".js"))) {
  const path = join(dir, file);
  const { code } = transformSync(readFileSync(path, "utf8"), {
    target: "chrome64",
    format: "esm",
    minify: true,
  });
  writeFileSync(path, code);
  console.log(`lowered ${file}`);
}
