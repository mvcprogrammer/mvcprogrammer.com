// mvcprogrammer.com — tools/fhir-seed.mjs
// Posts api/seed/fhir-programmer.json, a transaction Bundle for the fictional patient the FHIR API
// card searches for first, to a FHIR R4 server. The public HAPI sandbox is wiped now and then; run
// this to put him back. Every entry is a PUT with its own id, so re-running is idempotent.
//   node tools/fhir-seed.mjs                              # https://hapi.fhir.org/baseR4
//   node tools/fhir-seed.mjs https://r4.smarthealthit.org  # another server
import { readFile } from "node:fs/promises";
const base = (process.argv[2] ?? "https://hapi.fhir.org/baseR4").replace(/\/$/, "");
const bundle = await readFile(new URL("../api/seed/fhir-programmer.json", import.meta.url), "utf8");
const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/fhir+json", Accept: "application/fhir+json" }, body: bundle });
const body = await response.json();
console.log(`${response.status} from ${base}`);
for (const entry of body.entry ?? []) console.log(`  ${entry.response?.status ?? "?"}  ${entry.response?.location ?? ""}`);
if (!response.ok) { console.error(JSON.stringify(body, null, 2)); process.exit(1); }
