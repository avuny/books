export type User = {
  name: string
  identifier: string
  avatar?: string | undefined
}

export type AppRouter = {
  push: (href: string) => void
  replace: (href: string) => void
}

export type FieldCopy = {
  label: string
  placeholder?: string
  description?: string
}

export type ErrorMessages = Partial<Record<string, string>> & { fallback: string }
