import { readFile } from "node:fs/promises";
import path from "node:path";

const ownerDirectory = path.resolve(process.argv[2] ?? "../home-stack/schemas/portal");
const consumerDirectory = path.resolve("schemas");
const schemas = ["catalog.v1.schema.json", "status.v1.schema.json"];

for (const schema of schemas) {
  const [owner, consumer] = await Promise.all([
    readFile(path.join(ownerDirectory, schema), "utf8"),
    readFile(path.join(consumerDirectory, schema), "utf8")
  ]);
  if (owner !== consumer) {
    throw new Error(`${schema} differs from the canonical Home Stack copy at ${ownerDirectory}`);
  }
}

console.log(`PASS schema sync: Portal mirrors ${ownerDirectory}`);
