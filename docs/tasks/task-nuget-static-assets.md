# NuGet Static Assets Package

## Original Goal

Package Moonglade.Editor so the main Moonglade ASP.NET Core application can update the editor through NuGet instead of manually copying release files.

## Background

Moonglade.Editor already builds browser-ready assets under `dist/`. The main Moonglade repository should keep consuming prebuilt assets and should not gain npm, Vite, webpack, Rollup, esbuild, or a frontend build step. ASP.NET Core Razor Class Library static web assets expose package assets from `wwwroot` under `/_content/{PACKAGE ID}/...` in consuming applications. The package targets .NET 10, and `package.json` `version` is the single version source for the generated NuGet package.

## Scope

- Add a NuGet static web assets package project.
- Add a deterministic local package script that builds `dist/`, stages only browser assets, and runs `dotnet pack`.
- Document the NuGet consumption path and package command.
- Keep the NuGet version synchronized from `package.json` only.
- Add release branch GitHub Actions publishing for the NuGet package.
- Keep generated build output ignored by Git.

## Out of Scope

- Publishing to nuget.org or GitHub Packages.
- Changing the editor public JavaScript API.
- Changing Moonglade integration code in the main repository.
- Adding npm/build tooling to the main Moonglade repository.

## Task Breakdown

| No. | Task | Dependencies | Verification | Status |
| --- | --- | --- | --- | --- |
| 1 | Add Razor SDK package project for static web assets | None | `dotnet pack` succeeds | Done |
| 2 | Add npm packaging script and staging flow | Task 1 | `npm run pack:nuget` succeeds | Done |
| 3 | Update README and agent docs | Tasks 1-2 | Markdown review | Done |
| 4 | Verify tests, build, and package contents | Tasks 1-3 | `npm test`, `npm run build`, package inspection | Done |

## Execution Order

Create the packaging project first, then add the script that produces the package. Update documentation once the command and URL shape are verified.

## Current Progress

NuGet static asset packaging is implemented and verified. The package now targets `net10.0`; the generated package is `artifacts/nuget/Moonglade.Editor.StaticAssets.0.5.0.nupkg`.

## Verification Log

| Date | Command or Check | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-31 | `npm run pack:nuget` | Passed | Built `dist/`, staged browser assets, and created `artifacts/nuget/Moonglade.Editor.StaticAssets.0.5.0.nupkg`. |
| 2026-07-31 | `tar -tf artifacts\nuget\Moonglade.Editor.StaticAssets.0.5.0.nupkg` | Passed | Package contains build props, `lib/net10.0`, and `staticwebassets/moonglade-editor/*`; unwanted root content files were removed after tightening the project. |
| 2026-07-31 | `npm test` | Passed | 117 tests passed across 6 files. |
| 2026-07-31 | Temporary ASP.NET Core `net10.0` app restore/build with local package source and isolated `NUGET_PACKAGES` | Passed | Consumer app restored and built with `Moonglade.Editor.StaticAssets` 0.5.0 from the newly generated package. |
| 2026-07-31 | Consumer `staticwebassets` manifest inspection | Passed | Manifest exposes `_content/Moonglade.Editor.StaticAssets/moonglade-editor/moonglade-editor.global.js`, CSS, ESM JS, formatter JS, and source maps. |
| 2026-07-31 | Direct `dotnet pack Moonglade.Editor.StaticAssets.csproj` without `npm run pack:nuget` | Passed | Command failed intentionally with the package.json single-version-source error. |
| 2026-07-31 | GitHub Actions release branch NuGet publishing workflow review | Passed | `publish-nuget` job is guarded to push events on `refs/heads/release`, installs .NET 10, runs `npm run pack:nuget`, and pushes with `NUGET_API_KEY`. |

## Issues and Resolutions

### Windows npm command spawning

- Symptom: `npm run pack:nuget` failed immediately with `spawn EINVAL` before the build started.
- Root cause: Starting `npm.cmd` directly through `child_process.spawn(..., { shell: false })` was not reliable in the current Windows/Node runtime.
- Fix: Run the npm CLI through the current Node executable when `npm_execpath` is available.
- Verification: `npm run pack:nuget` started and completed the frontend build and `dotnet pack`.

### Unwanted content files in NuGet package

- Symptom: The first package included root files such as `package.json`, `package-lock.json`, and `tsconfig.json` under `content/` and `contentFiles/`.
- Root cause: Razor SDK default content globs included repository files in addition to static web assets.
- Fix: Disable default content items and explicitly include only `wwwroot` static assets plus the package README.
- Verification: Repacked package no longer includes `content/` or `contentFiles/`; it contains only README, build props, `lib/net10.0`, and `staticwebassets/`.

### Version synchronization

- Symptom: The first package project duplicated `0.5.0` in both `package.json` and `Moonglade.Editor.StaticAssets.csproj`.
- Root cause: The Razor package project had a hard-coded `<Version>`.
- Fix: Remove the hard-coded MSBuild version and require `npm run pack:nuget` to pass `MoongladeEditorPackageVersion` from `package.json`.
- Verification: `npm run pack:nuget` generated `Moonglade.Editor.StaticAssets.0.5.0.nupkg` from `package.json` `version`; direct `dotnet pack` without the script fails with the single-version-source error.

### Razor SDK default compile glob

- Symptom: After switching to `net10.0`, `dotnet pack` tried to compile C# files from the ignored `output/` smoke test project and reported duplicate assembly attributes.
- Root cause: The static assets package project does not need C# source, but the SDK default compile glob picked up repository-local generated C# files.
- Fix: Set `EnableDefaultCompileItems` to `false` so the package project only participates in static web asset packaging.
- Verification: `npm run pack:nuget` succeeded after disabling default compile items.

## Follow-ups

- Decide where to publish the NuGet package.
- Update the main Moonglade repository to reference `Moonglade.Editor.StaticAssets` and the `_content/...` URLs.

## Notes

The package ID is `Moonglade.Editor.StaticAssets`. The expected URL prefix in Moonglade is `/_content/Moonglade.Editor.StaticAssets/moonglade-editor/`.
