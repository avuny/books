import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { StepPosition } from "../lib/steps"
import { MultiStepFlow } from "./multi-step-flow"
import type { StepProgressProps } from "./step-progress"

const base = {
  steps: ["identifier", "verify", "register"] as const,
  views: {
    identifier: () => <p>identifier view</p>,
    verify: () => <p>verify view</p>,
    register: () => <p>register view</p>,
  },
  formatLabel: ({ current, total }: StepPosition) =>
    `Step ${current} of ${total}`,
}

describe("MultiStepFlow", () => {
  it("renders the active view with matching progress", () => {
    render(<MultiStepFlow {...base} current="verify" />)

    expect(screen.getByText("verify view")).toBeInTheDocument()
    expect(screen.queryByText("identifier view")).not.toBeInTheDocument()
    expect(
      screen.getByRole("progressbar", { name: "Step 2 of 3" })
    ).toHaveAttribute("aria-valuenow", "2")
  })

  it("follows the step as it changes", () => {
    const { rerender } = render(<MultiStepFlow {...base} current="identifier" />)

    rerender(<MultiStepFlow {...base} current="register" />)

    expect(screen.getByText("register view")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3"
    )
  })

  it("lets callers inject their own progress component", () => {
    const Progress = ({ current, total, label }: StepProgressProps) => (
      <div data-testid="custom-progress">{`${label} (${current}/${total})`}</div>
    )

    render(<MultiStepFlow {...base} current="verify" Progress={Progress} />)

    expect(screen.getByTestId("custom-progress")).toHaveTextContent(
      "Step 2 of 3 (2/3)"
    )
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })
})
