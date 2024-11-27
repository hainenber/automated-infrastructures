import { statSync } from "fs";
import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

export const VERSION_LIMIT = 3;
export const PROJECT_NAME = "auto-infra";
export const SONATYPE_BASE_URL = "http://localhost:8081";

export const configureLogger = async (PROJECT_NAME, SERVICE) => {
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

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const generateLogFilenameWithTimestamp = (service) => {
  const currentDate = new Date();
  return `${service}-${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDay()}.log`;
};

// File utils
export const fileExists = (path) => statSync(path, { throwIfNoEntry: false });
export const folderExists = (path) =>
  statSync(path, { throwIfNoEntry: false }).isDirectory();
