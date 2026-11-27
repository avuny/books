# Item forms (create / update)

Notes for AI agents working on the item forms. Backend rules live in `apps/server/src/api/modules/item/SPEC.md` (sections 7 and 8).

## Create item: 3 steps
`create-item-form.tsx` uses `MultiStepFlow` (`@workspace/ui/blocks/multi-step`).

1. **Details**: name, category, unit or unit collection, tracking flags, reorder point.
2. **Prices** (optional): cost and selling price of the base unit, plus one optional cost/selling price per other unit of the picked collection (`unit-prices-fields.tsx`). Example: a ton can be cheaper per kg than a kg.
3. **Opening stock** (optional): only shown when the item is inventory tracked.

Next validates only the fields of the current step (`STEP_FIELDS`). Enter does not submit before the last step.

## Per-unit prices
- Stored in `item_unit_prices` (one row per item and non-base unit). The price is per 1 of that unit.
- The item's own `costPrice` / `sellingPrice` are the base unit prices.
- They are stored defaults only. Nothing server-side consumes them yet.
- The item details page (Overview tab) shows a Prices table: base unit row plus one row per priced unit, padded API values trimmed with `trimDecimal`. Hidden when no price is set (`details/item-details-view.tsx`, strings `details.prices.*`).
- The update form edits them too. The update request replaces the whole set.

## Opening stock lines
- A line starts empty: the form defaults carry one blank line (`BLANK_OPENING_LINE`).
- Each line takes two rows: location, unit, quantity, cost on row 1; manufactured date and **posting date** on row 2. There is no form-level posting date any more.
- Each line has a unit (blank = base unit). Quantity and cost are entered in that unit and converted to the base unit by the server.
- A blank line cost falls back to the cost price set for that line's unit (`toCreateItemInput`).
- `unitId` is only sent when it differs from the base unit.

## Files
- `item-form-schema.ts`: schema, defaults, `toCreateItemInput`, `toUpdateItemInput`, `toUnitPricesInput`.
- `collection-units.ts`: maps a unit collection DTO to field options.
- `create-item.tsx` loads the picked collection with `useUnitCollection` and passes its units down.
- Strings: `packages/contracts/src/item/locales/{en,ar}.json` (`create.steps.*`, `fields.unitPrices.*`, `fields.openingStock.line.*`).
