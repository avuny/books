# Rule: i18n, RTL, a11y

- Two locales, **always both**: `en.json` and `ar.json`, identical key sets. Run `.agents/skills/locales/scripts/check-locale-parity.mjs`.
- Contracts locale = server + shared vocabulary: `errors.<CODE>`, `labels.*`, `msgs.<MESSAGE_CODE>`. i18next namespace = module name in snake/short form (`role`, `organization`).
- Web UI strings use the same namespace: `const { t } = useTranslation("role")`. Group keys by surface: `list.*`, `create.*`, `update.*`, `details.*`, `table.*`, `fields.<field>.{label,placeholder}`, `actions.*`, `empty.*`, `pagination.*`, `delete.*`, `type.*`.
- Interpolation: `t("delete.description", { name })`; plurals via `count`. Never concatenate translated fragments.
- Unknown dynamic tokens (resource names, enum values) use `defaultValue` fallback so a new backend value never shows a missing-key string.
- Dates/numbers: `new Intl.DateTimeFormat(i18n.language, …)` in the container.
- RTL: logical utilities only (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`); flip arrows with `rtl:rotate-180`.
- Error messages shown to users come from the server (`parseApiError(e).message`, already localized via `trans({ lang })`).
