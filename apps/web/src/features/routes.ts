export const ROUTES = {
  app: {
    index: (organizationId?: string) =>
      `/organization${organizationId ? `/${organizationId}` : ""}`,
    create_org: "/organization/create",
  },
  auth: {
    index: "/auth",
    forget_password: "/auth/forget-password",
  },

  home: "/",
}
