import "dotenv/config";
import { cloneDeep, isEqual } from "es-toolkit";
import { unset } from "es-toolkit/compat";
import { sleep, SONATYPE_BASE_URL } from "./common.ts";
import { Logger } from "@logtape/logtape";

interface SonatypeNexusRepoResponse {
  online: boolean;
}

// Check if local Sonatype Nexus server is up and running.
export const healthcheckSonatypeNexus = async (logger) => {
  const read_healthcheck_url = `${SONATYPE_BASE_URL}/service/rest/v1/status`;

  const retryLimit = 30;
  let retryCount = 0;
  let sonatypeIsAvailable = false;

  while (retryCount <= retryLimit) {
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
        await sleep(1000);
      }
    }
  }

  if (retryCount > retryLimit) {
    logger.fatal(
      "Sonatype Nexus is not up and running even after 20 seconds. Exit now...",
    );
    return false;
  } else if (sonatypeIsAvailable) {
    logger.info("Sonatype Nexus is now up and running. Proceeding...");
  }

  return true;
};

const getRepoAPIMapping = (repoType: string): string => {
  if (String(repoType).includes("maven")) {
    return "maven";
  }
  return repoType;
};

// Configuration
export const configureSonatypeNexus = async (logger: Logger): Promise<void> => {
  const proxiesToBeMade = [
    {
      name: "jenkins-public",
      url: `${SONATYPE_BASE_URL}/repository/jenkins-public`,
      online: true,
      storage: {
        blobStoreName: "default",
        strictContentTypeValidation: true,
        writePolicy: "ALLOW",
      },
      cleanup: null,
      proxy: {
        remoteUrl: "https://repo.jenkins-ci.org/public/",
        contentMaxAge: -1,
        metadataMaxAge: 1440,
      },
      negativeCache: {
        enabled: true,
        timeToLive: 1440,
      },
      httpClient: {
        blocked: false,
        autoBlock: true,
        connection: {
          retries: null,
          userAgentSuffix: null,
          timeout: null,
          enableCircularRedirects: false,
          enableCookies: false,
          useTrustStore: false,
        },
        authentication: null,
      },
      routingRuleName: null,
      maven: {
        versionPolicy: "RELEASE",
        layoutPolicy: "STRICT",
        contentDisposition: "INLINE",
      },
      format: "maven2",
      type: "proxy",
    },
    {
      name: "npm-proxy",
      url: `${SONATYPE_BASE_URL}/repository/npm-proxy`,
      online: true,
      storage: {
        blobStoreName: "default",
        strictContentTypeValidation: true,
        writePolicy: "ALLOW",
      },
      cleanup: null,
      proxy: {
        remoteUrl: "https://registry.npmjs.org/",
        contentMaxAge: -1,
        metadataMaxAge: 1440,
      },
      negativeCache: {
        enabled: true,
        timeToLive: 1440,
      },
      httpClient: {
        blocked: false,
        autoBlock: true,
        connection: {
          retries: null,
          userAgentSuffix: null,
          timeout: null,
          enableCircularRedirects: false,
          enableCookies: false,
          useTrustStore: false,
        },
        authentication: null,
      },
      routingRuleName: null,
      npm: {
        removeQuarantined: false,
      },
      format: "npm",
      type: "proxy",
    },
    {
      name: "apt-proxy",
      url: `${SONATYPE_BASE_URL}/repository/apt-proxy`,
      online: true,
      storage: {
        blobStoreName: "default",
        strictContentTypeValidation: true,
        writePolicy: "ALLOW",
      },
      cleanup: null,
      apt: {
        distribution: "noble",
        flat: false,
      },
      proxy: {
        remoteUrl: "http://ports.ubuntu.com/ubuntu-ports",
        contentMaxAge: 1440,
        metadataMaxAge: 1440,
      },
      negativeCache: {
        enabled: true,
        timeToLive: 1440,
      },
      httpClient: {
        blocked: false,
        autoBlock: false,
        connection: null,
        authentication: null,
      },
      routingRuleName: null,
      format: "apt",
      type: "proxy",
    },
  ];

  // Credentials
  const SONATYPE_ADMIN_USERNAME = process.env.SONATYPE_ADMIN_USERNAME;
  const SONATYPE_ADMIN_PASSWORD = process.env.SONATYPE_ADMIN_PASSWORD;
  const authorizationHeader = {
    Authorization: `Basic ${
      btoa(`${SONATYPE_ADMIN_USERNAME}:${SONATYPE_ADMIN_PASSWORD}`)
    }`,
  };

  // Create proxies if not exists
  for (const proxyToBeMade of proxiesToBeMade) {
    const repoAPI = getRepoAPIMapping(proxyToBeMade.format);
    const existingProxyDataResponse = await fetch(
      `${SONATYPE_BASE_URL}/service/rest/v1/repositories/${proxyToBeMade.name}`,
      {
        headers: authorizationHeader,
      },
    );

    if (existingProxyDataResponse.ok) {
      const existingProxyData = await existingProxyDataResponse.json();

      // Remove "online" field when perform comparison as Nexus repository might not be ready.
      // Reinstation of online-ness for Nexus repository occurs later.
      const clonedExistingProxydata = cloneDeep(existingProxyData);
      const clonedProxyToBeMade = cloneDeep(clonedExistingProxydata);
      unset(clonedExistingProxydata, "online");
      unset(clonedProxyToBeMade, "online");

      if (isEqual(clonedExistingProxydata, clonedProxyToBeMade)) {
        logger.info(
          `Sonatype Nexus has repository ${proxyToBeMade.name} at URL ${proxyToBeMade.url}. Skip creation.`,
        );
      }
    } else if (existingProxyDataResponse.status === 404) {
      logger.info(
        `Sonatype Nexus does NOT have repository ${proxyToBeMade.name} at URL ${proxyToBeMade.url}. Creating ...`,
      );
      const createRepoResponse = await fetch(
        `${SONATYPE_BASE_URL}/service/rest/v1/repositories/${repoAPI}/${proxyToBeMade.type}`,
        {
          method: "POST",
          headers: {
            ...authorizationHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(proxyToBeMade),
        },
      );
      if (createRepoResponse.ok && createRepoResponse.status === 201) {
        logger.info(
          `Created ${proxyToBeMade.format} ${proxyToBeMade.type} repository "${proxyToBeMade.name}".`,
        );
      }
    }

    // Enable them online afterwards if they are offline.
    const proxyRepoData = await (
      await fetch(
        `${SONATYPE_BASE_URL}/service/rest/v1/repositories/${repoAPI}/${proxyToBeMade.type}/${proxyToBeMade.name}`,
        {
          headers: authorizationHeader,
        },
      )
    ).json() as SonatypeNexusRepoResponse;

    if (!Boolean(proxyRepoData.online)) {
      logger.info(
        `Proxy-type repository ${proxyToBeMade.name} is NOT online. Updating it to be online...`,
      );
      const proxyRepoDataUpdateToBeOnline = await fetch(
        `${SONATYPE_BASE_URL}/service/rest/v1/repositories/${repoAPI}/${proxyToBeMade.type}/${proxyToBeMade.name}`,
        {
          method: "PUT",
          headers: authorizationHeader,
          body: JSON.stringify({ ...proxyRepoData, online: true }),
        },
      );
      if (proxyRepoDataUpdateToBeOnline.status === 204) {
        logger.info(
          `Proxy-type repository ${proxyToBeMade.online} is updated to be online.`,
        );
      }
    } else {
      logger.info(
        `Proxy-type repository ${proxyToBeMade.online} is online. Skip updating...`,
      );
    }
  }
};
