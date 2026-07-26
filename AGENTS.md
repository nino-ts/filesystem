# @ninots/filesystem

## Overview
A package for the Ninots Framework

## Isolation & Decoupling
This `AGENTS.md` is strictly specific to the `@ninots/filesystem` package.
- **Completely Decoupled**: When working in this package, you must operate entirely within its boundaries. Data and context cannot be crossed.
- Do not assume the existence of, or cross-reference, other packages in this repository.
- Treat `@ninots/filesystem` as an independent and isolated project.

## Development Context
- **Runtime Environment**: Bun
- **Language**: TypeScript
- **Testing**: Use `bun test` within this directory to run the test suite.

## Guidelines
- Write strict TypeScript code.
- Ensure all tests pass (`bun test`) before considering a task complete.
- Follow the established directory structure and do not leak internal logic to outside scopes.
