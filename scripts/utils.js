import Mustache from "mustache";
import { readFileSync, statSync } from "fs";
import { join as pathJoin } from "path";
import { cwd } from "process";
import { fromPairs } from "es-toolkit/compat";

export const VERSION_LIMIT = 3;
export const PROJECT_NAME = "auto-infra";

export const configureLogger = async (PROJECT_NAME, SERVICE) => {
  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [{ category: PROJECT_NAME, level: "debug", sinks: ["console"] }],
  });
  return getLogger([PROJECT_NAME, SERVICE]);
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const generateLogFilenameWithTimestamp = (service) => {
  const currentDate = new Date();
  return `${service}-${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDay()}.log`;
};

// File utils
export const fileExists = (path) => statSync(path, { throwIfNoEntry: false });
export const folderExists = (path) => statSync(path, { throwIfNoEntry: false }).isDirectory();

export const getArtifactVersionData = (service) => {
  const artifactVersionFolderPath = cwd();
  try {
    // Read the .version.json file and extract the version.
    const artifactVersionFilePath = pathJoin(artifactVersionFolderPath, service, "versions", `${service}.version.json`);
    const artifactVersionDataString = readFileSync(artifactVersionFilePath);
    const rawArtifactVersionData = JSON.parse(artifactVersionDataString);
    const ARTIFACT_VERSION = rawArtifactVersionData["version"];

    if (ARTIFACT_VERSION === null) {
      return { versionData: null, error: new Error(`No artifact version for ${version}`) };
    }

    // Populate template strings for each keys in .version.json
    const versionDataKey = { artifact_name: null, download_url: null };
    const versionData = fromPairs(
      Object.entries(versionDataKey).map(([key]) => {
        const rendered = Mustache.render(rawArtifactVersionData[key], { ARTIFACT_VERSION });
        return [key, rendered];
      }),
    );

    versionData["version"] = ARTIFACT_VERSION;

    return {
      versionData: versionData,
      error: null,
    };
  } catch (e) {
    return { versionData: null, error: e };
  }
};
