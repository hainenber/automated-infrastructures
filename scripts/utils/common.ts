import { statSync } from "node:fs";
import { configure, getConsoleSink, getLogger, Logger } from "@logtape/logtape";
import { execa } from "execa";
import { head, isNil } from "es-toolkit";

export const VERSION_LIMIT = 3;
export const PROJECT_NAME = "auto-infra";
export const SONATYPE_BASE_URL = "http://localhost:8081";

export const configureLogger = async (
  PROJECT_NAME: string,
  SERVICE: string,
): Promise<Logger> => {
  await configure({
    sinks: { console: getConsoleSink() },
    loggers: [{
      category: PROJECT_NAME,
      lowestLevel: "debug",
      sinks: ["console"],
    }],
  });
  return getLogger([PROJECT_NAME, SERVICE]);
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const generateLogFilenameWithTimestamp = (service: string): string => {
  const currentDate = new Date();
  return `${service}-${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDay()}.log`;
};

// File utils
export const fileExists = (path: string): boolean =>
  Boolean(statSync(path, { throwIfNoEntry: false }));
export const folderExists = (path: string): boolean =>
  Boolean(statSync(path, { throwIfNoEntry: false })?.isDirectory());

/**
 * Util function that verify if Java installation complies with required version, given as input.
 * @param logger
 * @param minimalVersion
 */
export const requireJava = async (
  logger: Logger,
  minimalVersion: number,
): Promise<void> => {
  const { stdout: javaVersionData, exitCode } = await execa({
    stderr: "ignore",
    reject: false,
    lines: true,
  })`java --version`;
  if (isNil(process.env.JAVA_HOME) || exitCode !== 0) {
    logger.fatal(
      "Current machine does not have Java installation to proceed further",
    );
    process.exit(1);
  } else {
    const javaVersion = head(javaVersionData)?.split(/\s+/).at(1);
    const javaVersionComponents = javaVersion?.split(".");
    const javaMajorVersion = head(javaVersionComponents ?? []) === "1"
      ? javaVersionComponents?.at(1)
      : head(javaVersionComponents ?? []);
    if (parseInt(javaMajorVersion ?? "8", 10) < minimalVersion) {
      logger.fatal(
        `Current machine has Java version that is less than required 17 (version: ${javaMajorVersion})`,
      );
      process.exit(1);
    }
  }
};

export interface CommandData {
  name: string;
  exists: boolean;
}

/**
 * Utility function to check if a command is invoke-able in CLI.
 * @param {string[]} commands - An array of commands
 * @returns {Promise<CommandData[]>} - Promisified data about command
 */
export const hasCommands = async (
  commands: string[],
): Promise<CommandData[]> => {
  return Promise.all(commands.map(async (cmd) => {
    const checkIfCommandExists = await execa({
      reject: false,
    })`command -v ${cmd}`;
    return {
      name: cmd,
      exists: !(checkIfCommandExists.failed),
    };
  }));
};
