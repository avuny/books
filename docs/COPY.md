# Copy

How user-facing text is written in the web app. Text is never hard-coded. It lives in the module's locale files, the container reads it with `t()`, and the form receives it through a `copy` prop. Read this before adding or changing any string. Form structure is in [FORMS.md](FORMS.md).

## Rules

- Never write user-facing text as a literal in a form, container, route or hook. Every string is a key in the module's locale files.
- Copy is anything a user can read or hear: titles, descriptions, labels, placeholders, button text, helper text, validation and error messages, and `aria-label`, `title` and `alt` values. Class names, field names, `autoComplete` values, error codes and log messages are not copy.
- Only containers and flow components (`sign-up-flow.tsx`) call `t()`. A form never imports `react-i18next`. It renders `copy` and other props that arrive already localized.
- Do not pass default text to `t()` (`t(key, "Sign in")` or `defaultValue`). It is hard-coded copy and hides a missing key.
- Literal strings are allowed only in tests, which render a form with literal `copy`.
- Every key exists in every locale file of the module, at the same path, with the same placeholders.
- Translate every locale. Never paste English into `ar.json` to make a key exist.
- Verify every change to copy as described in [Verify keys](#verify-keys).

## How copy flows

Locale file → container (`t()`) → `copy` prop → form.

```tsx
// Wrong: hard-coded text
<SubmitButton label="Sign in" loadingLabel="Signing in…" />

// Container (sign-in.tsx): every value is a key
const { t } = useTranslation("user")

const copy = {
  title: t("auth.signIn.title"),
  password: {
    label: t("auth.signIn.password.label"),
    placeholder: t("auth.signIn.password.placeholder"),
  },
  submitLabel: t("auth.signIn.submitLabel"),
  submittingLabel: t("auth.signIn.submittingLabel"),
}

// Form (sign-in-form.tsx): renders copy, knows nothing about i18n
<SubmitButton
  loading={isPending}
  label={copy.submitLabel}
  loadingLabel={copy.submittingLabel}
/>
```

The same keys exist in every locale file:

```jsonc
// locales/en.json (excerpt)
{
  "auth": {
    "signIn": {
      "title": "Welcome back",
      "password": { "label": "Password", "placeholder": "Your password" },
      "submitLabel": "Sign in",
      "submittingLabel": "Signing in…"
    }
  }
}

// locales/ar.json (excerpt)
{
  "auth": {
    "signIn": {
      "title": "مرحباً بعودتك",
      "password": { "label": "كلمة المرور", "placeholder": "كلمة المرور الخاصة بك" },
      "submitLabel": "تسجيل الدخول",
      "submittingLabel": "جارٍ تسجيل الدخول…"
    }
  }
}
```

## Where copy lives

A module keeps its strings next to its contracts, one JSON file per locale.

```
packages/contracts/src/user/
  locales/
    en.json
    ar.json
    index.ts   # exports userTranslationsEn, userTranslationsAr
  index.ts     # export * from "./locales/index.js"
```

- The `user` module is read through the `user` namespace: `useTranslation("user")`.
- A locale file is a nested object. A key is its dotted path, for example `auth.signIn.title`.
- Call `t()` on leaf strings only. `auth.signIn.identifier` is a group (`label`, `placeholder`), not a string.
- A new locale file needs an export in `locales/index.ts`. A new module follows the same shape and is registered the same way as `user` (search for `userTranslationsEn`).

## Writing keys

`<form>`, `<flow>` and `<step>` are camelCase (`signIn`, `signUp`, `verifyOtp`).

| Copy | Key |
| --- | --- |
| Single form | `auth.<form>.<field>`, e.g. `auth.signIn.title`, `auth.signIn.submitLabel` |
| Field label and placeholder | `auth.<form>.<field>.label` and `.placeholder` (the `FieldCopy` shape) |
| Step of a multi-step flow | `auth.<flow>.<step>.<field>`, e.g. `auth.signUp.verifyOtp.title` |
| Flow level | `auth.<flow>.<field>`, e.g. `auth.signUp.stepLabel`, `auth.signUp.proofExpired` |
| Server error | `auth.errors.<CODE>`, named after the contract error code, e.g. `auth.errors.OTP_EXPIRED` |

- Reuse the names existing forms use, so keys map one to one onto `<Name>Copy`: `title`, `description`, `submitLabel`, `submittingLabel`. A secondary action is a `<action>Prompt` and `<action>Label` pair (`signUpPrompt`, `signUpLabel`).
- One string, one key. Never build a sentence from translated fragments: word order differs between English and Arabic. A prompt and a link rendered as two elements are two keys.
- Dynamic values are single-brace placeholders: `{identifier}`, `{seconds}`, `{current}`, `{total}`. Fill them in the container with `fill(t(key), { identifier })`. Use the same placeholder names in every locale and do not translate the token:

  ```
  en  Enter the code we sent to {identifier}.
  ar  أدخل الرمز الذي أرسلناه إلى {identifier}.
  ```

- English copy follows the existing files: `’` for apostrophes (`Don’t have an account?`) and a trailing `…` on pending labels (`Signing in…`).

## Error copy

- Server errors reach the form already localized (`errorMessage`, `<field>Error`). Their text is keyed by contract error code under `auth.errors`, and `auth.errors.fallback` is the generic message. A new API error code that the UI should explain gets a key in that group, in every locale.
- A validation message that depends on the language arrives through `copy`, for example `auth.signUp.completeSignUp.passwordMismatch`. See Derived schema in [FORMS.md](FORMS.md#patterns).

## Verify keys

Required for every change that adds, renames or removes copy. Agents run it before reporting a form task as done.

Check against every JSON file in the module's `locales/` folder (`user`: `en.json` and `ar.json`, plus any locale added later), not only the file you edited.

1. Find the files. The namespace in `useTranslation("<ns>")` names the module. Its locale files are `packages/contracts/src/<ns>/locales/*.json`.
2. Every key the change adds or touches exists in every locale file, at the same path, with the same placeholders.
3. No locale file has a key that another one lacks.
4. Every `t("...")` key in the feature resolves to a string in every locale file. A key built at runtime, such as `` t(`auth.errors.${code}`) ``, cannot be scripted: check each value it can take by hand.
5. Values are translations, not copies of the English text.

The script covers steps 2 to 4 for static keys. From the repo root, pass the locales folder, then the feature folders to scan. It prints every missing key and exits with code 1 if there is any.

```bash
node - packages/contracts/src/user/locales apps/web/src/features/auth/sign-in <<'EOF'
const fs = require("fs")
const path = require("path")

const [localesDir, ...srcDirs] = process.argv.slice(2)
if (!localesDir) {
  console.error("usage: node - <locales-dir> [<feature-dir>...]")
  process.exit(2)
}

// Dotted path of every string in a nested locale object.
const flat = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === "object"
      ? flat(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  )

const locales = Object.fromEntries(
  fs
    .readdirSync(localesDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const json = JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8"))
      return [file, new Set(flat(json))]
    })
)
if (!Object.keys(locales).length) {
  console.error(`no .json files in ${localesDir}`)
  process.exit(2)
}

// Source files to scan. Tests are skipped.
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    const isSource =
      /\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)
    return isSource ? [full] : []
  })

// Static keys only: t("a.b"). Keys built at runtime are skipped.
const T_CALL = /\bt\(\s*["'`]([^"'`$]+)["'`]/g
const used = srcDirs
  .flatMap(walk)
  .flatMap((file) =>
    [...fs.readFileSync(file, "utf8").matchAll(T_CALL)].map((m) => m[1])
  )

// Every used key and every key of any locale must exist in all locales.
const wanted = new Set([
  ...used,
  ...Object.values(locales).flatMap((keys) => [...keys]),
])

let missing = 0
for (const [file, keys] of Object.entries(locales)) {
  for (const key of wanted) {
    if (!keys.has(key)) {
      console.log(`${file}: missing ${key}`)
      missing++
    }
  }
}

console.log(
  missing
    ? `${missing} missing`
    : `OK: ${Object.keys(locales).length} locale files, ${wanted.size} keys`
)
process.exit(missing ? 1 : 0)
EOF
```

If it reports a missing key, add the key with a real translation. Never delete a `t()` call to silence it. Say in the final message which locale files were checked.