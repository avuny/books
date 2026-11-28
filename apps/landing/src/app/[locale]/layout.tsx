import type { Metadata } from "next"
import type { ReactNode } from "react"

import { loadSnapshot } from "@/lib/content"
import { LOCALES, type Locale } from "@/lib/snapshot"

import "../globals.css"

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const { settings } = await loadSnapshot(locale as Locale)
  return { title: settings.siteName, description: settings.description }
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>{children}</body>
    </html>
  )
}
