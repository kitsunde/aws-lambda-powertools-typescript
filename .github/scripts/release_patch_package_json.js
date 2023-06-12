/**
 * This script is used to update the package.json file of an utility to include pre-release suffixes.
 *
 * We read the original package.json file and extract the name and version fields. Then, if the is an
 * alpha or beta package, we update the version number to include a suffix. Finally, we write the updated
 * package.json file to disk. The file will be restored to its original state after the release is complete.
 */
const { readFileSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

if (process.argv.length < 3) {
  console.error('Usage: node release_patch_package_json.js <package_path>\n');
  process.exit(1);
}
const basePath = resolve(process.argv[2]);
const packageJsonPath = join(basePath, 'package.json');
const alphaPackages = ['@aws-lambda-powertools/idempotency'];
const betaPackages = ['@aws-lambda-powertools/parameters'];

(() => {
  try {
    // Read the original package.json file & extract the name and version fields
    const pkgJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const { name, version: originalVersion } = pkgJson;
    let version = originalVersion;

    // If the package is an alpha or beta package, update the version number to include a suffix
    if (alphaPackages.includes(name)) {
      version = `${version}-alpha`;
    } else if (betaPackages.includes(name)) {
      version = `${version}-beta`;
    }

    // This version number will be picked up during the `npm publish` step, so that
    // it contains the correct version number and fields for the tarball.
    writeFileSync(
      packageJsonPath,
      JSON.stringify(
        {
          ...pkgJson,
          version,
        },
        null,
        2
      )
    );
  } catch (err) {
    throw err;
  }
})();
