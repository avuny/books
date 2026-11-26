import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StepAlert } from "./step-alert"

describe("StepAlert", () => {
  it.each([undefined, null, ""])("renders nothing for %j", (message) => {
    const { container } = render(<StepAlert message={message} />)

    expect(container).toBeEmptyDOMElement()
  })

  it("shows the message as an alert", () => {
    render(<StepAlert message="Your code expired" />)

    expect(screen.getByRole("alert")).toHaveTextContent("Your code expired")
  })

  it("lets callers inject their own icon", () => {
    render(
      <StepAlert message="Heads up" icon={<svg data-testid="custom-icon" />} />
    )

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument()
  })
})
