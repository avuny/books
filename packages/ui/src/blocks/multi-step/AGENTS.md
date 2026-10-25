# multi-step block: guide for AI coding agents

Read this before changing or using `multi-step/`. It is a generic, app-agnostic
building block for any multi-step form or wizard. Target location:
`@workspace/ui/blocks/multi-step` (next to `blocks/form`). Nothing in it may
import app code (routers, API hooks, feature types, i18n).

## Mental model

- The **caller owns the active step** (a `useMultiStep` hook, a domain reducer
  such as `useSignUpFlow`, a router param...). The block never stores domain data.
- `MultiStepFlow` = `StepProgress` (indicator) + `StepSwitch` (renders the active view).
- Each step is a **render function** in a `views` record. Only the active
  function runs. Return `null` to hold back a step whose data is not ready
  (replaces `state.x && <Step/>` guards).
- Steps are **keyed**: a step always mounts fresh, so two steps rendering the
  same component never share state.

## File map

| File | Role |
| --- | --- |
| `lib/steps.ts` | Pure utils: `getStepPosition`, `getNextStep`, `getPreviousStep`, type `StepPosition` |
| `hooks/use-multi-step.ts` | Navigation-only state: `step`, `current`, `total`, `isFirst`, `isLast`, `goTo`, `next`, `back`, `reset` |
| `ui/step-progress.tsx` | Segmented progress bar. Props: `current`, `total`, `label`, `className` |
| `ui/step-switch.tsx` | Renders `views[current]()`, keyed by step. Type `StepViews<T>` |
| `ui/multi-step-flow.tsx` | Composition. Props: `steps`, `current`, `views`, `formatLabel`, `Progress?`, `className?` |
| `ui/step-alert.tsx` | shadcn `Alert` wrapper for notices/errors. Renders nothing when `message` is empty |
| `index.ts` | Public API barrel. Export new public things here |

Every source file has a sibling `*.test.ts(x)`.

## Hard rules (project conventions)

1. **Small, testable, reusable components. Inject dependencies as props**
   (labels, formatters, icons, replaceable components, render functions).
   No importing routers, API clients, or translation hooks inside this block.
2. **Theme tokens only. Never hard-coded colors.** Use `bg-primary`, `bg-muted`,
   `text-foreground`, `text-muted-foreground`, `text-destructive`... Never
   `bg-white`, `text-black`, `bg-gray-100`, hex values. Always consider dark mode;
   tokens handle it, hard-coded colors break it.
3. Use shadcn components from `@workspace/ui/components/*` and `cn` from
   `@workspace/ui/lib/utils`. Do not rebuild primitives.
4. All user-visible text arrives via props (already translated). Do not
   hard-code English strings in components.
5. Keep `StepProgress` accessible (`role="progressbar"`, `aria-valuenow/max`,
   `aria-label`) and motion-safe (`motion-reduce:transition-none`).
6. Every new util/hook/component ships with tests in the same folder.

## Code style

No semicolons, double quotes, 2-space indent, Prettier es5 trailing commas,
kebab-case file names, `type` aliases for props (not interfaces), inline
`type` imports (`import { x, type Y }`).

## Adding a new flow

1. Declare steps at module level: `const STEPS = ["a", "b", "c"] as const`
   (non-empty tuple; required by `useMultiStep`).
2. Get the active step from `useMultiStep({ steps: STEPS })`, or from your own
   state if transitions carry data (then pass `current={state.step}`).
3. Render `<MultiStepFlow steps current views formatLabel />`.
4. `formatLabel` must call your i18n/template helper, e.g.
   `(p) => fill(copy.stepLabel, p)`. The block never formats text itself.
5. Put per-step logic in step components/hooks outside this block. Each view
   should be a thin wiring function.

See `examples/` for a refactored `SignUpFlow` and a new flow.

## Extending safely

- New visual indicator? Pass it via the `Progress` prop; do not fork `MultiStepFlow`.
- Need data across steps? Keep it in the caller (reducer/state). Do not add a
  data bag to this block unless asked.
- Need guards/redirects for invalid steps? Add them in the caller or as a new
  small, tested util; keep `StepSwitch` dumb.
- Changing `StepSwitch` keying or `StepProgress` ARIA/tokens: update the tests
  that pin that behavior, and say so in the PR.

## Testing

Vitest + jsdom + `@testing-library/react` + `@testing-library/jest-dom/vitest`
(loaded in the setup file). Use `globals: true`, or add `afterEach(cleanup)` in
setup. Prefer role/text queries; test injected props with fakes instead of mocks
of internals. Run: `vitest run multi-step`.

## Do / Don't

- Do keep utils pure and generic over `T extends string`.
- Do add a test for every bug fix.
- Don't import from the app (`@/api`, router, feature folders).
- Don't add colors, inline styles, or `dark:` color overrides; use tokens.
- Don't call `views[step]` outside `StepSwitch`; don't render all steps at once.
