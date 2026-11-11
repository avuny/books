import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { Skeleton } from "@workspace/ui/components/skeleton"

import { UnitButton } from "../forms"
import { useUnit } from "../unit-api"
import type { UnitDetailsCopy } from "./unit-details-view"
import { UnitDetailsView } from "./unit-details-view"

type UnitDetailsProps = {
  orgId: string
  unitId: string
  onBack?: () => void
}

export function UnitDetails({ orgId, unitId, onBack }: UnitDetailsProps) {
  const { t, i18n } = useTranslation("unit")
  const { unit, isLoading } = useUnit(orgId, unitId)

  const formatDate = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso)),
    [i18n.language]
  )

  const copy = useMemo<UnitDetailsCopy>(
    () => ({
      back: t("details.back"),
      name: t("details.name"),
      symbol: t("details.symbol"),
      type: t("details.type"),
      status: t("details.status"),
      scope: t("details.scope"),
      createdAt: t("details.createdAt"),
      updatedAt: t("details.updatedAt"),
      systemNotice: t("details.systemNotice"),
      types: {
        count: t("type.count"),
        weight: t("type.weight"),
        length: t("type.length"),
        area: t("type.area"),
        volume: t("type.volume"),
      },
      labels: {
        system: t("labels.system"),
        custom: t("labels.custom"),
        active: t("status.active"),
        inactive: t("status.inactive"),
      },
      formatDate,
    }),
    [t, formatDate]
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        {t("errors.UNIT_NOT_FOUND")}
      </div>
    )
  }

  return (
    <UnitDetailsView
      unit={unit}
      copy={copy}
      onBack={onBack}
      actions={
        !unit.isSystem ? (
          <UnitButton orgId={orgId} unit={unit} />
        ) : undefined
      }
    />
  )
}

