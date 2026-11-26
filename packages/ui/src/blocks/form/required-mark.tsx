/** Red asterisk after a label for required fields. Hidden from screen readers (the asterisk is visual only). */
export function RequiredMark({ required }: { required?: boolean }) {
  if (!required) return null
  return (
    <span aria-hidden="true" className="ms-0.5 text-destructive">
      *
    </span>
  )
}
