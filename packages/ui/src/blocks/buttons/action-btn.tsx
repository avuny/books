import { Edit, Link, Plus } from "lucide-react";

import { FilePenLine } from "lucide-react";
import { MouseEventHandler } from "react";
import clsx from "clsx";
import { Button } from "@workspace/ui/components/button";

const ActionButton = ({
  onClick,
  title,
  size = "default",
  type = "add",
}: {
  onClick: MouseEventHandler<HTMLButtonElement> | undefined;
  title: string;
  size?: "icon" | "default";
  type?: "add" | "edit";
}) => {
  return (
    <Button
      variant={size === "icon" ? "outline" : "default"}
      type="button"
      onClick={onClick}
      size={size}
    >
      <div className="flex gap-2 items-center justify-center">
        {type === "add" ? <Plus /> : <FilePenLine />}
        <p
          className={clsx(" text-center", {
            hidden: size === "icon",
          })}
        >
          {title}
        </p>
      </div>
    </Button>
  );
};

export default ActionButton;
