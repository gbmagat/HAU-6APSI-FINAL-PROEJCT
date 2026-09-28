import type { ReactNode } from "react";

type PageHeadingProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
  align?: "center" | "left";
};

export function PageHeading({
  title,
  description,
  action,
  eyebrow = "Our shared places",
  align = "center",
}: PageHeadingProps) {
  return (
    <header className={`page-heading page-heading--${align}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-heading__description">{description}</p>}
      </div>
      {action && <div className="page-heading__action">{action}</div>}
    </header>
  );
}
