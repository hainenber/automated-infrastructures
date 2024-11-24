import "dotenv/config";
import { isEqual } from "es-toolkit";
import { SONATYPE_BASE_URL } from "./common.js";

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

const getRepoAPIMapping = (repoType) => {
  if (String(repoType).includes("maven")) {
    return "maven";
  }
  return repoType;
};

// Configuration
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

  // Credentials
  const SONATYPE_ADMIN_USERNAME = process.env.SONATYPE_ADMIN_USERNAME;
  const SONATYPE_ADMIN_PASSWORD = process.env.SONATYPE_ADMIN_PASSWORD;
  const authorizationHeader = {
    Authorization: `Basic ${btoa(`${SONATYPE_ADMIN_USERNAME}:${SONATYPE_ADMIN_PASSWORD}`)}`,
  };

  // Create proxies if not exists
  const existingProxies = await (
    await fetch(`${SONATYPE_BASE_URL}/service/rest/v1/repositories`, {
      headers: authorizationHeader,
    })
  ).json();

  for (const proxyToBeMade of proxiesToBeMade) {
    if (existingProxies.some((p) => isEqual(p, proxyToBeMade))) {
      logger.info(`Sonatype Nexus has repository ${proxyToBeMade.name} at URL ${proxyToBeMade.url}. Skip creation.`);
    } else {
      logger.info(
        `Sonatype Nexus does NOT have repository ${proxyToBeMade.name} at URL ${proxyToBeMade.url}. Creating ...`,
      );
      // TODO
    }

    // Enable them online afterwards if they are offline.
    const repoAPI = getRepoAPIMapping(proxyToBeMade.format);
    const proxyRepoData = (
      await fetch(
        `${SONATYPE_BASE_URL}/service/rest/v1/repositories/${repoAPI}/${proxyToBeMade.type}/${proxyToBeMade.name}`,
        {
          headers: authorizationHeader,
        },
      )
    ).json();

    if (!Boolean(proxyRepoData.online)) {
      logger.info(`Proxy-type repository ${proxyToBeMade.name} is NOT online. Updating it to be online...`);
      const proxyRepoDataUpdateToBeOnline = await fetch(
        `${SONATYPE_BASE_URL}/service/rest/v1/repositories/${repoAPI}/${proxyToBeMade.type}/${proxyToBeMade.name}`,
        {
          method: "PUT",
          headers: authorizationHeader,
          body: JSON.stringify({ ...proxyRepoData, online: true }),
        },
      );
      if (proxyRepoDataUpdateToBeOnline.status === 204) {
        logger.info(`Proxy-type repository ${proxyToBeMade.online} is updated to be online.`);
      }
    } else {
      logger.info(`Proxy-type repository ${proxyToBeMade.online} is online. Skip updating...`);
    }
  }
};
