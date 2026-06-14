import * as React from "react";

import { cn } from "@/lib/utils";

/** Props for {@link Input}. Mirrors the native `<input>` props. */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * A styled text input matching the design system. Forwards its ref to the
 * underlying `<input>` element.
 *
 * @param props - Standard input props (plus `className`).
 * @returns The rendered input element.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
