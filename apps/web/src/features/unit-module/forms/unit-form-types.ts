import type { UnitType } from "../types"

export type CreateUnitFormValues = {
  name: string
  symbol: string
  type: UnitType
}

export type UpdateUnitFormValues = {
  name?: string
  symbol?: string
  isActive?: boolean
}

export type UnitFormCopy = {
  fields: {
    name: { label: string; placeholder: string }
    symbol: { label: string; placeholder: string }
    type: { label: string; placeholder: string; locked: string }
    isActive: { label: string; description: string }
  }
  types: Record<UnitType, string>
  actions: {
    cancel: string
  }
  create: {
    title: string
    description: string
    submitLabel: string
    submittingLabel: string
  }
  update: {
    title: string
    description: string
    submitLabel: string
    submittingLabel: string
  }
}

