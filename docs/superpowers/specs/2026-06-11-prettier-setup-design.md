# Prettier Setup Design

**Date:** 2026-06-11

## Goal

Add Prettier to the project for consistent code formatting, integrated into the pre-commit hook (auto-format + re-stage) and CI (check only).

## Packages

- `prettier` — formatter
- `eslint-config-prettier` — disables ESLint rules that conflict with Prettier's output

## Config Files

**`.prettierrc`** — Prettier 3 defaults. Only explicit override: `"trailingComma": "all"` (already Prettier 3's default, made explicit for clarity).

**`.prettierignore`** — Excludes:

- `.next/`
- `node_modules/`
- `drizzle/` (generated migration files)
- `pnpm-lock.yaml`

## ESLint Integration

Add `eslint-config-prettier` as the final entry in `eslint.config.mjs` so it overrides any conflicting formatting rules.

## Lefthook Pre-commit

Add a `format` command alongside existing `lint` and `typecheck`. Uses Lefthook's `{staged_files}` interpolation to scope to staged files only, and `stage_fixed: true` to re-stage any files Prettier modifies before the commit lands.

```yaml
format:
  glob: "*.{js,ts,jsx,tsx,json,css,md,mdx}"
  run: pnpm prettier --write {staged_files}
  stage_fixed: true
```

## CI

Add a `format` job (parallel to `typecheck` and `lint`) running `pnpm prettier --check .`. The existing `build` job gains `format` as an additional dependency in `needs`.

## Scripts

Add to `package.json`:

- `"format": "prettier --write ."` — manual full-repo format
- `"format:check": "prettier --check ."` — used by CI
