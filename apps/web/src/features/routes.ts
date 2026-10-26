export const ROUTES = {
  app: {
    main: "/organization",
    index: (organizationId?: string) =>
      `/organization${organizationId ? `/${organizationId}` : ""}`,
    create_org: "/organization/create",
  },
  auth: {
    index: "/auth",
    forget_password: "/auth/forget-password",
  },
  user: {
    index: "/user",
    settings: "/user/settings",
  },

  home: "/",
}
