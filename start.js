import { execa } from "execa";
import path from "path";
import { lstatSync, mkdirSync, readdirSync } from "fs";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { head } from "es-toolkit";
import { homedir } from "os";
import { cwd } from "process";

// Constants
const VERSION_LIMIT = 3;
const NEXUS_COMPATIBLE_JAVA_MAJOR_VERSION = "17";

(async () => {
  // Configure logger
  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [{ category: "auto-infra", level: "debug", sinks: ["console"] }],
  });
  const logger = getLogger(["auto-infra"]);

  // Start Sonatype Nexus
  // Find Nexus directory
  const sonatypeFolderPath = path.join(cwd(), "sonatype");
  const sonatypeBinaryPaths = readdirSync(sonatypeFolderPath)
    .map((fileName) => path.join(sonatypeFolderPath, fileName))
    .filter((fileName) => lstatSync(fileName).isDirectory() && fileName.includes("nexus-"));

  // Validating presence of Nexus binary path(s)
  if (sonatypeBinaryPaths.length == 0) {
    logger.fatal("Not found any Nexus directory");
  } else if (sonatypeBinaryPaths.length > 3) {
    logger.warn(
      `Found more than 1 Nexus directory ${sonatypeBinaryPaths}. Please keep them to minimal ${VERSION_LIMIT}`,
    );
  }

  const sonatypeBinaryPath = head(sonatypeBinaryPaths);

  // Find suitable JVM directory in $HOME/.sdk/candidates directory.
  // Prequisites is that `sdkman` is installed and Java 17 has been installed previously.
  const jvmCandidatesPath = path.join(homedir(), ".sdkman", "candidates", "java");
  if (!lstatSync(jvmCandidatesPath)) {
    logger.fatal("Not found the path used by sdkman to install Java.");
  }
  const jvmCandidates = readdirSync(jvmCandidatesPath)
    .map((fileName) => path.join(jvmCandidatesPath, fileName))
    .filter(
      (fileName) =>
        lstatSync(fileName).isDirectory() && path.basename(fileName).startsWith(NEXUS_COMPATIBLE_JAVA_MAJOR_VERSION),
    );

  // Validating presence of suitable JVM
  if (jvmCandidates.length == 0) {
    logger.fatal(`Not found any Java ${NEXUS_COMPATIBLE_JAVA_MAJOR_VERSION} candidate`);
  }

  // Creating directory for Nexus logs
  const sonatypeLogPath = path.join(sonatypeFolderPath, "logs");
  mkdirSync(sonatypeLogPath, { recursive: true });

  // Start Nexus
  const jvmCandidate = head(jvmCandidates);
  await execa({ cwd: sonatypeBinaryPath, env: { INSTALL4J_HOME: jvmCandidate }, stdout: ['pipe', 'inherit'] })`${sonatypeBinaryPath}/bin/nexus run`;
})();
