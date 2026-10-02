// Runs before `next build` (npm "prebuild"). Records when this build was made so the
// website and the admin can flash "Updated <date time>" the first time they load it.
import { writeFileSync } from "node:fs";

const builtAt = new Date().toISOString();
writeFileSync(new URL("../public/build-info.json", import.meta.url), JSON.stringify({ builtAt }) + "\n");
console.log("build stamp:", builtAt);
