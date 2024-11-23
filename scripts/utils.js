import Mustache from "mustache";
import { readFileSync, statSync } from "fs";
import { join as pathJoin } from "path";
import { cwd } from "process";
import { fromPairs } from "es-toolkit/compat";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { isEqual } from "es-toolkit";

export const VERSION_LIMIT = 3;
export const PROJECT_NAME = "auto-infra";
const SONATYPE_BASE_URL = "http://localhost:8081";

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

// Check if local Sonatype Nexus server is up and running.
export const healthcheckSonatypeNexus = async (logger) => {
  const read_healthcheck_url = `${SONATYPE_BASE_URL}/service/rest/v1/status`;

  const retryLimit = 20;
  let retryCount = 0;
  let sonatypeIsAvailable = false;

  while (!sonatypeIsAvailable || retryCount <= retryLimit) {
    try {
      const response = await fetch(read_healthcheck_url, {
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        sonatypeIsAvailable = true;
        break;
      }
    } catch (err) {
      if (err.code === "ECONNREFUSED") {
        logger.info(
          `[${retryCount}/${retryLimit} retries] Sonatype Nexus is not yet available. Retrying healthcheck after 1 second...`,
        );
        retryCount += 1;
        sleep(1000);
      }
    }
  }

  if (retryCount > retryLimit) {
    logger.fatal("Sonatype Nexus is not up and running even after 20 seconds. Exit now...");
    return false;
  } else if (sonatypeIsAvailable) {
    logger.info("Sonatype Nexus is now up and running. Proceeding...");
  }

  return true;
};

export const configureSonatypeNexus = async (logger) => {
  const proxiesToBeMade = [
    {
      name: "jenkins-public",
      format: "maven2",
      type: "proxy",
      url: `${SONATYPE_BASE_URL}/repository/jenkins-public`,
      attributes: {
        proxy: {
          remoteUrl: "https://repo.jenkins-ci.org/public/",
        },
      },
    },
    {
      name: "npm-proxy",
      format: "npm",
      type: "proxy",
      url: `${SONATYPE_BASE_URL}/repository/npm-proxy`,
      attributes: {
        proxy: {
          remoteUrl: "https://registry.npmjs.org/",
        },
      },
    },
    {
      name: "apt-proxy",
      format: "apt",
      type: "proxy",
      url: `${SONATYPE_BASE_URL}/repository/apt-proxy`,
      attributes: {
        proxy: {
          remoteUrl: "http://ports.ubuntu.com/ubuntu-ports",
        },
      },
    },
  ];

  // Create proxies if not exists
  const existingProxies = await (
    await fetch(`${SONATYPE_BASE_URL}/service/rest/v1/repositories`, {
      headers: {
        Authorization: `Basic ${btoa("admin:abc")}`,
      },
    })
  ).json();
  for (const existingProxy of existingProxies) {
    if (proxiesToBeMade.some((p) => isEqual(p, existingProxy))) {
      logger.info(`Sonatype Nexus has repository ${existingProxy.name} at URL ${existingProxy.url}. Skip creation`);
    }
  }

  // TODO: enable them online afterwards if they are offline.
};
