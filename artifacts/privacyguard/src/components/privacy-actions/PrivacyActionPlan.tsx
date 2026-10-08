import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Globe,
  LockKeyhole,
  LogIn,
  MapPin,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { ActionPlanItem } from '@/lib/audit';
import {
  createPrivacyAction,
  deletePrivacyAction,
  fetchPrivacyActions,
  togglePrivacyActionComplete,
  updatePrivacyAction,
  type PrivacyAction,
  type PrivacyActionCategory,
  type PrivacyActionPriority,
} from '@/lib/privacy-actions';
import type { PrivacyUser } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ActionCard } from './ActionCard';
import { ActionModal } from './ActionModal';
import { DeleteActionDialog } from './DeleteActionDialog';

interface PrivacyActionPlanProps {
  user: PrivacyUser | null;
  openAuth?: () => void;
  recommendedActions: ActionPlanItem[];
  completedRecommendedActions: string[];
  onToggleRecommendedAction: (actionId: string, guideId?: string) => void;
  initialTab?: 'recommended' | 'my-actions';
}

function getAuditIcon(name: string) {
  switch (name) {
    case 'LockKeyhole':
      return LockKeyhole;
    case 'UserCheck':
      return UserCheck;
    case 'MapPin':
      return MapPin;
    case 'Smartphone':
      return Smartphone;
    case 'Globe':
      return Globe;
    default:
      return ShieldCheck;
  }
}

function mapAuditToCategory(action: ActionPlanItem): PrivacyActionCategory {
  if (action.id === 'action-2fa' || action.id === 'action-maintenance') return 'Account Security';
  if (action.id === 'action-location') return 'Location Privacy';
  if (action.id === 'action-apps') return 'App Permissions';
  if (action.id === 'action-social') return 'Social Media Privacy';
  if (action.id === 'action-browser') return 'Browser Safety';
  return 'Other';
}

function mapAuditToPriority(action: ActionPlanItem): PrivacyActionPriority {
  if (action.timeframe === 'TODAY') return 'High';
  if (action.timeframe === 'THIS WEEK') return 'Medium';
  return 'Low';
}

export function PrivacyActionPlan({
  user,
  openAuth,
  recommendedActions,
  completedRecommendedActions,
  onToggleRecommendedAction,
  initialTab = 'recommended',
}: PrivacyActionPlanProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'recommended' | 'my-actions'>(initialTab);

  // Custom user actions state
  const [myActions, setMyActions] = useState<PrivacyAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [errorActions, setErrorActions] = useState<string | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<PrivacyAction | null>(null);
  const [deletingAction, setDeletingAction] = useState<PrivacyAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Load actions when authenticated user changes
  const loadActions = useCallback(async () => {
    if (!user) {
      setMyActions([]);
      setLoadingActions(false);
      setErrorActions(null);
      return;
    }

    setLoadingActions(true);
    setErrorActions(null);

    const { data, error } = await fetchPrivacyActions();
    if (error) {
      setErrorActions("Couldn't load your privacy actions. Please try again.");
    } else {
      setMyActions(data || []);
    }
    setLoadingActions(false);
  }, [user]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  // Create or Update Action Handler
  const handleSaveAction = async (values: {
    title: string;
    description: string;
    category: PrivacyActionCategory;
    priority: PrivacyActionPriority;
  }) => {
    if (!user) {
      if (openAuth) openAuth();
      return;
    }

    setIsSubmitting(true);

    if (editingAction) {
      // EDIT
      const { data, error } = await updatePrivacyAction(editingAction.id, {
        title: values.title,
        description: values.description,
        category: values.category,
        priority: values.priority,
      });

      setIsSubmitting(false);

      if (error || !data) {
        toast({
          title: 'Update failed',
          description: "Couldn't update your privacy action. Please try again.",
          variant: 'destructive',
        });
        return;
      }

      setMyActions((prev) => prev.map((act) => (act.id === data.id ? data : act)));
      setEditingAction(null);
      toast({
        title: 'Privacy action updated.',
      });
    } else {
      // CREATE
      // Duplicate title check
      const isDuplicate = myActions.some(
        (a) => a.title.trim().toLowerCase() === values.title.trim().toLowerCase(),
      );
      if (isDuplicate) {
        setIsSubmitting(false);
        toast({
          title: 'Action already exists',
          description: 'You already have a privacy action with this title.',
        });
        return;
      }

      const { data, error } = await createPrivacyAction({
        userId: user.id,
        title: values.title,
        description: values.description,
        category: values.category,
        priority: values.priority,
      });

      setIsSubmitting(false);

      if (error || !data) {
        toast({
          title: 'Creation failed',
          description: "Couldn't create your privacy action. Please try again.",
          variant: 'destructive',
        });
        return;
      }

      setMyActions((prev) => [data, ...prev]);
      setCreateModalOpen(false);
      setActiveTab('my-actions');
      toast({
        title: 'Privacy action created.',
      });
    }
  };

  // Toggle complete custom action
  const handleToggleComplete = async (action: PrivacyAction) => {
    const nextState = !action.completed;
    setActionInProgressId(action.id);

    const { data, error } = await togglePrivacyActionComplete(action.id, nextState);
    setActionInProgressId(null);

    if (error || !data) {
      toast({
        title: 'Update failed',
        description: 'Unable to update status. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    setMyActions((prev) => prev.map((act) => (act.id === data.id ? data : act)));
    toast({
      title: nextState ? 'Privacy action completed.' : 'Privacy action marked active.',
    });
  };

  // Delete Action Confirmation Handler
  const handleConfirmDelete = async () => {
    if (!deletingAction) return;
    setIsDeleting(true);

    const { success, error } = await deletePrivacyAction(deletingAction.id);
    setIsDeleting(false);

    if (!success || error) {
      toast({
        title: 'Delete failed',
        description: "Couldn't delete the privacy action. Please try again.",
        variant: 'destructive',
      });
      return;
    }

    setMyActions((prev) => prev.filter((act) => act.id !== deletingAction.id));
    setDeletingAction(null);
    toast({
      title: 'Privacy action deleted.',
    });
  };

  // Add recommended action from audit to user's custom actions
  const handleAddRecommendedToMyActions = async (item: ActionPlanItem) => {
    if (!user) {
      if (openAuth) {
        openAuth();
      } else {
        toast({
          title: 'Sign in required',
          description: 'Sign in to save your custom privacy actions and access them across devices.',
        });
      }
      return;
    }

    // Sensible duplicate check
    const alreadyExists = myActions.some(
      (a) => a.title.trim().toLowerCase() === item.title.trim().toLowerCase(),
    );

    if (alreadyExists) {
      toast({
        title: 'Already in My Actions',
        description: 'This recommendation is already saved in your action plan.',
      });
      return;
    }

    setActionInProgressId(item.id);
    const { data, error } = await createPrivacyAction({
      userId: user.id,
      title: item.title,
      description: item.description,
      category: mapAuditToCategory(item),
      priority: mapAuditToPriority(item),
    });
    setActionInProgressId(null);

    if (error || !data) {
      toast({
        title: 'Failed to add',
        description: "Couldn't add recommendation to your actions. Please try again.",
        variant: 'destructive',
      });
      return;
    }

    setMyActions((prev) => [data, ...prev]);
    toast({
      title: 'Added to your privacy actions.',
    });
  };

  const openActionCount = myActions.filter((a) => !a.completed).length;
  const completedActionCount = myActions.filter((a) => a.completed).length;

  return (
    <div className="mt-10" data-testid="section-privacy-action-plan">
      {/* Section Header */}
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#789184] dark:text-[#8aa095]">
            Targeted Roadmap
          </p>
          <h2
            className="font-display mt-1 text-2xl font-extrabold tracking-[-.035em] text-[#1b4339] dark:text-[#f1f7f3]"
            data-testid="text-action-plan-title"
          >
            Your Privacy Action Plan
          </h2>
          <p className="mt-1 text-xs text-[#71867b] dark:text-[#8aa095]">
            Turn your audit results into simple actions.
          </p>
        </div>

        {/* Create Custom Action Button */}
        <button
          onClick={() => {
            if (!user && openAuth) {
              openAuth();
              return;
            }
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#184c43] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#236457] focus:outline-none focus:ring-2 focus:ring-[#286253]/20 sm:self-auto dark:bg-[#286253] dark:hover:bg-[#347866]"
          data-testid="button-create-custom-action"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>Create Custom Action</span>
        </button>
      </div>

      {/* Tabs Switcher: [ Recommended ] [ My Actions ] */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#dce8df] pb-3 dark:border-[#1f312b]">
        <div className="flex items-center gap-2" role="tablist" aria-label="Privacy Action Tabs">
          <button
            role="tab"
            aria-selected={activeTab === 'recommended'}
            onClick={() => setActiveTab('recommended')}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              activeTab === 'recommended'
                ? 'bg-[#1b5246] text-white shadow-xs dark:bg-[#286253]'
                : 'border border-[#dce8df] bg-[#fbfdf9] text-[#5b7568] hover:border-[#adc9b2] hover:text-[#1e483b] dark:border-[#223930] dark:bg-[#14201d] dark:text-[#8aa095] dark:hover:bg-[#1b2b25]'
            }`}
            data-testid="tab-recommended-actions"
          >
            Recommended ({recommendedActions.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'my-actions'}
            onClick={() => setActiveTab('my-actions')}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              activeTab === 'my-actions'
                ? 'bg-[#1b5246] text-white shadow-xs dark:bg-[#286253]'
                : 'border border-[#dce8df] bg-[#fbfdf9] text-[#5b7568] hover:border-[#adc9b2] hover:text-[#1e483b] dark:border-[#223930] dark:bg-[#14201d] dark:text-[#8aa095] dark:hover:bg-[#1b2b25]'
            }`}
            data-testid="tab-my-actions"
          >
            My Actions {user ? `(${myActions.length})` : ''}
          </button>
        </div>

        {/* Tab meta notes */}
        {activeTab === 'recommended' && (
          <p className="text-[11px] text-[#71867b] dark:text-[#8aa095]">
            Mark steps as completed to watch your score improve
          </p>
        )}
        {activeTab === 'my-actions' && user && myActions.length > 0 && (
          <p className="text-[11px] font-semibold text-[#577264] dark:text-[#8aa095]">
            <span className="text-[#2b6849] font-bold dark:text-[#92bfa7]">{openActionCount} open</span>
            {' · '}
            <span>{completedActionCount} completed</span>
          </p>
        )}
      </div>

      {/* RECOMMENDED TAB */}
      {activeTab === 'recommended' && (
        <div className="space-y-3" data-testid="list-recommended-actions">
          {recommendedActions.map((action) => {
            const isDone = completedRecommendedActions.includes(action.id);
            const ActionIcon = getAuditIcon(action.icon);
            const alreadyInMyActions = myActions.some(
              (a) => a.title.trim().toLowerCase() === action.title.trim().toLowerCase(),
            );

            return (
              <div
                key={action.id}
                className={`flex flex-col gap-4 rounded-2xl border p-4.5 transition sm:flex-row sm:items-center sm:p-5 ${
                  isDone
                    ? 'border-[#c5e2ce] bg-[#f0f8f2] dark:border-[#1f362c] dark:bg-[#14241d]'
                    : 'border-[#dce8df] bg-[#fbfdfa] hover:border-[#adc9b2] dark:border-[#1f312b] dark:bg-[#14201d] dark:hover:border-[#28493b]'
                }`}
                data-testid={`card-action-plan-${action.id}`}
              >
                {/* Audit Completion Checkbox */}
                <button
                  onClick={() => onToggleRecommendedAction(action.id, action.guideId)}
                  className={`grid size-7 shrink-0 place-items-center rounded-lg border transition ${
                    isDone
                      ? 'border-[#3f7c5e] bg-[#3f7c5e] text-white'
                      : 'border-[#c3d6c7] bg-white text-transparent hover:border-[#3f7c5e] dark:border-[#2b443b] dark:bg-[#182723]'
                  }`}
                  aria-label={`Mark ${action.title} as completed`}
                  data-testid={`checkbox-action-${action.id}`}
                >
                  <Check size={14} strokeWidth={3} />
                </button>

                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e5efe8] text-[#2c5f4c] dark:bg-[#1a2d24] dark:text-[#92bfa7]">
                  <ActionIcon size={18} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#dfede2] px-2 py-0.5 text-[9px] font-extrabold text-[#2d624a] dark:bg-[#1e3328] dark:text-[#8fcda7]">
                      {action.timeframe}
                    </span>
                    {isDone && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#357250] dark:text-[#7bb596]">
                        <CheckCircle2 size={12} /> Completed (+{action.weight} pts)
                      </span>
                    )}
                  </div>
                  <h3
                    className={`font-display mt-1 text-sm font-extrabold ${
                      isDone
                        ? 'text-[#386b51] line-through dark:text-[#789a8a]'
                        : 'text-[#1d473b] dark:text-[#f1f7f3]'
                    }`}
                  >
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#6b8075] dark:text-[#8aa095]">
                    {action.description}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {/* Add to My Actions Button */}
                  <button
                    onClick={() => handleAddRecommendedToMyActions(action)}
                    disabled={actionInProgressId === action.id || alreadyInMyActions}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-[#286253]/20 disabled:cursor-not-allowed ${
                      alreadyInMyActions
                        ? 'border border-[#b8d6c0] bg-[#e8f5ec] text-[#285e43] opacity-85 dark:border-[#224436] dark:bg-[#172922] dark:text-[#92bfa7]'
                        : 'border border-[#cbdacf] bg-white text-[#235848] hover:border-[#184c43] hover:bg-[#edf5ee] dark:border-[#2b443b] dark:bg-[#182723] dark:text-[#a0cbb5] dark:hover:bg-[#1f352e]'
                    }`}
                    data-testid={`button-add-to-my-actions-${action.id}`}
                  >
                    {alreadyInMyActions ? (
                      <>
                        <Check size={13} strokeWidth={2.4} /> Added to My Actions
                      </>
                    ) : (
                      <>
                        <Plus size={13} strokeWidth={2.4} /> Add to My Actions
                      </>
                    )}
                  </button>

                  {/* View Guide Link */}
                  <Link
                    href={`/guides/${action.guideId}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#cbdacf] bg-white px-3.5 py-2 text-xs font-bold text-[#235848] hover:bg-[#edf5ee] dark:border-[#2b443b] dark:bg-[#182723] dark:text-[#a0cbb5] dark:hover:bg-[#1f352e]"
                    data-testid={`link-view-guide-${action.id}`}
                  >
                    View Guide <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MY ACTIONS TAB */}
      {activeTab === 'my-actions' && (
        <div data-testid="section-my-actions-content">
          {/* Unauthenticated State */}
          {!user ? (
            <div
              className="rounded-3xl border border-[#dce8df] bg-[#fbfdfa] p-7 text-center sm:p-10 dark:border-[#1f312b] dark:bg-[#14201d]"
              data-testid="status-my-actions-unauthenticated"
            >
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e5efe8] text-[#1f5747] dark:bg-[#192b23] dark:text-[#92bfa7]">
                <LockKeyhole size={22} />
              </div>
              <h3 className="font-display mt-4 text-lg font-extrabold text-[#194338] dark:text-[#f1f7f3]">
                Your Custom Privacy Actions
              </h3>
              <p className="mx-auto mt-2 max-w-[460px] text-xs leading-relaxed text-[#6d8578] dark:text-[#8aa095]">
                Sign in to save your custom privacy actions and access them across devices.
              </p>
              <div className="mt-5">
                <button
                  onClick={openAuth}
                  className="inline-flex items-center gap-2 rounded-full bg-[#184c43] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#236457] focus:outline-none focus:ring-2 focus:ring-[#286253]/20 dark:bg-[#286253] dark:hover:bg-[#347866]"
                  data-testid="button-signin-for-actions"
                >
                  <LogIn size={14} /> Sign in to save actions
                </button>
              </div>
            </div>
          ) : loadingActions ? (
            /* Loading State */
            <div
              className="flex items-center justify-center rounded-3xl border border-[#dce8df] bg-[#fbfdfa] py-16 text-xs font-semibold text-[#6d8578] dark:border-[#1f312b] dark:bg-[#14201d] dark:text-[#8aa095]"
              data-testid="status-loading-actions"
            >
              <RefreshCw size={16} className="mr-2.5 animate-spin text-[#2b6849]" />
              Loading your privacy actions…
            </div>
          ) : errorActions ? (
            /* Error State */
            <div
              className="rounded-3xl border border-[#f0debe] bg-[#fff9ee] p-7 text-center dark:border-[#3f361c] dark:bg-[#242013]"
              data-testid="status-error-actions"
            >
              <p className="text-xs font-bold text-[#816329] dark:text-[#ebd28c]">{errorActions}</p>
              <button
                onClick={loadActions}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[#dccaa0] bg-white px-4 py-2 text-xs font-bold text-[#72541a] hover:bg-[#fbf4e5] dark:border-[#4d3f1d] dark:bg-[#1c1810] dark:text-[#ebd28c]"
                data-testid="button-retry-load-actions"
              >
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          ) : myActions.length === 0 ? (
            /* Empty State */
            <div
              className="rounded-3xl border border-dashed border-[#cfe0d4] bg-[#fbfdfa] p-8 text-center sm:p-12 dark:border-[#223930] dark:bg-[#14201d]"
              data-testid="status-empty-actions"
            >
              <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e5efe8] text-[#1f5747] dark:bg-[#192b23] dark:text-[#92bfa7]">
                <Sparkles size={22} />
              </div>
              <h3 className="font-display mt-4 text-base font-extrabold text-[#194338] dark:text-[#f1f7f3]">
                No custom privacy actions yet.
              </h3>
              <p className="mx-auto mt-1.5 max-w-[420px] text-xs leading-relaxed text-[#6d8578] dark:text-[#8aa095]">
                Create an action from your audit recommendations or add your own.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#184c43] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#236457] focus:outline-none focus:ring-2 focus:ring-[#286253]/20 dark:bg-[#286253] dark:hover:bg-[#347866]"
                  data-testid="button-empty-create-action"
                >
                  <Plus size={14} /> + Create Custom Action
                </button>
                <button
                  onClick={() => setActiveTab('recommended')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#cadccf] bg-white px-4 py-2.5 text-xs font-bold text-[#355a4b] hover:bg-[#edf4ee] dark:border-[#2b443b] dark:bg-[#182723] dark:text-[#a0cbb5]"
                  data-testid="button-view-recommended"
                >
                  Browse Recommendations
                </button>
              </div>
            </div>
          ) : (
            /* Action Cards Grid */
            <div
              className="grid gap-3.5 sm:grid-cols-2"
              data-testid="grid-my-actions"
            >
              {myActions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onToggleComplete={handleToggleComplete}
                  onEdit={(act) => setEditingAction(act)}
                  onDelete={(act) => setDeletingAction(act)}
                  isUpdating={actionInProgressId === action.id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE ACTION MODAL */}
      <ActionModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleSaveAction}
        isSubmitting={isSubmitting}
      />

      {/* EDIT ACTION MODAL */}
      <ActionModal
        isOpen={Boolean(editingAction)}
        onClose={() => setEditingAction(null)}
        onSubmit={handleSaveAction}
        initialAction={editingAction}
        isSubmitting={isSubmitting}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <DeleteActionDialog
        action={deletingAction}
        isOpen={Boolean(deletingAction)}
        onClose={() => setDeletingAction(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
