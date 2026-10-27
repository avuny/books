import { useEffect, useState } from "react"
import { Building2Icon, PlusCircleIcon } from "lucide-react"
import type { OrganizationDto } from "@avuny/contracts/organization"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
} from "@workspace/ui/components/combobox"

export type OrganizationComboboxCopy = {
  placeholder: string
  searchPlaceholder: string
  noResults: string
  createAction: string
}

type OrganizationComboboxProps = {
  organizations: OrganizationDto[]
  selectedOrgId?: string
  copy: OrganizationComboboxCopy
  onSelect: (orgId: string) => void
  onCreate: () => void
  className?: string
  disabled?: boolean
}

export function OrganizationCombobox({
  organizations,
  selectedOrgId,
  copy,
  onSelect,
  onCreate,
  className,
  disabled = false,
}: OrganizationComboboxProps) {
  const selectedOrg = organizations.find((o) => o.id === selectedOrgId)
  const [inputValue, setInputValue] = useState(
    selectedOrg ? selectedOrg.name : ""
  )

  useEffect(() => {
    if (selectedOrg) {
      setInputValue(selectedOrg.name)
    } else if (!selectedOrgId) {
      setInputValue("")
    }
  }, [selectedOrg, selectedOrgId])

  const handleValueChange = (val: string | null) => {
    if (!val) return
    if (val === "__create__") {
      onCreate()
      return
    }
    const matched = organizations.find((o) => o.id === val)
    if (matched) {
      setInputValue(matched.name)
      onSelect(matched.id)
    }
  }

  return (
    <div className={className}>
      <Combobox
        value={selectedOrgId ?? null}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <ComboboxInput
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={copy.searchPlaceholder || copy.placeholder}
          showTrigger
          disabled={disabled}
          className="w-full sm:w-64"
        />

        <ComboboxContent align="start" className="w-(--anchor-width) min-w-64">
          <ComboboxList>
            <ComboboxEmpty>{copy.noResults}</ComboboxEmpty>

            {organizations.map((org) => (
              <ComboboxItem
                key={org.id}
                value={org.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-foreground">
                    {org.name}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {org.code}
                </span>
              </ComboboxItem>
            ))}

            <ComboboxSeparator />

            <ComboboxItem
              value="__create__"
              className="flex cursor-pointer items-center gap-2 py-2 font-medium text-primary hover:text-primary"
            >
              <PlusCircleIcon className="size-4 shrink-0 text-primary" />
              <span>{copy.createAction}</span>
            </ComboboxItem>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
