"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { Building2, ChevronDown, MapPin, Search, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"

import { useListWarehouseLocations, useListWarehouses } from "@/api"

export interface WarehouseLocationFilterValue {
  warehouseIds: string[]
  locationIds: string[]
}

export interface WarehouseLocationFilterProps {
  orgId: string
  value: WarehouseLocationFilterValue
  onChange: (value: WarehouseLocationFilterValue) => void
  disabled?: boolean
  className?: string
  /** If true, strictly physical non-system warehouses and their locations are shown. Virtual warehouses are hidden. */
  physicalOnly?: boolean
}

function PhysicalVirtualBadge({
  isVirtual,
  physicalLabel,
  virtualLabel,
}: {
  isVirtual: boolean
  physicalLabel: string
  virtualLabel: string
}) {
  return isVirtual ? (
    <span className="inline-flex items-center rounded-sm border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
      {virtualLabel}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-sm border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
      {physicalLabel}
    </span>
  )
}

export function WarehouseLocationFilter({
  orgId,
  value,
  onChange,
  disabled = false,
  className,
  physicalOnly = false,
}: WarehouseLocationFilterProps) {
  const { t } = useTranslation("warehouse")

  const [warehouseOpen, setWarehouseOpen] = React.useState(false)
  const [locationOpen, setLocationOpen] = React.useState(false)
  const [warehouseSearch, setWarehouseSearch] = React.useState("")
  const [locationSearch, setLocationSearch] = React.useState("")

  const copy = React.useMemo(
    () => ({
      allWarehouses: t("filter.allWarehouses", "<All warehouses>"),
      allLocations: t("filter.allLocations", "<All locations>"),
      searchWarehouse: t("filter.searchWarehouse", "Search warehouses..."),
      searchLocation: t("filter.searchLocation", "Search locations..."),
      noWarehouses: t("filter.noWarehouses", "No warehouses found"),
      noLocations: t("filter.noLocations", "No locations found"),
      physical: t("filter.physical", "Physical"),
      virtual: t("filter.virtual", "Virtual"),
      selectedCount: (count: number) =>
        t("filter.selectedCount", { count, defaultValue: `${count} selected` }),
    }),
    [t]
  )

  // Fetch active warehouses
  const { data: warehousesData, isLoading: isLoadingWarehouses } =
    useListWarehouses(orgId, {
      pageSize: 100,
      isActive: "true",
    })

  const warehouses = React.useMemo(() => {
    const items = warehousesData?.data.items ?? []
    if (physicalOnly) {
      return items.filter((w) => w.type === "physical" && !w.isSystem)
    }
    return items
  }, [warehousesData, physicalOnly])

  // Filtered warehouses by search input
  const filteredWarehouses = React.useMemo(() => {
    if (!warehouseSearch.trim()) return warehouses
    const term = warehouseSearch.toLowerCase()
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        w.code.toLowerCase().includes(term)
    )
  }, [warehouses, warehouseSearch])

  // Primary selected warehouse for querying locations
  const primaryWarehouseId = value.warehouseIds[0]

  // Fetch stockable locations for the selected warehouse
  const { data: locationsData, isLoading: isLoadingLocations } =
    useListWarehouseLocations(
      orgId,
      {
        warehouseId: primaryWarehouseId,
        pageSize: 100,
        isStockable: "true",
        isActive: "true",
      },
      {
        query: {
          enabled: Boolean(primaryWarehouseId && value.warehouseIds.length > 0),
        },
      }
    )

  const locations = React.useMemo(
    () => locationsData?.data.items ?? [],
    [locationsData]
  )

  // Filtered locations by search input
  const filteredLocations = React.useMemo(() => {
    if (!locationSearch.trim()) return locations
    const term = locationSearch.toLowerCase()
    return locations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(term) ||
        loc.fullCode.toLowerCase().includes(term)
    )
  }, [locations, locationSearch])

  // Warehouse selection toggler
  const toggleWarehouse = (warehouseId: string) => {
    const isSelected = value.warehouseIds.includes(warehouseId)
    let nextWarehouses: string[]
    if (isSelected) {
      nextWarehouses = value.warehouseIds.filter((id) => id !== warehouseId)
    } else {
      nextWarehouses = [...value.warehouseIds, warehouseId]
    }

    // Reset location selection if warehouse selection changed
    onChange({
      warehouseIds: nextWarehouses,
      locationIds: [],
    })
  }

  const selectAllWarehouses = () => {
    onChange({
      warehouseIds: [],
      locationIds: [],
    })
    setWarehouseOpen(false)
  }

  // Location selection toggler
  const toggleLocation = (locationId: string) => {
    const isSelected = value.locationIds.includes(locationId)
    let nextLocations: string[]
    if (isSelected) {
      nextLocations = value.locationIds.filter((id) => id !== locationId)
    } else {
      nextLocations = [...value.locationIds, locationId]
    }
    onChange({
      ...value,
      locationIds: nextLocations,
    })
  }

  const selectAllLocations = () => {
    onChange({
      ...value,
      locationIds: [],
    })
    setLocationOpen(false)
  }

  // Trigger labels
  const warehouseLabel = React.useMemo(() => {
    if (value.warehouseIds.length === 0) return copy.allWarehouses
    if (value.warehouseIds.length === 1) {
      const found = warehouses.find((w) => w.id === value.warehouseIds[0])
      return found ? found.name : copy.selectedCount(1)
    }
    return copy.selectedCount(value.warehouseIds.length)
  }, [value.warehouseIds, warehouses, copy])

  const locationLabel = React.useMemo(() => {
    if (value.locationIds.length === 0) return copy.allLocations
    if (value.locationIds.length === 1) {
      const found = locations.find((l) => l.id === value.locationIds[0])
      return found ? found.fullCode || found.name : copy.selectedCount(1)
    }
    return copy.selectedCount(value.locationIds.length)
  }, [value.locationIds, locations, copy])

  const hasWarehouseSelected = value.warehouseIds.length > 0

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Warehouse Combobox */}
      <Popover open={warehouseOpen} onOpenChange={setWarehouseOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isLoadingWarehouses}
              className={cn(
                "h-9 justify-between gap-2 border-dashed font-normal",
                hasWarehouseSelected &&
                  "border-solid font-medium text-foreground"
              )}
            />
          }
        >
          <div className="flex items-center gap-1.5 truncate">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{warehouseLabel}</span>
          </div>
          {hasWarehouseSelected ? (
            <span
              role="button"
              tabIndex={0}
              className="ms-1 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                selectAllWarehouses()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation()
                  selectAllWarehouses()
                }
              }}
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={copy.searchWarehouse}
                value={warehouseSearch}
                onChange={(e) => setWarehouseSearch(e.target.value)}
                className="h-9 ps-8 text-xs"
              />
            </div>

            <div className="max-h-60 space-y-1 overflow-y-auto">
              {/* <All warehouses> option */}
              <div
                role="button"
                tabIndex={0}
                onClick={selectAllWarehouses}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") selectAllWarehouses()
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                  value.warehouseIds.length === 0 && "bg-muted font-medium"
                )}
              >
                <Checkbox
                  checked={value.warehouseIds.length === 0}
                  onCheckedChange={selectAllWarehouses}
                  aria-label={copy.allWarehouses}
                />
                <span className="truncate">{copy.allWarehouses}</span>
              </div>

              {filteredWarehouses.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {copy.noWarehouses}
                </div>
              ) : (
                filteredWarehouses.map((wh) => {
                  const isChecked = value.warehouseIds.includes(wh.id)
                  const isVirtual = wh.type === "virtual"
                  return (
                    <div
                      key={wh.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleWarehouse(wh.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          toggleWarehouse(wh.id)
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                        isChecked && "bg-muted/70 font-medium"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleWarehouse(wh.id)}
                          aria-label={wh.name}
                        />
                        <span className="truncate">{wh.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          ({wh.code})
                        </span>
                      </div>
                      {!physicalOnly && (
                        <PhysicalVirtualBadge
                          isVirtual={isVirtual}
                          physicalLabel={copy.physical}
                          virtualLabel={copy.virtual}
                        />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Location Combobox - Appears when a warehouse is checked */}
      {hasWarehouseSelected ? (
        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isLoadingLocations}
                className={cn(
                  "h-9 animate-in justify-between gap-2 border-dashed font-normal duration-200 fade-in-50",
                  value.locationIds.length > 0 &&
                    "border-solid font-medium text-foreground"
                )}
              />
            }
          >
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{locationLabel}</span>
            </div>
            {value.locationIds.length > 0 ? (
              <span
                role="button"
                tabIndex={0}
                className="ms-1 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  selectAllLocations()
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation()
                    selectAllLocations()
                  }
                }}
              >
                <X className="size-3" />
              </span>
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            )}
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={copy.searchLocation}
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  className="h-9 ps-8 text-xs"
                />
              </div>

              <div className="max-h-60 space-y-1 overflow-y-auto">
                {/* <All locations> option */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={selectAllLocations}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") selectAllLocations()
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                    value.locationIds.length === 0 && "bg-muted font-medium"
                  )}
                >
                  <Checkbox
                    checked={value.locationIds.length === 0}
                    onCheckedChange={selectAllLocations}
                    aria-label={copy.allLocations}
                  />
                  <span className="truncate">{copy.allLocations}</span>
                </div>

                {filteredLocations.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    {copy.noLocations}
                  </div>
                ) : (
                  filteredLocations.map((loc) => {
                    const isChecked = value.locationIds.includes(loc.id)
                    const isVirtual = loc.type === "virtual_bin"
                    return (
                      <div
                        key={loc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleLocation(loc.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            toggleLocation(loc.id)
                        }}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted",
                          isChecked && "bg-muted/70 font-medium"
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleLocation(loc.id)}
                            aria-label={loc.fullCode || loc.name}
                          />
                          <span className="truncate font-mono text-[11px]">
                            {loc.fullCode}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {loc.name}
                          </span>
                        </div>
                        <PhysicalVirtualBadge
                          isVirtual={isVirtual}
                          physicalLabel={copy.physical}
                          virtualLabel={copy.virtual}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}
