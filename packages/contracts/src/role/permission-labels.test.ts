import { describe, expect, it } from "vitest"
import { PERMISSION_RESOURCES } from "./permission-catalog.js"
import ar from "./locales/ar.json"
import en from "./locales/en.json"

describe("permission resource labels (audit B12)", () => {
  for (const [name, locale] of [
    ["en", en],
    ["ar", ar],
  ] as const) {
    it(`${name} has a label for every permission resource`, () => {
      const labels = locale.labels.resources as Record<string, string>
      const missing = PERMISSION_RESOURCES.filter((r) => !labels[r])
      expect(missing).toEqual([])
    })
  }
})
