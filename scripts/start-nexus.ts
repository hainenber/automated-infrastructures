import { execa, ExecaMethod } from "execa";
import { basename as pathBasename, join as pathJoin } from "node:path";
import { lstatSync, mkdirSync, readdirSync } from "node:fs";
import { head } from "es-toolkit";
import { homedir } from "node:os";
import { cwd } from "node:process";
import {
  configureLogger,
  configureSonatypeNexus,
  generateLogFilenameWithTimestamp,
  healthcheckSonatypeNexus,
  PROJECT_NAME,
  VERSION_LIMIT,
} from "./utils/index.js";
import { Logger } from "@logtape/logtape";

// Constants
const SERVICE = "nexus";
const NEXUS_COMPATIBLE_JAVA_MAJOR_VERSION = "17";

// Configure logger
const logger: Logger = await configureLogger(PROJECT_NAME, SERVICE);

// Find Nexus directory
const sonatypeFolderPath: string = pathJoin(cwd(), "sonatype");
const sonatypeBinaryPaths: string[] = readdirSync(sonatypeFolderPath)
  .map((fileName) => pathJoin(sonatypeFolderPath, fileName))
  .filter((fileName) =>
    lstatSync(fileName).isDirectory() && fileName.includes(`${SERVICE}-`)
  );

// Validating presence of Nexus binary path(s)
if (sonatypeBinaryPaths.length == 0) {
  logger.fatal("Not found any Nexus directory");
  process.exit(1);
} else if (sonatypeBinaryPaths.length > 3) {
  logger.warn(
    `Found multiple Nexus directory ${sonatypeBinaryPaths}. Please keep them to minimal ${VERSION_LIMIT}`,
  );
}

const sonatypeBinaryPath: string | undefined = head(sonatypeBinaryPaths);

// Find suitable JVM directory in $HOME/.sdk/candidates directory.
// Prequisites is that `sdkman` is installed and Java 17 has been installed previously.
const jvmCandidatesPath: string = pathJoin(
  homedir(),
  ".sdkman",
  "candidates",
  "java",
);
if (!lstatSync(jvmCandidatesPath)) {
  logger.fatal("Not found the path used by sdkman to install Java.");
  process.exit(1);
}
const jvmCandidates: string[] = readdirSync(jvmCandidatesPath)
  .map((fileName) => pathJoin(jvmCandidatesPath, fileName))
  .filter(
    (fileName) =>
      lstatSync(fileName).isDirectory() &&
      pathBasename(fileName).startsWith(NEXUS_COMPATIBLE_JAVA_MAJOR_VERSION),
  );

// Validating presence of suitable JVM
if (jvmCandidates.length == 0) {
  logger.fatal(
    `Not found any Java ${NEXUS_COMPATIBLE_JAVA_MAJOR_VERSION} candidate`,
  );
  process.exit(1);
}

// Creating directory for Nexus logs
const sonatypeLogPath: string = pathJoin(sonatypeFolderPath, "logs");
mkdirSync(sonatypeLogPath, { recursive: true });

const jvmCandidate: string | undefined = head(jvmCandidates);
const nexusLogFilename: string = generateLogFilenameWithTimestamp(SERVICE);

// Start Nexus
if (sonatypeBinaryPath && jvmCandidate) {
  const nexusProcess = execa({
    cwd: sonatypeBinaryPath,
    env: { INSTALL4J_JAVA_HOME: jvmCandidate },
    stdout: ["inherit", { file: pathJoin(sonatypeLogPath, nexusLogFilename) }],
  })`${sonatypeBinaryPath}/bin/nexus run`;

  // Check Sonatype health before configuring
  const sonatypeIsAvailable = await healthcheckSonatypeNexus(logger);
  if (sonatypeIsAvailable) {
    await configureSonatypeNexus(logger);
  }

  await nexusProcess;
} else {
  logger.fatal(
    `Sonatype Nexus cannot be started due to missing binary path (${sonatypeBinaryPath}) and/or missing JVM directory path (${jvmCandidate})`,
  );
}
