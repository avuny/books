"use client"

import { useState } from "react"
import { MoreVerticalIcon, Trash2Icon, PencilIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

export interface CustomDropdownMenuProps {
  onDelete?: () => Promise<void>
  onEdit?: () => Promise<void>
  actionTranslations?: (key: "delete" | "edit" | "cancel") => string
  msgTranslations?: (key: "confirmTitle" | "confirmDeleteDescription") => string
}

export function CustomDropdownMenu<DeleteArg, EditArg>({
  onDelete,
  onEdit,
  actionTranslations = (key) => key,
  msgTranslations = (key) => key,
}: CustomDropdownMenuProps) {
  const [open, setOpen] = useState(false)

  const editLabel = actionTranslations("edit")
  const deleteLabel = actionTranslations("delete")
  const cancelText = actionTranslations("cancel")

  const confirmTitle = msgTranslations("confirmTitle")
  const confirmDescription = msgTranslations("confirmDeleteDescription")
  const confirmActionText = deleteLabel

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="transition hover:bg-muted"
            >
              <MoreVerticalIcon className="h-4 w-4" />
            </Button>
          }
        ></DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-md">
          {onEdit && (
            <DropdownMenuItem
              onClick={() => onEdit()}
              className="flex cursor-pointer items-center gap-2"
            >
              <PencilIcon className="h-4 w-4" />
              <span>{editLabel}</span>
            </DropdownMenuItem>
          )}

          {onEdit && onDelete && <DropdownMenuSeparator />}

          {onDelete && (
            <DropdownMenuItem
              onClick={() => setOpen(true)}
              className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600"
            >
              <Trash2Icon className="h-4 w-4" />
              <span>{deleteLabel}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold">
              {confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">
              {cancelText}
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() => {
                setOpen(false)
                onDelete && onDelete()
              }}
              className="rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              {confirmActionText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
