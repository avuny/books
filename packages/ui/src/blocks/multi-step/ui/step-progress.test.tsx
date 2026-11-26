import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StepProgress } from "./step-progress"

const segmentsOf = (bar: HTMLElement) =>
  Array.from(bar.querySelectorAll("[data-state]"))

describe("StepProgress", () => {
  it("shows the injected label and exposes progress to assistive tech", () => {
    render(<StepProgress current={2} total={3} label="Step 2 of 3" />)

    const bar = screen.getByRole("progressbar", { name: "Step 2 of 3" })
    expect(bar).toHaveAttribute("aria-valuenow", "2")
    expect(bar).toHaveAttribute("aria-valuemax", "3")
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument()
  })

  it("fills every segment up to and including the current step", () => {
    render(<StepProgress current={2} total={3} label="Step 2 of 3" />)

    const states = segmentsOf(screen.getByRole("progressbar")).map((el) =>
      el.getAttribute("data-state")
    )
    expect(states).toEqual(["complete", "complete", "pending"])
  })

  it("renders one segment per step", () => {
    render(<StepProgress current={1} total={5} label="Step 1 of 5" />)

    expect(segmentsOf(screen.getByRole("progressbar"))).toHaveLength(5)
  })

  it("uses theme tokens so it follows light and dark mode", () => {
    render(<StepProgress current={1} total={2} label="Step 1 of 2" />)

    const [done, pending] = segmentsOf(screen.getByRole("progressbar"))
    expect(done).toHaveClass("bg-primary")
    expect(pending).toHaveClass("bg-muted")
    expect(screen.getByText("Step 1 of 2")).toHaveClass("text-muted-foreground")
  })

  it("merges a custom className onto the root", () => {
    render(<StepProgress current={1} total={2} label="x" className="mb-8" />)

    expect(screen.getByRole("progressbar")).toHaveClass("mb-8")
  })
})
