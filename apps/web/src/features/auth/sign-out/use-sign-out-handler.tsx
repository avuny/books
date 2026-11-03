
import { toast } from "sonner"


import { useQueryClient } from "@tanstack/react-query"
import { useSelectedOrganizationContext } from "@workspace/ui/providers/selected-org-provider"
import { useSignOut } from "@/api"
import { useTranslation } from "react-i18next"
export function useSignOutHandler() {
    const { clearSelectedOrganizationId } = useSelectedOrganizationContext()
    const { t } = useTranslation("common")
    const queryClient = useQueryClient()
    const { mutateAsync: logoutMutate, isPending } = useSignOut({
        mutation: {
            onSuccess: () => {
                queryClient.resetQueries()
                localStorage.removeItem("accessToken")
                clearSelectedOrganizationId()
                toast(t("status.success"))

                location.reload()
            },
        },
    })

    const submit = async () => {
        await logoutMutate()
    }

    return { submit, isPending }
}