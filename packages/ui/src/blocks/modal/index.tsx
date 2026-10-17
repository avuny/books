"use client"

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { ReactElement, ReactNode } from "react"

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactElement
  children: ReactNode
  contentClassName?: string
}

export function Modal({
  open,
  onOpenChange,
  trigger,
  children,
  contentClassName,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className={cn(contentClassName)}>{children}</DialogContent>
    </Dialog>
  )
}
