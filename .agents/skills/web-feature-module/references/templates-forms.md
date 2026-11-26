# Templates: forms (create + update + button + dialog)

Order: `project-form-types.ts` → `use-project-form-copy.ts` → pure forms → containers → button → dialog → barrel.

## forms/project-form-types.ts

```ts
import type { FieldCopy } from "@workspace/ui/blocks/types"

/** Localized strings shared by the create and update forms. */
export type ProjectFormCopy = {
  title: string
  description: string
  name: FieldCopy                 // { label, placeholder }
  projectDescription: FieldCopy   // avoid the key "description": it clashes with the form description above
  submitLabel: string
  submittingLabel: string
}
```

## forms/use-project-form-copy.ts

```ts
import { useTranslation } from "react-i18next"
import type { ProjectFormCopy } from "./project-form-types"

/** Builds the localized strings for the create or update form. */
export function useProjectFormCopy(mode: "create" | "update"): ProjectFormCopy {
  const { t } = useTranslation("project")
  return {
    title: t(`${mode}.title`),
    description: t(`${mode}.description`),
    name: { label: t("fields.name.label"), placeholder: t("fields.name.placeholder") },
    projectDescription: {
      label: t("fields.description.label"),
      placeholder: t("fields.description.placeholder"),
    },
    submitLabel: t(`${mode}.submitLabel`),
    submittingLabel: t(`${mode}.submittingLabel`),
  }
}
```

## forms/create-project-form.tsx — PURE

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CreateProjectSchema } from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"

import type { CreateProjectInput } from "../types"
import type { ProjectFormCopy } from "./project-form-types"

import type { z } from "@avuny/zod"

export type CreateProjectFormValues = CreateProjectInput
type CreateProjectFormInput = z.input<typeof CreateProjectSchema>   // pre-transform shape

type CreateProjectFormProps = {
  copy: ProjectFormCopy
  onSubmit: (values: CreateProjectFormValues) => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function CreateProjectForm({ copy, onSubmit, isPending, errorMessage }: CreateProjectFormProps) {
  // generics: <input shape, context, output shape>
  const form = useForm<CreateProjectFormInput, unknown, CreateProjectFormValues>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: { name: "", description: "" },
  })

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        <InputField
          control={form.control}
          name="name"
          copy={copy.name}
          type="text"
          autoComplete="off"
          autoFocus
          disabled={isPending}
        />
        <InputField
          control={form.control}
          name="description"
          copy={copy.projectDescription}
          type="text"
          autoComplete="off"
          disabled={isPending}
        />
        <SubmitButton
          className="w-full"
          loading={isPending}
          label={copy.submitLabel}
          loadingLabel={copy.submittingLabel}
        />
      </form>
    </FormShell>
  )
}
```

Custom field (not text)? Wrap with `Controller` like `RolePermissionsField` in `create-role-form.tsx`:

```tsx
<Controller
  control={form.control}
  name="permissions"
  render={({ field, fieldState }) => (
    <MyField value={field.value ?? []} onChange={field.onChange}
             disabled={isPending} errorMessage={fieldState.error?.message} />
  )}
/>
```

## forms/update-project-form.tsx — PURE

Same as create, plus a `project: ProjectDto` prop used for `defaultValues`, and `UpdateProjectSchema`:

```tsx
const form = useForm<UpdateProjectFormInput, unknown, UpdateProjectFormValues>({
  resolver: zodResolver(UpdateProjectSchema),
  defaultValues: { name: project.name, description: project.description ?? "" },
})
```

## forms/create-project.tsx — CONTAINER

```tsx
import { useState } from "react"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { normalizeProject, useCreateProjectMutation } from "../project-api"
import type { ProjectDto } from "../types"
import { CreateProjectForm, type CreateProjectFormValues } from "./create-project-form"
import { useProjectFormCopy } from "./use-project-form-copy"

type CreateProjectProps = {
  orgId: string
  onSuccess?: (project: ProjectDto) => void   // the caller decides what happens next
}

// Composition only: strings + API behavior wired into the pure form.
export function CreateProject({ orgId, onSuccess }: CreateProjectProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const createMutation = useCreateProjectMutation(orgId)
  const copy = useProjectFormCopy("create")

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: CreateProjectFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({
        orgId,
        data: { ...values, description: values.description?.trim() || null }, // "" → null
      })
      onSuccess?.(normalizeProject(response.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <CreateProjectForm
      copy={copy}
      onSubmit={handleSubmit}
      isPending={createMutation.isPending}
      errorMessage={serverError}
    />
  )
}
```

## forms/update-project.tsx — CONTAINER (loads by id)

List rows don't carry every field, so load the record by id, show a skeleton, then render the pure form:

```tsx
const { project, isLoading, error } = useProject(orgId, projectId)
// …mutation + handleSubmit like create, but mutateAsync({ orgId, projectId, data })

if (isLoading) {
  return (
    <div className="grid gap-4" aria-busy>
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  )
}
if (!project) {
  return <p role="alert" className="text-sm text-destructive">{error ? parseApiError(error).message : null}</p>
}
return <UpdateProjectForm copy={copy} project={project} onSubmit={handleSubmit}
         isPending={updateMutation.isPending} errorMessage={serverError} />
```

## forms/project-button.tsx

One component, two modes: no `projectId` → "Create" (primary button, `Plus`); with `projectId` → "Edit" (`Pencil`, outline or icon button via `display`).

```tsx
type ProjectButtonProps = {
  orgId: string
  /** Given: opens the update dialog. Omitted: opens the create dialog. */
  projectId?: string
  display?: "icon" | "text"   // update only
  className?: string
}
// state: const [open, setOpen] = useState(false)
// label: t(isUpdate ? "actions.edit" : "actions.create")
// icon-only button MUST have aria-label={label}; icons get aria-hidden
// renders trigger + <ProjectDialog orgId projectId open onOpenChange={setOpen} />
```

## forms/project-dialog.tsx

```tsx
export function ProjectDialog({ orgId, projectId, open, onOpenChange }: ProjectDialogProps) {
  const { t } = useTranslation("project")
  const mode = projectId ? "update" : "create"
  const close = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {/* The form's own heading is visible; this one names the dialog for screen readers. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>
        {projectId ? (
          <UpdateProject key={projectId} orgId={orgId} projectId={projectId} onSuccess={close} />
        ) : (
          <CreateProject orgId={orgId} onSuccess={close} />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

`key={projectId}` resets form state when a different record opens. The list uses `ProjectDialog` directly for the row-menu "Edit" (a menu item can't own a dialog).
