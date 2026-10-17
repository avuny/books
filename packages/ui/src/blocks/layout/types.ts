export type User = {
  name: string
  identifier: string
  avatar?: string | undefined
}

export type AppRouter = {
  push: (href: string) => void
  replace: (href: string) => void
}
