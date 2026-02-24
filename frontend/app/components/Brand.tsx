import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";

type BrandProps = {
  href?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: { icon: "h-8 w-8", text: "text-base" },
  md: { icon: "h-9 w-9", text: "text-base" },
  lg: { icon: "h-10 w-10", text: "text-lg" },
};

export function Brand({
  href = "/",
  showIcon = true,
  size = "md",
  className,
}: BrandProps) {
  const s = sizeMap[size];

  const Inner = (
    <div className={clsx("flex items-center gap-2", className)}>
      {showIcon && (
        <div
          className={clsx(
            "relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200",
            s.icon
          )}
        >
          <Image
            src="/branding/ReceptaAI-logo-icon.svg"
            alt="ReceptaAI"
            fill
            className="object-contain p-1.5"
            priority
          />
        </div>
      )}

      {/* Wordmark als Text (stabil, immer scharf, farb-sicher) */}
      <span className={clsx("font-semibold tracking-tight", s.text)}>
        <span className="text-blue-600">Recepta</span>
        <span className="text-emerald-500">AI</span>
      </span>
    </div>
  );

  // Falls du mal nicht verlinken willst:
  if (!href) return Inner;

  return (
    <Link href={href} className="inline-flex focus:outline-none">
      {Inner}
    </Link>
  );
}