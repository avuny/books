# General Guidelines (React Web and React Native)

1. **Build small, testable, and reusable components.**
   - Keep components focused on a single responsibility.
   - Avoid large components that combine unrelated UI, business logic, and side effects.
   - Inject dependencies through props rather than coupling components directly to external services, application state, or specific implementations.
   - Prefer dependency injection when it improves testability, reusability, and separation of concerns.

2. **Use theme-aware design tokens for colors and styling.**
   - Always use the project's semantic color and styling tokens instead of hardcoded colors.
   - Prefer tokens such as `text-foreground`, `bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, and `bg-primary` where supported by the project's styling system.
   - Never use hardcoded colors such as `bg-white`, `text-black`, or arbitrary color values when an appropriate semantic token exists.
   - Ensure every component supports both light and dark modes.
   - Consider theme compatibility whenever adding backgrounds, text, borders, icons, hover states, focus states, or other visual elements.
   - Follow the existing design system and component conventions rather than introducing new styling patterns unnecessarily.