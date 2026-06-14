"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Props for {@link ConfirmDialog}. */
export interface ConfirmDialogProps {
  /** Controlled open state. */
  open: boolean;
  /** Open-state change handler. */
  onOpenChange: (open: boolean) => void;
  /** Dialog title. */
  title: string;
  /** Dialog body/description. */
  description: React.ReactNode;
  /** Confirm button label (default "Confirm"). */
  confirmLabel?: string;
  /** Confirm button variant (default "default"). */
  confirmVariant?: ButtonProps["variant"];
  /** Async confirm handler; the dialog shows a spinner while it runs. */
  onConfirm: () => void | Promise<void>;
}

/**
 * A reusable confirmation dialog for irreversible/important actions. Shows a
 * loading spinner on the confirm button while the async handler runs and closes
 * itself on success.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "default",
  onConfirm,
}: ConfirmDialogProps): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);

  const handleConfirm = async (): Promise<void> => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={() => void handleConfirm()}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
