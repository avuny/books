import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"

import { LineItems } from "./line-items"
import type { AsyncOptionsSource } from "./async-combobox"

type FormValues = {
  lines: Array<{
    itemId: string
    quantity: string
  }>
}

const mockSource: AsyncOptionsSource = {
  options: [
    { id: "item-1", name: "Item One" },
    { id: "item-2", name: "Item Two" },
  ],
  hasNextPage: false,
  isLoading: false,
  isSearching: false,
  isError: false,
  isFetchingNextPage: false,
  search: "",
  onSearchChange: vi.fn(),
  onOpenChange: vi.fn(),
  fetchNextPage: vi.fn(),
  retry: vi.fn(),
}

const mockComboboxCopy = {
  loading: "Loading...",
  loadingMore: "Loading more...",
  empty: "No items found",
  error: "Error loading items",
  retry: "Retry",
}

function TestForm({
  onItemChange,
}: {
  onItemChange?: (index: number, itemId: string) => void
}) {
  const form = useForm<FormValues>({
    defaultValues: {
      lines: [
        {
          itemId: "",
          quantity: "1",
        },
      ],
    },
  })

  return (
    <form>
      <LineItems
        control={form.control}
        name="lines"
        blankLine={{ itemId: "", quantity: "1" }}
        copy={{
          title: "Items",
          addLine: "Add row",
          removeLine: "Remove row",
          noLines: "No rows",
        }}
        itemSource={mockSource}
        itemComboboxCopy={mockComboboxCopy}
        onItemChange={onItemChange}
        renderFields={({ index, disabled }) => (
          <input
            data-testid={`qty-${index}`}
            disabled={disabled}
            {...form.register(`lines.${index}.quantity` as const)}
          />
        )}
      />
    </form>
  )
}

describe("LineItems", () => {
  it("renders at least one initial line with custom fields disabled until item is picked", () => {
    render(<TestForm />)

    // Row 1 elements should be rendered
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1)

    // Since itemId is empty, custom field input is disabled
    const qtyInput = screen.getByTestId("qty-0")
    expect(qtyInput).toBeDisabled()
  })

  it("calls onItemChange and auto-appends when an item is selected", async () => {
    const onItemChange = vi.fn()

    let formSetItem: (val: string) => void = () => {}

    function DynamicTestForm() {
      const form = useForm<FormValues>({
        defaultValues: {
          lines: [{ itemId: "", quantity: "1" }],
        },
      })

      formSetItem = (val: string) => {
        form.setValue("lines.0.itemId", val)
      }

      return (
        <form>
          <LineItems
            control={form.control}
            name="lines"
            blankLine={{ itemId: "", quantity: "1" }}
            copy={{
              title: "Items",
              addLine: "Add row",
              removeLine: "Remove row",
            }}
            itemSource={mockSource}
            itemComboboxCopy={mockComboboxCopy}
            onItemChange={onItemChange}
            renderFields={({ index, disabled }) => (
              <input
                data-testid={`qty-${index}`}
                disabled={disabled}
                {...form.register(`lines.${index}.quantity` as const)}
              />
            )}
          />
        </form>
      )
    }

    render(<DynamicTestForm />)

    // Initially disabled
    expect(screen.getByTestId("qty-0")).toBeDisabled()

    // Select an item on line 0
    formSetItem("item-1")

    // Custom field in row 0 should now be enabled
    await waitFor(() => {
      expect(screen.getByTestId("qty-0")).toBeEnabled()
    })

    // onItemChange should have fired
    await waitFor(() => {
      expect(onItemChange).toHaveBeenCalledWith(0, "item-1")
    })

    // Since row 0 was the last row, a new blank row 1 is auto-appended (and NOT duplicated)
    await waitFor(() => {
      expect(screen.getByTestId("qty-1")).toBeInTheDocument()
      expect(screen.getByTestId("qty-1")).toBeDisabled()
      expect(screen.queryByTestId("qty-2")).not.toBeInTheDocument()
    })
  })
})
