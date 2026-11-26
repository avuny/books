# Proposal: fix the party locales test

**Problem.** `packages/contracts/src/party/locales.test.ts` extracts placeholders with a `{{x}}` regex, but locales use single braces (AGENTS rule 13). The regex matches nothing, so the en/ar parity check always passes.

**Change.** Match `/\{([a-zA-Z0-9_-]+)\}/g`, fix any real mismatches it finds, and reuse the helper for every module's locale test.

**Cost.** Small. May surface existing mismatches.
