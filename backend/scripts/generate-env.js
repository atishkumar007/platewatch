import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const key = randomBytes(32).toString("hex"),
  secret = randomBytes(48).toString("hex");
const targets = [
  ["backend/.env", "backend/.env.example"],
  ["ai-service/.env", "ai-service/.env.example"],
];
// Refuse partial regeneration: changing one service key alone breaks communication.
for (const [target] of targets) {
  try {
    await readFile(path.join(root, target));
    throw Error(
      target +
        " already exists. Edit your existing configuration; no files changed.",
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
for (const [target, source] of targets) {
  const text = (await readFile(path.join(root, source), "utf8"))
    .replace("REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS", secret)
    .replace("REPLACE_WITH_THE_SAME_RANDOM_KEY_AS_AI_SERVICE", key)
    .replace("REPLACE_WITH_THE_SAME_RANDOM_KEY_AS_BACKEND", key);
  await writeFile(path.join(root, target), text, { flag: "wx", mode: 0o600 });
}
console.log(
  "Created backend/.env and ai-service/.env with matching random service keys. Edit MongoDB settings and admin credentials before seeding. Secrets were not printed.",
);
