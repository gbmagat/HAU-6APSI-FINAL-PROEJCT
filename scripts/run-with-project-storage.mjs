import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tempDirectory = join(projectRoot, ".project-tmp");
const npmCacheDirectory = join(projectRoot, ".npm-cache");
const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("A command is required.");
  process.exit(1);
}

mkdirSync(tempDirectory, { recursive: true });
mkdirSync(npmCacheDirectory, { recursive: true });

const packageNames = {
  eslint: "eslint",
  next: "next",
  tsc: "typescript",
  vitest: "vitest",
};
const packageName = packageNames[command];

if (!packageName) {
  console.error(`Unsupported project command: ${command}`);
  process.exit(1);
}

const packageJsonPath = join(
  projectRoot,
  "node_modules",
  packageName,
  "package.json",
);
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const binaryEntry =
  typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin?.[command];

if (!binaryEntry) {
  console.error(`Could not resolve the ${command} executable.`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [join(dirname(packageJsonPath), binaryEntry), ...args],
  {
  cwd: projectRoot,
  env: {
    ...process.env,
    NPM_CONFIG_CACHE: npmCacheDirectory,
    TEMP: tempDirectory,
    TMP: tempDirectory,
    TMPDIR: tempDirectory,
  },
  stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
