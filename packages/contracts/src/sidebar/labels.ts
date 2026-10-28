import type { SidebarHeadingType, SidebarOptionName } from "./constants.js"

export const SIDEBAR_LOCALES = ["en", "ar"] as const
export type SidebarLocale = (typeof SIDEBAR_LOCALES)[number]
export const DEFAULT_SIDEBAR_LOCALE: SidebarLocale = "en"

export interface SidebarLabelSet {
  headings: Record<SidebarHeadingType, string>
  options: Record<SidebarOptionName, string>
}

export const SIDEBAR_LABELS: Record<SidebarLocale, SidebarLabelSet> = {
  en: {
    headings: {
      users: "Users",
      purchases: "Purchases",
      sales: "Sales",
      inventory: "Inventory",
    },
    options: {
      user: "Users",
      role: "Roles",
      item: "Items",
      unit: "Units",
      unitCollection: "Unit collections",
      invoice: "Invoices",
      customer: "Customers",
      supplier: "Suppliers",
      purchaseOrder: "Purchase orders",
      salesOrder: "Sales orders",
      warehouse: "Warehouses",
      organization: "Organization",
      organizationUser: "Members",
      report: "Reports",
      receipt: "Receipts",
    },
  },
  ar: {
    headings: {
      users: "المستخدمون",
      purchases: "المشتريات",
      sales: "المبيعات",
      inventory: "المخزون",
    },
    options: {
      user: "المستخدمون",
      role: "الأدوار",
      item: "الأصناف",
      unit: "الوحدات",
      unitCollection: "مجموعات الوحدات",
      invoice: "الفواتير",
      customer: "العملاء",
      supplier: "الموردون",
      purchaseOrder: "أوامر الشراء",
      salesOrder: "أوامر البيع",
      warehouse: "المستودعات",
      organization: "المنظمة",
      organizationUser: "أعضاء المنظمة",
      report: "التقارير",
      receipt: "الإيصالات",
    },
  },
}

/** "ar-EG" -> "ar"; anything unknown falls back to English. */
export function resolveSidebarLocale(lang?: string | null): SidebarLocale {
  const base = lang?.toLowerCase().split("-")[0] ?? ""
  return (SIDEBAR_LOCALES as readonly string[]).includes(base)
    ? (base as SidebarLocale)
    : DEFAULT_SIDEBAR_LOCALE
}

export function getSidebarLabels(lang?: string | null): SidebarLabelSet {
  return SIDEBAR_LABELS[resolveSidebarLocale(lang)]
}
