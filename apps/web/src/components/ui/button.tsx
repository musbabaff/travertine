import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-50 select-none";
const variants: Record<Variant, string> = {
  primary: "bg-teal-700 text-white hover:bg-teal-600 active:bg-teal-700",
  secondary: "bg-surface text-ink border border-border-strong hover:bg-sunken",
  ghost: "text-teal-700 hover:bg-teal-100",
};
const sizes: Record<Size, string> = {
  md: "h-11 px-4 text-sm md:h-10",
  sm: "h-9 px-3 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />;
});
