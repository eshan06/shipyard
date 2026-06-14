"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Props for {@link CopyButton}. */
export interface CopyButtonProps {
  /** The text copied to the clipboard. */
  value: string;
  /** Accessible label / tooltip (default "Copy"). */
  label?: string;
  /** Toast shown on success (default "Copied to clipboard"). */
  successMessage?: string;
  /** Button size (default "icon"). */
  size?: ButtonProps["size"];
  /** Button variant (default "ghost"). */
  variant?: ButtonProps["variant"];
  /** Extra classes. */
  className?: string;
}

/**
 * A small button that copies `value` to the clipboard, briefly swapping its
 * icon to a checkmark and toasting on success. Falls back gracefully when the
 * Clipboard API is unavailable.
 */
export function CopyButton({
  value,
  label = "Copy",
  successMessage = "Copied to clipboard",
  size = "icon",
  variant = "ghost",
  className,
}: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => void onCopy()}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="size-4 text-success" />
      ) : (
        <Copy className="size-4" />
      )}
    </Button>
  );
}
