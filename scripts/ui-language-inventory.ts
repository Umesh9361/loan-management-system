import fs from "node:fs";
import path from "node:path";
import { localizeUiSource } from "./ui-localization";
const entries = new Map<string, string[]>();
function walk(directory: string) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|tsx)$/.test(file)) {
      localizeUiSource(fs.readFileSync(file, "utf8"), file, text => {
        const files = entries.get(text) || [];
        if (!files.includes(file)) files.push(file);
        entries.set(text, files);
      });
    }
  }
}
walk("client/src");
for (const file of ["shared/account-summary.ts", "shared/account-summary-format.ts"]) {
  localizeUiSource(fs.readFileSync(file, "utf8"), file, text => {
    const files = entries.get(text) || [];
    if (!files.includes(file)) files.push(file);
    entries.set(text, files);
  });
}
console.log(JSON.stringify([...entries].map(([text, files]) => ({ text, files })), null, 2));
