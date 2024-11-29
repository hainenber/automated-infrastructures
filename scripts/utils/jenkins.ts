import Mustache from "mustache";
import { readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { cwd } from "node:process";
import { fromPairs } from "es-toolkit/compat";

interface ArtifactVersionSchema {
  artifact_name: string;
  download_url: string;
  version: string;
}
interface ArtifactVersionData {
  versionData: ArtifactVersionSchema | null;
  error: Error | null;
}

export const getArtifactVersionData = (
  service: string,
): ArtifactVersionData => {
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
    const rawArtifactVersionData = JSON.parse(
      artifactVersionDataString.toString(),
    ) as ArtifactVersionSchema;
    const ARTIFACT_VERSION = rawArtifactVersionData.version;

    if (ARTIFACT_VERSION === null) {
      return {
        versionData: null,
        error: new Error(`No artifact version for ${service}`),
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
    ) as ArtifactVersionSchema;

    versionData.version = ARTIFACT_VERSION;

    return {
      versionData: versionData,
      error: null,
    };
  } catch (e) {
    return { versionData: null, error: e };
  }
};
