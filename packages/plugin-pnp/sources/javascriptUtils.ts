import {BuildDirective, BuildType, Configuration, DependencyMeta, FetchResult, LinkType, Manifest, MessageName, Package, Report, structUtils} from '@yarnpkg/core';
import {Filename, ppath}                                                                                                                      from '@yarnpkg/fslib';

export function checkAndReportManifestCompatibility(pkg: Package, manifest: Pick<Manifest, 'cpu' | 'os'>, {configuration, report}: {configuration: Configuration, report: Report}) {
  if (manifest && !Manifest.isManifestFieldCompatible(manifest.os, process.platform)) {
    report.reportWarningOnce(MessageName.INCOMPATIBLE_OS, `${structUtils.prettyLocator(configuration, pkg)} The platform ${process.platform} is incompatible with this module, build skipped.`);
    return false;
  }

  if (manifest && !Manifest.isManifestFieldCompatible(manifest.cpu, process.arch)) {
    report.reportWarningOnce(MessageName.INCOMPATIBLE_CPU, `${structUtils.prettyLocator(configuration, pkg)} The CPU architecture ${process.arch} is incompatible with this module, build skipped.`);
    return false;
  }

  return true;
}

export function extractBuildScripts(pkg: Package, fetchResult: FetchResult, manifest: Pick<Manifest, 'cpu' | 'os' | 'scripts'>, dependencyMeta: DependencyMeta, {configuration, report}: {configuration: Configuration, report: Report}) {
  const buildScripts: Array<BuildDirective> = [];

  for (const scriptName of [`preinstall`, `install`, `postinstall`])
    if (manifest.scripts.has(scriptName))
      buildScripts.push([BuildType.SCRIPT, scriptName]);

  // Detect cases where a package has a binding.gyp but no install script
  const bindingFilePath = ppath.join(fetchResult.prefixPath, `binding.gyp` as Filename);
  if (!manifest.scripts.has(`install`) && fetchResult.packageFs.existsSync(bindingFilePath))
    buildScripts.push([BuildType.SHELLCODE, `node-gyp rebuild`]);

  if (!configuration.get(`enableScripts`) && !dependencyMeta.built) {
    report.reportWarningOnce(MessageName.DISABLED_BUILD_SCRIPTS, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but all build scripts have been disabled.`);
    return [];
  }

  if (pkg.linkType !== LinkType.HARD) {
    report.reportWarningOnce(MessageName.SOFT_LINK_BUILD, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but is referenced through a soft link. Soft links don't support build scripts, so they'll be ignored.`);
    return [];
  }

  if (dependencyMeta && dependencyMeta.built === false) {
    report.reportInfoOnce(MessageName.BUILD_DISABLED, `${structUtils.prettyLocator(configuration, pkg)} lists build scripts, but its build has been explicitly disabled through configuration.`);
    return [];
  }

  const isManifestCompatible = checkAndReportManifestCompatibility(pkg, manifest, {configuration, report});
  if (!isManifestCompatible)
    return [];

  return buildScripts;
}