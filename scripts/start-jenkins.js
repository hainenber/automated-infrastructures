import { execa } from "execa";
import { join as pathJoin } from "path";
import { writeFile } from "fs/promises";
import { cpSync, mkdirSync, readdirSync } from "fs";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { drop, head, isNil, isNotNil } from "es-toolkit";
import { cwd } from "process";
import {
  fileExists,
  folderExists,
  generateLogFilenameWithTimestamp,
  getArtifactVersionData,
  PROJECT_NAME,
  VERSION_LIMIT,
} from "./utils.js";
import { Readable } from "stream";
import { globSync } from "glob";
import { rimrafSync } from "rimraf";

// Constants
const SERVICE = "jenkins";
const JENKINS_MINIMAL_JAVA_VERSION = 17;

const ROOT_DIR = cwd();
const jenkinsProjectPath = pathJoin(ROOT_DIR, SERVICE);

(async () => {
  // Configure logger.
  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [{ category: PROJECT_NAME, level: "debug", sinks: ["console"] }],
  });
  const logger = getLogger([PROJECT_NAME, SERVICE]);

  // Check if Jenkins-related resource version file is present
  const { error, versionData } = getArtifactVersionData(SERVICE);
  if (isNotNil(error) || isNil(versionData)) {
    logger.fatal(`Root directory does not have ${SERVICE}.version.json to select approriate version`);
    process.exit(1);
  }

  // Download Jenkins-related binaries if not found in $ROOT_DIR/jenkins
  const { download_url, artifact_name, version } = versionData;
  const artifactPath = pathJoin(jenkinsProjectPath, artifact_name);
  if (!fileExists(artifactPath)) {
    logger.info(`Not found ${SERVICE}-${version}. Downloading ${artifact_name} from ${download_url}`);
    const response = await fetch(download_url);
    if (!response.ok) {
      logger.fatal(`Failed to fetch ${artifact_name}: ${response.statusText}`);
    }
    const stream = Readable.fromWeb(response.body);
    await writeFile(artifactPath, stream);
  } else {
    logger.info(`${artifact_name} exists. Skip download`);
  }

  // Check if existing Jenkins-related binaries count have reaching limit or not (3).
  const existingJenkinsBinariesCount = globSync(pathJoin(jenkinsProjectPath, `${SERVICE}-*.war`));
  if (existingJenkinsBinariesCount.length > VERSION_LIMIT) {
    logger.warn(
      `Found multiple ${SERVICE} binaries. System will keep the last ${VERSION_LIMIT} and delete the remaining.`,
    );
    for (const removingJenkinsBinaryPath of drop(existingJenkinsBinariesCount, VERSION_LIMIT - 1)) {
      logger.info(`Deleting ${removingJenkinsBinaryPath}`);
      rimrafSync(removingJenkinsBinaryPath);
      logger.info(`Deleted ${removingJenkinsBinaryPath}`);
    }
  }

  // Check if Java installation is available.
  // If present, check if Java installation is Java17 or else.
  // Beginning with the Jenkins 2.463 weekly release (scheduled for release on June 18, 2024), Jenkins requires Java 17 or newer
  // Source: https://www.jenkins.io/blog/2024/06/11/require-java-17/
  const { stdout: javaVersionData, exitCode } = await execa({
    stderr: "ignore",
    reject: false,
    lines: true,
  })`java --version`;
  if (isNil(process.env.JAVA_HOME) || exitCode !== 0) {
    logger.fatal("Current machine does not have Java installation to proceed further");
    process.exit(1);
  } else {
    const javaVersion = head(javaVersionData).split(/\s+/).at(1);
    const javaVersionComponents = javaVersion.split(".");
    const javaMajorVersion =
      head(javaVersionComponents) === "1" ? javaVersionComponents.at(1) : head(javaVersionComponents);
    if (parseInt(javaMajorVersion, 10) < JENKINS_MINIMAL_JAVA_VERSION) {
      logger.fatal(`Current machine has Java version that is less than required 17 (version: ${javaMajorVersion})`);
      process.exit(1);
    }
  }

  // Create directory for Jenkins logs and plugins
  for (const jenkinsDir of [
    "logs",
    "data",
    pathJoin("data", "plugins"),
    pathJoin("data", "init.groovy.d"),
    pathJoin("data", "secrets"),
  ]) {
    const dirToBeCreated = pathJoin(jenkinsProjectPath, jenkinsDir);
    mkdirSync(dirToBeCreated, { recursive: true });
  }

  // Prepare the plugins with jenkins-plugin-manager.
  // The commmand times out after 1 minute.
  const jenkinsPluginConfigPath = pathJoin(jenkinsProjectPath, "configs", "plugins.yaml");
  if (fileExists(pathJoin(jenkinsPluginConfigPath))) {
    logger.info("Handling plugins via manager.");
    const jenkinsPluginManager = head(globSync(pathJoin(jenkinsProjectPath, "jenkins-plugin-manager-*.jar")));
    const jenkinsBinary = head(globSync(pathJoin(jenkinsProjectPath, "jenkins-*.war")));
    await execa({
      timeout: 60000,
      stdout: ["inherit"],
      stderr: ["inherit"],
    })`java -jar ${jenkinsPluginManager} --war ${jenkinsBinary} --verbose --plugin-download-directory ${pathJoin(jenkinsProjectPath, "data", "plugins")} --plugin-file ${jenkinsPluginConfigPath}`;
  } else {
    logger.warn("Configuration file for Jenkins plugins are not found. Handle plugins manually.");
  }

  // Configure Groovy init hook scripts
  const backupInitHookScriptDir = pathJoin(jenkinsProjectPath, "hook-scripts", "init");
  const configuredInitHookScriptDir = pathJoin(jenkinsProjectPath, "data", "init.groovy.d");
  if (folderExists(backupInitHookScriptDir)) {
    if (readdirSync(configuredInitHookScriptDir).length > 0) {
      logger.info(`Deleting all files in ${configuredInitHookScriptDir}`);
      rimrafSync(`${configuredInitHookScriptDir}/*`);
      logger.info(`Deleted all files in ${configuredInitHookScriptDir}`);
    }
    cpSync(backupInitHookScriptDir, configuredInitHookScriptDir, { recursive: true });
  }

  // Copy local secrets to $JENKINS_HOME for configuration by JCasC
  const localSecretPath = pathJoin(jenkinsProjectPath, "secrets");
  const configuredSecretPath = pathJoin(jenkinsProjectPath, "data", "secrets");
  logger.info(`Copying local secrets in ${localSecretPath} to ${configuredSecretPath}`);
  cpSync(pathJoin(jenkinsProjectPath, "secrets"), pathJoin(jenkinsProjectPath, "data", "secrets"), { recursive: true });
  logger.info(`Copied local secrets in ${localSecretPath} to ${configuredSecretPath}`);

  // Start Jenkins
  const jenkinsBinary = pathJoin(jenkinsProjectPath, artifact_name);
  const jenkinsLogFilename = generateLogFilenameWithTimestamp(SERVICE);
  logger.info(`Running ${SERVICE}`);
  await execa({
    cwd: jenkinsProjectPath,
    env: {
      JENKINS_HOME: pathJoin(jenkinsProjectPath, "data"),
      CASC_JENKINS_CONFIG: pathJoin(jenkinsProjectPath, "configs", "jcasc.yaml"),
    },
    stdout: ["inherit", { file: pathJoin(jenkinsProjectPath, "logs", jenkinsLogFilename) }],
    stderr: ["inherit", { file: pathJoin(jenkinsProjectPath, "logs", jenkinsLogFilename) }],
  })`java -jar ${jenkinsBinary}`;
})();
