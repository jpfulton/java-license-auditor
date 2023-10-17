import {
  Dependency,
  DependencyOutputter,
  MetadataOutputter,
  removeDuplicates,
} from "@jpfulton/license-auditor-common";
import { existsSync } from "fs";
import {
  convertMavenDependenciesToLicenses,
  getRootProjectName,
  isGradleProject,
  isMavenProject,
} from "../util";
import { convertGradleDependenciesToLicenses } from "../util/converters";
import { getDependenciesFromReportFile } from "./gradleParser";
import {
  getMavenDependenciesFromRootNode,
  getReportRootNode,
} from "./mavenParser.js";
import { parserFactory } from "./parseLicenses.js";

export const findAllLicenses = (projectPath: string): Dependency[] => {
  const isMaven = isMavenProject(projectPath);
  const isGradle = isGradleProject(projectPath);

  if (!isMaven && !isGradle) {
    throw new Error("The project is not a Maven or Gradle project.");
  }

  const rootProjectName = getRootProjectName(projectPath);
  let licenses: Dependency[] = [];

  if (isMaven) {
    const pathToReport = `${projectPath}/target/site/dependencies.html`;
    const rootNode = getReportRootNode(pathToReport);
    const mavenDependencies = getMavenDependenciesFromRootNode(rootNode);

    licenses = convertMavenDependenciesToLicenses(
      mavenDependencies,
      rootProjectName
    );
  }

  if (isGradle) {
    let pathToReport = "";
    if (existsSync(`${projectPath}/build/licenses/licenses.json`)) {
      pathToReport = `${projectPath}/build/licenses/licenses.json`;
    } else if (existsSync(`${projectPath}/licenses/licenses.json`)) {
      pathToReport = `${projectPath}/licenses/licenses.json`;
    } else {
      throw new Error("No license report found.");
    }

    const gradleDependencies = getDependenciesFromReportFile(pathToReport);

    licenses = convertGradleDependenciesToLicenses(
      gradleDependencies,
      rootProjectName
    );
  }

  // remove duplicates
  licenses = removeDuplicates(licenses);

  // sort by name
  licenses.sort((a, b) => a.name.localeCompare(b.name));

  return licenses;
};

export const checkLicenses = (
  whitelistedLicenses: string[],
  blacklistedLicenses: string[],
  projectPath: string,
  metadataOutputter: MetadataOutputter,
  infoOutputter: DependencyOutputter,
  warnOutputter: DependencyOutputter,
  errorOutputter: DependencyOutputter
) => {
  if (!projectPath) {
    return console.error("No project path provided.");
  }

  try {
    const licenses = findAllLicenses(projectPath);

    if (!licenses || licenses.length <= 0) {
      return console.error("No dependencies found.");
    }

    const parse = parserFactory(
      whitelistedLicenses,
      blacklistedLicenses,
      infoOutputter,
      warnOutputter,
      errorOutputter
    );

    const result = parse(licenses);
    const {
      uniqueCount,
      whitelistedCount,
      warnCount,
      blacklistedCount,
      blackListOutputs,
      warnOutputs,
      whiteListOutputs,
    } = result;

    metadataOutputter(
      uniqueCount,
      whitelistedCount,
      warnCount,
      blacklistedCount
    );

    // construct outputs placing blacklisted first, then warnings, then whitelisted
    const outputs = [...blackListOutputs, ...warnOutputs, ...whiteListOutputs];
    outputs.forEach((output) => console.log(output));
  } catch (err) {
    console.error((err as Error).message);
  }
};

export default checkLicenses;
