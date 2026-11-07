# Releases

A push updates `main`; a release is an explicit version, changelog entry, immutable
Git tag and GitHub release. Do not publish a release for every small push.

## Version policy

- Patch (`0.2.1`): fixes compatible with the current release line.
- Minor (`0.3.0`): new features. During `0.x` development, breaking changes also
  require a minor bump and explicit migration notes.
- After `1.0.0`, breaking changes require a major bump.

Keep the package name/plugin ID stable so updates retain settings and storage.
Changing stored formats requires a tested migration that preserves existing data.
Never move a published tag; publish a new version to fix a release.

## Prepare

1. Review the diff and check both `gh api user --jq .login` and
   `git var GIT_AUTHOR_IDENT` / `git var GIT_COMMITTER_IDENT`. GitHub login and Git
   attribution are separate. Resolve mismatches before committing.
2. Update the version with `npm version <version> --no-git-tag-version --ignore-scripts`.
   This updates `package.json` and the root versions in `package-lock.json`.
   Synchronize `bun.lock` if dependencies changed; it does not store the root version.
3. Add a dated `CHANGELOG.md` entry with user-visible changes, removals, compatibility
   requirements and upgrade/migration steps. Update affected feature documentation.
4. Run `bun test --timeout 30000`, `bun run typecheck:plugin`,
   `bb plugin types --check .`, and `bun run build:plugin`. Keep generated skill
   resources with their sources. For packaging/dependency changes, also build an
   isolated production-only copy as required by `AGENTS.md`; do not activate a
   temporary plugin for validation. Reuse passing checks when the remaining changes
   are only version metadata and documentation, but rebuild versioned artifacts.
5. Check the staged diff and commit the release changes. Verify the author and
   committer on the resulting commit. Prepare a release-notes file from the
   changelog entry, keeping upgrade steps and validation limits.

## Publish

Substitute the new version below. Run from the intended release commit with a
clean worktree; confirm the tag is unused locally and on the remote first.

```sh
git tag -a v0.2.0 -m "Release v0.2.0"
git push --atomic origin main refs/tags/v0.2.0
gh release create v0.2.0 --verify-tag --title "Agent Harness v0.2.0" --notes-file <release-notes-file>
```

Use `--verify-tag` so GitHub cannot create a tag at an unintended commit. If a
network response is uncertain, inspect the remote tag and existing release before
retrying. Confirm the remote commit, tag target and published release URL afterward.

## User updates

- `@main` tracks commits on the branch, including unreleased work.
- `@^0.2.0` tracks compatible tagged releases from `0.2.0` up to, but excluding,
  `0.3.0`. BB also checks the plugin's engine requirements.
- `@v0.2.0` or an exact commit is pinned.

For tracking installs, users run `bb plugin update agent-harness`. Updates retain
BB-managed settings/storage for the same plugin ID; uninstalling deletes saved
configuration. Do not recommend uninstall/reinstall to users who want to preserve
settings. Existing `@main` installations can continue using that source.
