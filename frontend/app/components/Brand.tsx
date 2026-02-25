import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

type BrandVariant = "wordmark" | "icon" | "horizontal" | "full";

type BrandProps = {
  href?: string;
  variant?: BrandVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
};

const sizeMap = {
  sm: { icon: "h-8 w-8", logo: "h-7", text: "text-base" },
  md: { icon: "h-9 w-9", logo: "h-8", text: "text-base" },
  lg: { icon: "h-10 w-10", logo: "h-10", text: "text-lg" },
};

const logoSrc: Record<Exclude<BrandVariant, "wordmark">, string> = {
  icon: "public/branding/ReceptaAI-logo-icon.svg",
  horizontal: "public/branding/ReceptaAI-logo-horizontal-de.svg",
  full: "public/branding/ReceptaAI-logo-full-de.svg",
};

export function Brand({
  href = "/",
  variant = "wordmark",
  size = "md",
  className,
  priority = false,
}: BrandProps) {
  const s = sizeMap[size];

  const Inner = (
    <div className={clsx("flex items-center gap-2", className)}>
      {/* ICON-only */}
      {variant === "icon" && (
        <div
          className={clsx(
            "relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200",
            s.icon
          )}
        >
          <Image
            src={logoSrc.icon}
            alt="ReceptaAI"
            fill
            className="object-contain p-1.5"
            priority={priority}
          />
        </div>
      )}

      {/* SVG Logos */}
      {(variant === "horizontal" || variant === "full") && (
        <div className={clsx("relative w-auto", s.logo)}>
          <Image
            src={logoSrc[variant]}
            alt="ReceptaAI"
            fill
            className="object-contain"
            priority={priority}
          />
        </div>
      )}

      {/* Wordmark (Text) */}
      {variant === "wordmark" && (
        <>
          <div
            className={clsx(
              "relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200",
              s.icon
            )}
          >
            <Image
              src={logoSrc.icon}
              alt="ReceptaAI"
              fill
              className="object-contain p-1.5"
              priority={priority}
            />
          </div>

          <span className={clsx("font-semibold tracking-tight", s.text)}>
            <span className="text-blue-600">Recepta</span>
            <span className="text-emerald-500">AI</span>
          </span>
        </>
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