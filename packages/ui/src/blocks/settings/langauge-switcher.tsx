import { buttonVariants } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { locales, localeLabels, type Locale, defaultLocale } from "@avuny/i18n"

export type LanguageSwitcherProps = {
  locale: Locale
  updateLocale: (locale: Locale) => void
  label?: string | null // translated text for screen readers
}

export default function LanguageSwitcher({
  locale,
  updateLocale,
}: LanguageSwitcherProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({ size: "icon", variant: "outline" })}
      >
        <div className="h-[1.2rem] w-[1.2rem]" lang={locale}>
          {localeLabels[locale] ?? localeLabels[defaultLocale]}
        </div>
        <span className="sr-only">
          {localeLabels[locale] ?? localeLabels[defaultLocale]}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuCheckboxItem
            key={loc}
            lang={loc}
            checked={locale === loc}
            onCheckedChange={() => updateLocale(loc)}
          >
            {localeLabels[loc]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
