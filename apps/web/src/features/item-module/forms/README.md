# Item forms (create / update)

Notes for AI agents working on the item forms. Backend rules live in `apps/server/src/api/modules/item/SPEC.md` (sections 7 and 8).

## Create item: 3 steps
`create-item-form.tsx` uses `MultiStepFlow` (`@workspace/ui/blocks/multi-step`).

1. **Details**: name, category, unit or unit collection, tracking flags, reorder point.
2. **Prices** (optional): cost and selling price of the base unit, plus one optional cost/selling price per other unit of the picked collection (`unit-prices-fields.tsx`). Example: a ton can be cheaper per kg than a kg. The per-unit equivalence hint ("1 t = 1000 kg") renders the API's padded factor through `trimDecimal`.
3. **Opening stock** (optional): only shown when the item is inventory tracked.

The create dialog is wider than the edit dialog (`sm:max-w-3xl` vs `sm:max-w-xl` in `item-dialog.tsx`) and each opening stock line stacks its fields so none are truncated.

Next validates only the fields of the current step (`STEP_FIELDS`). Enter does not submit before the last step.

## Per-unit prices
- Stored in `item_unit_prices` (one row per item and non-base unit). The price is per 1 of that unit.
- The item's own `costPrice` / `sellingPrice` are the base unit prices.
- They are stored defaults only. Nothing server-side consumes them yet.
- The item details page (Overview tab) shows a Prices table: base unit row plus one row per priced unit, padded API values trimmed with `trimDecimal`. Hidden when no price is set (`details/item-details-view.tsx`, strings `details.prices.*`).
- The update form edits them too. The update request replaces the whole set.

## Opening stock lines
- A line starts empty: the form defaults carry one blank line (`BLANK_OPENING_LINE`).
- Each line takes three rows: location and unit, each full width, on row 1; quantity and cost on row 2; **posting date** and manufactured date (expiry-tracked items) on row 3. There is no form-level posting date any more.
- Each line has a unit (blank = base unit). Quantity and cost are entered in that unit and converted to the base unit by the server.
- A blank line cost falls back to the cost price set for that line's unit. The fallback is a visible prefill (`LineCard` in `opening-stock-fields.tsx` sets the cost field when the picked unit changes, keeping a value the user typed) and `toCreateItemInput` repeats it at submit as a safety net.
- `unitId` is only sent when it differs from the base unit.

## Files
- `item-form-schema.ts`: schema, defaults, `toCreateItemInput`, `toUpdateItemInput`, `toUnitPricesInput`.
- `collection-units.ts`: maps a unit collection DTO to field options.
- `create-item.tsx` loads the picked collection with `useUnitCollection` and passes its units down.
- Strings: `packages/contracts/src/item/locales/{en,ar}.json` (`create.steps.*`, `fields.unitPrices.*`, `fields.openingStock.line.*`).
