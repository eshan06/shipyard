import { cn } from "@/lib/utils";

/**
 * A pulsing placeholder block used while content loads.
 *
 * @param props - Standard div props plus `className` (set width/height there).
 * @returns The rendered skeleton element.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
