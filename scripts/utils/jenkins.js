import Mustache from "mustache";
import { readFileSync } from "fs";
import { join as pathJoin } from "path";
import { cwd } from "process";
import { fromPairs } from "es-toolkit/compat";

export const getArtifactVersionData = (service) => {
  const artifactVersionFolderPath = cwd();
  try {
    // Read the .version.json file and extract the version.
    const artifactVersionFilePath = pathJoin(
      artifactVersionFolderPath,
      service,
      "versions",
      `${service}.version.json`,
    );
    const artifactVersionDataString = readFileSync(artifactVersionFilePath);
    const rawArtifactVersionData = JSON.parse(artifactVersionDataString);
    const ARTIFACT_VERSION = rawArtifactVersionData["version"];

    if (ARTIFACT_VERSION === null) {
      return {
        versionData: null,
        error: new Error(`No artifact version for ${version}`),
      };
    }

    // Populate template strings for each keys in .version.json
    const versionDataKey = { artifact_name: null, download_url: null };
    const versionData = fromPairs(
      Object.entries(versionDataKey).map(([key]) => {
        const rendered = Mustache.render(rawArtifactVersionData[key], {
          ARTIFACT_VERSION,
        });
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
