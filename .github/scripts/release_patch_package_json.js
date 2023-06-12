const { readFileSync, writeFileSync } = require('node:fs');

const outDir = './lib';
const alphaPackages = [
  '@aws-lambda-powertools/idempotency',
];
const betaPackages = [
  '@aws-lambda-powertools/parameters',
];

/**
 * This script is used to create a new package.json file for the tarball that will be published to npm.
 * 
 * The original package.json file is read and the following fields are extracted:
 * - name
 * - version
 * - description
 * - author
 * - license
 * - homepage
 * - repository
 * - bugs
 * - keywords
 * - dependencies
 * - exports
 * - typeVersions
 * - main
 * - types
 * - files
 * 
 * For alplha & beta packages, the version number is updated to include the appropriate suffix.
 * 
 * The new package.json file is written to the lib folder, which is the folder that will be packed and published to npm.
 * For alpha & beta packages, the original package.json file is also temporarily updated with the new beta version number
 * so that the version number in the registry is correct and matches the tarball.
 */
(() => {
  try {
    // Read the original package.json file
    const pkgJson = JSON.parse(readFileSync('./package.json', 'utf8'))
    // Extract the fields we want to keep
    const {
      name,
      version: originalVersion,
      description,
      author,
      license,
      homepage,
      repository,
      bugs,
      keywords,
      dependencies,
      exports,
      typeVersions,
      main,
      types,
      files,
    } = pkgJson;

    let version = originalVersion;
    let isGA = true;
    // If the package is an alpha or beta package, update the version number to include a suffix
    if (alphaPackages.includes(name)) {
      version = `${version}-alpha`;
      isGA = false;
    } else if (betaPackages.includes(name)) {
      version = `${version}-beta`;
      isGA = false;
    }

    // Create a new package.json file with the updated version for the tarball
    const newPkgJson = {
      name,
      version,
      description,
      author,
      license,
      homepage,
      repository,
      bugs,
      keywords,
      dependencies,
      main,
      types,
      files,
    };
    // Not all packages have these fields yet, so only add them if they exist
    if (exports) {
      newPkgJson.exports = exports;
    }
    if (typeVersions) {
      newPkgJson.typeVersions = typeVersions;
    }

    // Write the new package.json file inside the folder that will be packed
    writeFileSync(`${outDir}/package.json`, JSON.stringify(newPkgJson, null, 2));

    if (!isGA) {
      // Temporarily update the original package.json file with the new alpha or beta version.
      // This version number will be picked up during the `npm publish` step, so that
      // the version number in the registry is correct and matches the tarball.
      // The original package.json file will be restored after the publish step.
      writeFileSync('package.json', JSON.stringify({ ...pkgJson, version }, null, 2));
    }
  } catch (err) {
    throw err;
  }
})();
