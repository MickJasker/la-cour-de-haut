// Neon branch lifecycle (create on start, delete on finish) is handled by
// the CI workflow steps that wrap pnpm test:e2e. Nothing to do here.
export default async function globalTeardown() {}
