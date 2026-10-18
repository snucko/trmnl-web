// Tailwind v4 output relies on @layer, oklch() colors and other newer CSS.
// Old Android WebViews (Fire tablets) drop every rule inside an @layer block,
// so the page renders unstyled. Unwrap the layers (they're emitted in cascade
// order, so source order keeps the same precedence) and let Lightning CSS
// add fallbacks for colors and other newer syntax.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transform } from "lightningcss";

// Chrome 64, in Lightning CSS's (major << 16) version format.
const targets = { chrome: 64 << 16, safari: 12 << 16 };

function unwrapLayers(css) {
  // Drop layer-order statements like `@layer theme, base, components;`.
  css = css.replace(/@layer[^{};]*;/g, "");
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf("@layer", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    const open = css.indexOf("{", at);
    out += css.slice(i, at);
    // Find the matching close brace and keep only what's inside.
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    out += unwrapLayers(css.slice(open + 1, j - 1));
    i = j;
  }
  return out;
}

const dir = "dist/assets";
for (const file of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
  const path = join(dir, file);
  const { code } = transform({
    filename: file,
    code: Buffer.from(readFileSync(path, "utf8")),
    minify: true,
    targets,
  });
  writeFileSync(path, unwrapLayers(code.toString()));
  console.log(`lowered ${file}`);
}
