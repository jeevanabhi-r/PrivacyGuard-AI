import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Edit2,
  Globe,
  LockKeyhole,
  MapPin,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
} from 'lucide-react';
import type { PrivacyAction, PrivacyActionCategory } from '@/lib/privacy-actions';

interface ActionCardProps {
  action: PrivacyAction;
  onToggleComplete: (action: PrivacyAction) => Promise<void>;
  onEdit: (action: PrivacyAction) => void;
  onDelete: (action: PrivacyAction) => void;
  isUpdating?: boolean;
}

function getCategoryIcon(category: PrivacyActionCategory) {
  switch (category) {
    case 'Account Security':
      return LockKeyhole;
    case 'Social Media Privacy':
      return UserCheck;
    case 'Location Privacy':
      return MapPin;
    case 'App Permissions':
      return Smartphone;
    case 'Browser Safety':
      return Globe;
    default:
      return ShieldCheck;
  }
}

export function ActionCard({
  action,
  onToggleComplete,
  onEdit,
  onDelete,
  isUpdating = false,
}: ActionCardProps) {
  const Icon = getCategoryIcon(action.category);
  const isDone = action.completed;

  const priorityStyles = {
    High: 'bg-[#fde2dc] text-[#b8372d] border-[#f8c8c5] dark:bg-[#2e1917] dark:text-[#f19389] dark:border-[#4d2522]',
    Medium: 'bg-[#fff2db] text-[#af7624] border-[#f8deab] dark:bg-[#2a2212] dark:text-[#ebd28c] dark:border-[#483a1b]',
    Low: 'bg-[#e7f2ea] text-[#2f684a] border-[#c0e0cc] dark:bg-[#172922] dark:text-[#92bfa7] dark:border-[#224436]',
  };

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 sm:p-6 ${
        isDone
          ? 'border-[#cfe2d4] bg-[#f2f8f4]/80 opacity-90 dark:border-[#1f362c] dark:bg-[#121d19]/80'
          : 'border-[#dce8df] bg-[#fbfdfa] shadow-sm hover:border-[#b4cfba] hover:shadow-md dark:border-[#1f312b] dark:bg-[#14201d]'
      }`}
      data-testid={`card-privacy-action-${action.id}`}
    >
      <div>
        {/* Header: Icon, Category & Priority */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl text-base ${
                isDone
                  ? 'bg-[#deebe1] text-[#346d51] dark:bg-[#1a2d24] dark:text-[#84b59b]'
                  : 'bg-[#e5efe8] text-[#1f5747] dark:bg-[#192b23] dark:text-[#92bfa7]'
              }`}
            >
              <Icon size={19} />
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[.12em] text-[#6d8578] dark:text-[#8aa095]">
                {action.category}
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase ${priorityStyles[action.priority] || priorityStyles.Medium}`}
                  data-testid={`badge-priority-${action.id}`}
                >
                  Priority: {action.priority.toUpperCase()}
                </span>
                {isDone && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2d6c4e] dark:text-[#7bb596]">
                    <CheckCircle2 size={13} /> Completed
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Title */}
        <h3
          className={`font-display mt-3.5 text-base font-extrabold tracking-[-.025em] ${
            isDone
              ? 'text-[#486859] line-through dark:text-[#789a8a]'
              : 'text-[#194338] dark:text-[#f1f7f3]'
          }`}
          data-testid={`text-action-title-${action.id}`}
        >
          {action.title}
        </h3>

        {/* Description */}
        {action.description && (
          <p
            className={`mt-1.5 text-xs leading-relaxed ${
              isDone
                ? 'text-[#74897d] dark:text-[#6e8579]'
                : 'text-[#637d71] dark:text-[#8aa095]'
            }`}
            data-testid={`text-action-desc-${action.id}`}
          >
            {action.description}
          </p>
        )}
      </div>

      {/* Action Buttons Footer */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e3ede5] pt-4 dark:border-[#1d2f28]">
        {/* Toggle Complete */}
        <button
          onClick={() => onToggleComplete(action)}
          disabled={isUpdating}
          className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-[#286253]/20 disabled:opacity-50 ${
            isDone
              ? 'border border-[#b8d6c0] bg-[#e6f4ea] text-[#245c40] hover:bg-[#d9ecde] dark:border-[#2a4d3b] dark:bg-[#183327] dark:text-[#8fd4ad]'
              : 'border border-[#cadccf] bg-white text-[#1f5244] hover:border-[#1f5244] hover:bg-[#edf5ee] dark:border-[#2b443b] dark:bg-[#182723] dark:text-[#a0cbb5] dark:hover:bg-[#1f352e]'
          }`}
          data-testid={`button-toggle-complete-${action.id}`}
          aria-label={isDone ? `Mark "${action.title}" as incomplete` : `Mark "${action.title}" as complete`}
        >
          {isDone ? (
            <>
              <Check size={14} strokeWidth={2.6} /> ✓ Completed
            </>
          ) : (
            <>
              <span className="size-2 rounded-full border border-current" /> Mark Complete
            </>
          )}
        </button>

        {/* Edit and Delete Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(action)}
            disabled={isUpdating}
            className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-[#446557] hover:border-[#d4e2d7] hover:bg-[#eff5f0] focus:outline-none focus:ring-2 focus:ring-[#286253]/20 disabled:opacity-50 dark:text-[#8ea99b] dark:hover:border-[#223930] dark:hover:bg-[#1b2b25]"
            data-testid={`button-edit-action-${action.id}`}
            aria-label={`Edit "${action.title}"`}
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </button>

          <button
            onClick={() => onDelete(action)}
            disabled={isUpdating}
            className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-[#964a40] hover:border-[#f4d1cb] hover:bg-[#fff0ed] focus:outline-none focus:ring-2 focus:ring-[#964a40]/20 disabled:opacity-50 dark:text-[#e89085] dark:hover:border-[#4d2522] dark:hover:bg-[#2c1816]"
            data-testid={`button-delete-action-${action.id}`}
            aria-label={`Delete "${action.title}"`}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
