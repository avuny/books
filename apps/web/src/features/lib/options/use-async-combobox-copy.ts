/**
 * apps/web/src/lib/options/use-async-combobox-copy.ts (new)
 *
 * One shared set of strings for every async combobox, so a module only adds its own
 * "Create new …" label. The keys live in the `common` namespace; merge
 * locales/en/common.additions.json and locales/ar/common.additions.json into your real files.
 */
import { useTranslation } from "react-i18next"
import type { AsyncComboboxCopy } from "@workspace/ui/blocks/form"

export function useAsyncComboboxCopy(): AsyncComboboxCopy {
  const { t } = useTranslation("common")

  return {
    loading: t("combobox.loading"),
    loadingMore: t("combobox.loadingMore"),
    empty: t("combobox.empty"),
    error: t("combobox.error"),
    retry: t("combobox.retry"),
  }
}
