export const ROUTES = {
  app: {
    main: "/organization",
    index: (organizationId?: string) =>
      `/organization${organizationId ? `/${organizationId}` : ""}`,
    create_org: "/organization/create",
    overview: (organizationId: string) =>
      `/organization/${organizationId}` as const,
    users: (organizationId: string) =>
      `/organization/${organizationId}/users` as const,
    roles: (organizationId: string) =>
      `/organization/${organizationId}/role` as const,
    settings: (organizationId: string) =>
      `/organization/${organizationId}/settings`,
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
