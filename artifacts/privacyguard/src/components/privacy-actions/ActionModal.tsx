import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PRIVACY_ACTION_CATEGORIES,
  PRIVACY_ACTION_PRIORITIES,
  type PrivacyAction,
  type PrivacyActionCategory,
  type PrivacyActionPriority,
} from '@/lib/privacy-actions';
import { Loader2 } from 'lucide-react';

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: {
    title: string;
    description: string;
    category: PrivacyActionCategory;
    priority: PrivacyActionPriority;
  }) => Promise<void>;
  initialAction?: PrivacyAction | null;
  isSubmitting?: boolean;
}

export function ActionModal({
  isOpen,
  onClose,
  onSubmit,
  initialAction,
  isSubmitting = false,
}: ActionModalProps) {
  const isEditing = Boolean(initialAction);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PrivacyActionCategory>('Account Security');
  const [priority, setPriority] = useState<PrivacyActionPriority>('High');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialAction) {
      setTitle(initialAction.title);
      setDescription(initialAction.description || '');
      setCategory(actionCategoryOrFallback(initialAction.category));
      setPriority(actionPriorityOrFallback(initialAction.priority));
    } else {
      setTitle('');
      setDescription('');
      setCategory('Account Security');
      setPriority('High');
    }
    setError('');
  }, [initialAction, isOpen]);

  function actionCategoryOrFallback(cat: string): PrivacyActionCategory {
    if (PRIVACY_ACTION_CATEGORIES.includes(cat as PrivacyActionCategory)) {
      return cat as PrivacyActionCategory;
    }
    return 'Other';
  }

  function actionPriorityOrFallback(p: string): PrivacyActionPriority {
    if (PRIVACY_ACTION_PRIORITIES.includes(p as PrivacyActionPriority)) {
      return p as PrivacyActionPriority;
    }
    return 'High';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError('Please provide an action title.');
      return;
    }

    if (cleanTitle.length > 200) {
      setError('Title must be under 200 characters.');
      return;
    }

    if (description.length > 1000) {
      setError('Description must be under 1000 characters.');
      return;
    }

    setError('');
    await onSubmit({
      title: cleanTitle,
      description: description.trim(),
      category,
      priority,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        className="max-w-[480px] rounded-3xl border border-[#dce8df] bg-[#fbfdfa] p-6 shadow-2xl sm:p-7 dark:border-[#1f312b] dark:bg-[#14201d]"
        data-testid="dialog-privacy-action-modal"
      >
        <DialogHeader className="text-left">
          <DialogTitle
            className="font-display text-xl font-extrabold tracking-[-.03em] text-[#194338] dark:text-[#f1f7f3]"
            data-testid="text-action-modal-title"
          >
            {isEditing ? 'Edit Privacy Action' : 'Create Privacy Action'}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-[#6e8578] dark:text-[#8aa095]">
            {isEditing
              ? 'Update the details or priority of this action item.'
              : 'Add a targeted step to improve your personal privacy and digital safety.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            className="rounded-xl border border-[#f5c7c2] bg-[#fdf0ef] px-3.5 py-2.5 text-xs font-semibold text-[#b8372d] dark:border-[#4d2522] dark:bg-[#2c1816] dark:text-[#f19389]"
            role="alert"
            data-testid="status-action-modal-error"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Action Title */}
          <div>
            <label
              htmlFor="action-title"
              className="block text-xs font-bold text-[#2d5244] dark:text-[#a0cbb5]"
            >
              Action Title <span className="text-[#be4339]">*</span>
            </label>
            <input
              id="action-title"
              type="text"
              required
              maxLength={200}
              disabled={isSubmitting}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Review my Instagram privacy settings"
              className="mt-1.5 w-full rounded-xl border border-[#d7e3d9] bg-white px-3.5 py-2.5 text-sm text-[#1b4339] outline-none transition placeholder:text-[#91a399] focus:border-[#286253] focus:ring-2 focus:ring-[#286253]/15 disabled:opacity-50 dark:border-[#223930] dark:bg-[#182723] dark:text-[#f1f7f3] dark:placeholder:text-[#5a7668]"
              data-testid="input-action-title"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="action-description"
              className="block text-xs font-bold text-[#2d5244] dark:text-[#a0cbb5]"
            >
              Description <span className="text-[11px] font-normal text-[#788e82]">(Optional)</span>
            </label>
            <textarea
              id="action-description"
              rows={3}
              maxLength={1000}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Check profile visibility, followers and personal information."
              className="mt-1.5 w-full resize-none rounded-xl border border-[#d7e3d9] bg-white px-3.5 py-2.5 text-sm text-[#1b4339] outline-none transition placeholder:text-[#91a399] focus:border-[#286253] focus:ring-2 focus:ring-[#286253]/15 disabled:opacity-50 dark:border-[#223930] dark:bg-[#182723] dark:text-[#f1f7f3] dark:placeholder:text-[#5a7668]"
              data-testid="input-action-description"
            />
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="action-category"
              className="block text-xs font-bold text-[#2d5244] dark:text-[#a0cbb5]"
            >
              Category <span className="text-[#be4339]">*</span>
            </label>
            <select
              id="action-category"
              disabled={isSubmitting}
              value={category}
              onChange={(e) => setCategory(e.target.value as PrivacyActionCategory)}
              className="mt-1.5 w-full rounded-xl border border-[#d7e3d9] bg-white px-3.5 py-2.5 text-sm text-[#1b4339] outline-none transition focus:border-[#286253] focus:ring-2 focus:ring-[#286253]/15 disabled:opacity-50 dark:border-[#223930] dark:bg-[#182723] dark:text-[#f1f7f3]"
              data-testid="select-action-category"
            >
              {PRIVACY_ACTION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-[#2d5244] dark:text-[#a0cbb5]">
              Priority <span className="text-[#be4339]">*</span>
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {PRIVACY_ACTION_PRIORITIES.map((p) => {
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setPriority(p)}
                    className={`flex items-center justify-center rounded-xl border py-2 text-xs font-extrabold transition ${
                      isSelected
                        ? p === 'High'
                          ? 'border-[#be4339] bg-[#ffeae6] text-[#be4339] dark:border-[#d9665c] dark:bg-[#2c1816] dark:text-[#f19389]'
                          : p === 'Medium'
                            ? 'border-[#c58c27] bg-[#fff5df] text-[#9a6519] dark:border-[#e2aa4d] dark:bg-[#2a2212] dark:text-[#ebd28c]'
                            : 'border-[#3f7d5e] bg-[#e7f4eb] text-[#2c6148] dark:border-[#5ca983] dark:bg-[#172922] dark:text-[#92bfa7]'
                        : 'border-[#dce8df] bg-white text-[#567265] hover:border-[#adc8b3] dark:border-[#223930] dark:bg-[#182723] dark:text-[#8aa095]'
                    }`}
                    data-testid={`button-priority-${p.toLowerCase()}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="mt-6 flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-full border border-[#cadccf] bg-white px-4 py-2 text-xs font-bold text-[#446557] hover:bg-[#edf5ee] focus:outline-none focus:ring-2 focus:ring-[#286253]/20 disabled:opacity-50 dark:border-[#223930] dark:bg-[#182723] dark:text-[#8aa095] dark:hover:bg-[#1f352e]"
              data-testid="button-cancel-action-modal"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#184c43] px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#236457] focus:outline-none focus:ring-2 focus:ring-[#286253]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#286253] dark:hover:bg-[#347866]"
              data-testid="button-submit-action-modal"
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Action'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
