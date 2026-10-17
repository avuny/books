export const renderLogo = (
  Logo: React.ElementType | undefined,
  name: string
) => {
  return Logo ? (
    <Logo className="size-4 shrink-0" />
  ) : (
    <span className="text-xs font-semibold">
      {name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase())
        .slice(0, 2)
        .join("")}
    </span>
  );
};
