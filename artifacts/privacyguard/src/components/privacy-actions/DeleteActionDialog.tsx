import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PrivacyAction } from '@/lib/privacy-actions';
import { Loader2, Trash2 } from 'lucide-react';

interface DeleteActionDialogProps {
  action: PrivacyAction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export function DeleteActionDialog({
  action,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteActionDialogProps) {
  if (!action) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent
        className="max-w-[420px] rounded-3xl border border-[#eed9cf] bg-[#fffbf9] p-6 shadow-2xl sm:p-7 dark:border-[#44221e] dark:bg-[#1a1211]"
        data-testid="dialog-delete-action-confirmation"
      >
        <DialogHeader className="text-left">
          <div className="mb-2 grid size-10 place-items-center rounded-2xl bg-[#ffeae6] text-[#be4339] dark:bg-[#2c1816] dark:text-[#f19389]">
            <Trash2 size={19} />
          </div>
          <DialogTitle
            className="font-display text-lg font-extrabold tracking-[-.025em] text-[#291815] dark:text-[#f7e8e6]"
            data-testid="text-delete-dialog-title"
          >
            Delete Privacy Action?
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-relaxed text-[#7e5c56] dark:text-[#af8781]">
            Are you sure you want to delete this action? This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-xl border border-[#eed9cf] bg-white p-3 dark:border-[#381f1b] dark:bg-[#1f1514]">
          <p className="text-xs font-bold text-[#2e1d1a] dark:text-[#f1dad7]">{action.title}</p>
          <p className="mt-0.5 text-[11px] text-[#78615c] dark:text-[#967d78]">{action.category}</p>
        </div>

        <DialogFooter className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded-full border border-[#cadccf] bg-white px-4 py-2 text-xs font-bold text-[#446557] hover:bg-[#edf5ee] focus:outline-none focus:ring-2 focus:ring-[#286253]/20 disabled:opacity-50 dark:border-[#2b443b] dark:bg-[#14201d] dark:text-[#8aa095] dark:hover:bg-[#1b2b25]"
            data-testid="button-cancel-delete"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#be4339] px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#a63930] focus:outline-none focus:ring-2 focus:ring-[#be4339]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#c94b41] dark:hover:bg-[#d95d53]"
            data-testid="button-confirm-delete"
          >
            {isDeleting && <Loader2 size={13} className="animate-spin" />}
            Delete
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
