import Link from "next/link";
import clsx from "clsx";

type BrandVariant = "wordmark" | "icon" | "horizontal" | "full";

type BrandProps = {
  href?: string;
  variant?: BrandVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { icon: "h-8 w-8", logo: "h-7", text: "text-base" },
  md: { icon: "h-9 w-9", logo: "h-8", text: "text-base" },
  lg: { icon: "h-10 w-10", logo: "h-10", text: "text-lg" },
};

const logoSrc: Record<Exclude<BrandVariant, "wordmark">, string> = {
  icon: "/branding/ReceptaAI-logo-icon.svg",
  horizontal: "/branding/ReceptaAI-logo-horizontal-no-claim.svg",
  full: "/branding/ReceptaAI-logo-full-de.svg",
};

export function Brand({
  href = "/",
  variant = "wordmark",
  size = "md",
  className,
}: BrandProps) {
  const s = sizeMap[size];

  const Inner = (
    <div className={clsx("flex items-center gap-2", className)}>
      {variant === "icon" && (
        <div
          className={clsx(
            "relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200",
            s.icon
          )}
        >
          <img
            src={logoSrc.icon}
            alt="ReceptaAI"
            className="h-full w-full object-contain p-1.5"
            draggable={false}
          />
        </div>
      )}

      {variant === "horizontal" && (
        <img
          src={logoSrc.horizontal}
          alt="ReceptaAI"
          className={clsx("w-auto", s.logo)}
          draggable={false}
        />
      )}

      {variant === "full" && (
        <img
          src={logoSrc.full}
          alt="ReceptaAI"
          className={clsx("w-auto", s.logo)}
          draggable={false}
        />
      )}

      {variant === "wordmark" && (
        <span className={clsx("font-semibold tracking-tight", s.text)}>
          <span className="text-blue-600">Recepta</span>
          <span className="text-emerald-500">AI</span>
        </span>
      )}
    </div>
  );

  if (!href) return Inner;

  return (
    <Link href={href} className="inline-flex focus:outline-none">
      {Inner}
    </Link>
  );
}