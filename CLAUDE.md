# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Toolchain

This is a **Vite+ monorepo** using the `vp` CLI (from `vite-plus`). Vite+ wraps Vite, Vitest, tsdown, Oxlint, and Oxfmt into a single tool. Always use `vp` commands rather than invoking underlying tools directly.

Package manager: **bun**. Run `vp install` after pulling changes.

## Common Commands

```bash
vp install          # install dependencies
vp check            # format, lint, and type-check
vp check --fix      # auto-fix formatting and lint issues
vp test             # run tests in current package
vp run -r test      # run tests across all packages
vp run -r build     # build all packages
vp run dev          # start the website dev server
vp run ready        # full validation: check + test + build
```

Within `packages/utils`:

```bash
vp pack             # build the library (outputs to dist/)
vp pack --watch     # watch mode
```

## Architecture

```
apps/
  website/          # Astro 6 frontend
packages/
  utils/            # TypeScript library, built with vp pack (tsdown)
```

**`apps/website`** is an Astro site. Dev/build via `astro` scripts, but invoked through `vp run website#dev` from the root.

**`packages/utils`** is a publishable ESM library. It exports from `dist/index.mjs` (built output). Source lives in `src/`, tests in `tests/`. Uses `@typescript/native-preview` for fast type generation (`dts: { tsgo: true }`).

## Pre-commit Hook

The root `vite.config.ts` configures a staged-files hook that runs `vp check --fix` automatically on commit. If a commit fails due to this hook, fix the reported issues and create a new commit — do not amend.
