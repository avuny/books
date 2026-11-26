export type User = {
  name: string
  identifier: string
  avatar?: string | undefined
}

export type AppRouter<TPath extends string = string> = {
  push: (href: TPath) => void
  replace: (href: TPath) => void
}

export type FieldCopy = {
  label: string
  placeholder?: string
  description?: string
  /** Show a required marker after the label. */
  required?: boolean
}

export type ErrorMessages = Partial<Record<string, string>> & {
  fallback: string
}
