import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StepSwitch } from "./step-switch"

describe("StepSwitch", () => {
  it("renders only the active step", () => {
    const one = vi.fn(() => <p>first view</p>)
    const two = vi.fn(() => <p>second view</p>)

    render(<StepSwitch current="two" views={{ one, two }} />)

    expect(screen.getByText("second view")).toBeInTheDocument()
    expect(screen.queryByText("first view")).not.toBeInTheDocument()
    expect(one).not.toHaveBeenCalled()
  })

  it("renders nothing when the active view returns null", () => {
    const { container } = render(
      <StepSwitch
        current="one"
        views={{ one: () => null, two: () => <p>second view</p> }}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("mounts a fresh tree on step change, even for the same component", () => {
    const Field = () => <input aria-label="name" />
    const views = { one: () => <Field />, two: () => <Field /> }

    const { rerender } = render(<StepSwitch current="one" views={views} />)
    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "typed" },
    })

    rerender(<StepSwitch current="two" views={views} />)

    expect(screen.getByLabelText("name")).toHaveValue("")
  })
})
