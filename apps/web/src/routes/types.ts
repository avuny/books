import type { FileRoutesByTo } from "@/routeTree.gen"

type StaticRoutePath<T extends string> = T extends `${string}$${string}`
  ? never
  : T

export type AppRoutePath = StaticRoutePath<keyof FileRoutesByTo>
