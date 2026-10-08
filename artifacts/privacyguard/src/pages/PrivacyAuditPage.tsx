import { useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Globe,
  LockKeyhole,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  auditQuestions,
  calculatePrivacyScore,
  type AuditOption,
  type CategoryScore,
  type PrivacyScoreResult,
} from '@/lib/audit';
import { PrivacyUser, supabase, supabaseConfigured } from '@/lib/supabase';
import { PrivacyActionPlan } from '@/components/privacy-actions/PrivacyActionPlan';
import ReactMarkdown from 'react-markdown';

const AUDIT_STORAGE_KEY = 'privacyguard_audit_answers';
const AUDIT_ACTION_STORAGE_KEY = 'privacyguard_completed_actions';

function getCategoryIcon(name: string) {
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

export function PrivacyAuditPage({
  user,
  done,
  toggle,
  openAuth,
}: {
  user: PrivacyUser | null;
  done: string[];
  toggle: (id: string, type: string) => Promise<{ ok: boolean; error?: string }>;
  openAuth?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, AuditOption>>(() => {
    try {
      const saved = localStorage.getItem(AUDIT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCalculated, setIsCalculated] = useState(() => {
    try {
      const saved = localStorage.getItem(AUDIT_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      return Object.keys(parsed).length === auditQuestions.length;
    } catch {
      return false;
    }
  });

  // Manually completed actions in audit action plan
  const [completedActions, setCompletedActions] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(AUDIT_ACTION_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // AI Explanation State
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [submittingScore, setSubmittingScore] = useState(false);

  const currentQ = auditQuestions[currentIndex];
  const selectedOption = answers[currentQ?.id];

  const handleSelectOption = (option: AuditOption) => {
    const updated = { ...answers, [currentQ.id]: option };
    setAnswers(updated);
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleNext = () => {
    if (currentIndex < auditQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleCalculateScore = async () => {
    if (submittingScore) return;
    setSubmittingScore(true);
    setIsCalculated(true);
    setSubmittingScore(false);

    // Save audit completion state in learning_progress if user is signed in
    if (user && supabase) {
      try {
        await supabase.from('learning_progress').upsert(
          {
            user_id: user.id,
            item_id: 'privacy-audit-v1',
            item_type: 'checklist',
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,item_id,item_type' },
        );
      } catch {}
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setCompletedActions([]);
    setIsCalculated(false);
    setCurrentIndex(0);
    setAiExplanation(null);
    setAiFailed(false);
    try {
      localStorage.removeItem(AUDIT_STORAGE_KEY);
      localStorage.removeItem(AUDIT_ACTION_STORAGE_KEY);
    } catch {}
  };

  const toggleAction = (actionId: string, associatedGuideOrLessonId?: string) => {
    setCompletedActions((prev) => {
      const next = prev.includes(actionId)
        ? prev.filter((id) => id !== actionId)
        : [...prev, actionId];
      try {
        localStorage.setItem(AUDIT_ACTION_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

    // Also sync with main app done progress if guide exists
    if (associatedGuideOrLessonId) {
      toggle(associatedGuideOrLessonId, 'guide').catch(() => {});
    }
  };

  const requestAiExplanation = async (result: PrivacyScoreResult) => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiFailed(false);

    if (!user || !supabase || !supabaseConfigured) {
      setAiLoading(false);
      setAiFailed(true);
      return;
    }

    try {
      const categorySummary = result.categories
        .map((c) => `${c.title}: ${c.percentage}%`)
        .join(', ');

      const promptText = `I completed the PrivacyGuard Audit. Overall Score: ${result.totalScore}/100 (${result.ratingLabel}). Category Breakdown: ${categorySummary}. Please briefly explain: 1. My top 3 privacy risks, 2. Why they matter, and 3. Practical next steps. Keep it defensive and educational without asking for personal information.`;

      const { data, error } = await supabase.functions.invoke('privacy-assistant', {
        body: { message: promptText },
      });

      if (error || !data?.response) {
        throw new Error('AI temporarily unavailable');
      }

      setAiExplanation(data.response);
    } catch {
      setAiFailed(true);
    } finally {
      setAiLoading(false);
    }
  };

  // If score calculation is complete, render Result Screen
  if (isCalculated) {
    const result = calculatePrivacyScore(answers);
    const completedActionCount = completedActions.length;
    // Calculate simulated progress improvement points
    const bonusPoints = completedActions.reduce((acc, actId) => {
      const item = result.actionPlan.find((a) => a.id === actId);
      return acc + (item ? item.weight : 0);
    }, 0);
    const updatedScore = Math.min(100, result.totalScore + bonusPoints);

    return (
      <div className="page-enter max-w-[940px] px-4 py-7 sm:px-8 sm:py-10 lg:px-12">
        {/* Navigation back / reset */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#618075] hover:text-[#1a5748]"
            data-testid="button-audit-back-home"
          >
            <ArrowLeft size={14} /> Back to Overview
          </Link>
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#cadccf] bg-white px-3.5 py-1.5 text-xs font-bold text-[#355a4b] hover:bg-[#edf4ee]"
            data-testid="button-retake-audit"
          >
            <RotateCcw size={13} /> Retake Audit
          </button>
        </div>

        {/* Head */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#668276]">
            <span className="size-1.5 rounded-full bg-[#d9a942]" />
            Audit Complete
          </div>
          <h1
            className="font-display text-[clamp(2.1rem,4vw,3.2rem)] font-extrabold leading-[1.06] tracking-[-.055em] text-[#173e36]"
            data-testid="text-audit-result-title"
          >
            Your Privacy Score
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#71867b]">
            Transparent, deterministic assessment based on your answers across 5 core privacy dimensions.
          </p>
        </div>

        {/* Score Hero Card */}
        <div
          className="relative overflow-hidden rounded-[26px] border border-[#dce8df] bg-gradient-to-br from-[#fcfdfa] via-[#f7faf6] to-[#ebf3ec] p-6 sm:p-9 shadow-sm"
          data-testid="card-audit-score-hero"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[.14em] text-[#718a7c]">
                Calculated Score
              </span>
              <div className="mt-2 flex items-baseline gap-3">
                <span
                  className="font-display text-5xl font-extrabold tracking-[-.06em] text-[#194338] sm:text-6xl"
                  data-testid="text-privacy-score-value"
                >
                  {result.totalScore}
                </span>
                <span className="text-xl font-bold text-[#7d9387]">/ 100</span>
              </div>
              <div className="mt-3 flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${result.badgeBg} ${result.badgeText}`}
                  data-testid="badge-privacy-rating"
                >
                  <span className="size-2 rounded-full bg-current" />
                  {result.ratingLabel}
                </span>
                <span className="text-xs text-[#71867b]">100% reproducible</span>
              </div>
            </div>

            {/* Before / After Progress Indicator */}
            {completedActionCount > 0 && (
              <div
                className="rounded-2xl border border-[#bfe0cc] bg-[#eaf7ee] p-4 text-left sm:max-w-[280px]"
                data-testid="card-score-progress-improvement"
              >
                <div className="flex items-center justify-between text-xs font-bold text-[#2d6849]">
                  <span>Privacy Progress</span>
                  <span className="rounded-full bg-[#c7ebd5] px-2 py-0.5 text-[11px] font-extrabold text-[#205a3c]">
                    +{bonusPoints} pts
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-extrabold text-[#597769] line-through">
                    {result.totalScore}
                  </span>
                  <span className="text-xs text-[#637d70]">→</span>
                  <span
                    className="font-display text-3xl font-extrabold text-[#194c3d]"
                    data-testid="text-updated-score-value"
                  >
                    {updatedScore}
                  </span>
                  <span className="text-xs font-semibold text-[#5a7b6b]">/ 100</span>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-[#517462]">
                  Your updated score is based on recommendations you marked as completed.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Category Scores Section */}
        <div className="mt-9">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#789184]">
              Dimension Breakdown
            </p>
            <h2 className="font-display mt-1 text-xl font-extrabold tracking-[-.03em] text-[#1b4339]">
              Category Scores
            </h2>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {result.categories.map((cat: CategoryScore) => {
              const Icon = getCategoryIcon(cat.iconName);
              const isHigh = cat.percentage >= 75;
              const isMedium = cat.percentage >= 50 && cat.percentage < 75;
              const barColor = isHigh
                ? 'bg-[#3e8361]'
                : isMedium
                  ? 'bg-[#dfa642]'
                  : 'bg-[#d6574f]';

              return (
                <div
                  key={cat.category}
                  className="rounded-2xl border border-[#dce8df] bg-[#fbfdfa] p-4.5 sm:p-5 shadow-sm"
                  data-testid={`card-category-score-${cat.category}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-xl bg-[#e6f1e8] text-[#2c614b]">
                      <Icon size={17} />
                    </span>
                    <span
                      className="font-display text-base font-extrabold text-[#1c473c]"
                      data-testid={`text-category-percent-${cat.category}`}
                    >
                      {cat.percentage}%
                    </span>
                  </div>
                  <h3 className="mt-3 text-xs font-bold text-[#2a4e43]">{cat.title}</h3>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#e3ece4]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-[#7e9187]">
                    {cat.points} / {cat.maxPoints} pts
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Privacy Risks */}
        {result.topRisks.length > 0 && (
          <div className="mt-10" data-testid="section-top-risks">
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#789184]">
                Vulnerability Assessment
              </p>
              <h2 className="font-display mt-1 text-xl font-extrabold tracking-[-.03em] text-[#1b4339]">
                Your Top Privacy Priorities
              </h2>
            </div>

            <div className="space-y-3">
              {result.topRisks.map((risk) => (
                <div
                  key={risk.id}
                  className="flex items-start gap-3.5 rounded-2xl border border-[#eed9cf] bg-[#fffbf9] p-4 sm:p-5"
                  data-testid={`card-top-risk-${risk.id}`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm ${
                      risk.severity === 'high'
                        ? 'bg-[#ffeae6] text-[#be4339]'
                        : 'bg-[#fff2db] text-[#af7624]'
                    }`}
                  >
                    <ShieldAlert size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#27473d]">{risk.title}</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                          risk.severity === 'high'
                            ? 'bg-[#fde2dc] text-[#b8372d]'
                            : 'bg-[#feecd2] text-[#9a6319]'
                        }`}
                      >
                        {risk.severity === 'high' ? 'High Risk' : 'Attention'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#6c8075]">{risk.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Your Privacy Action Plan */}
        <PrivacyActionPlan
          user={user}
          openAuth={openAuth}
          recommendedActions={result.actionPlan}
          completedRecommendedActions={completedActions}
          onToggleRecommendedAction={(actId, guideId) => toggleAction(actId, guideId)}
          initialTab={typeof window !== 'undefined' && window.location.search.includes('tab=my-actions') ? 'my-actions' : 'recommended'}
        />

        {/* AI Privacy Coach Explanation Card */}
        <div
          className="mt-10 rounded-[24px] border border-[#d8e6dc] bg-[#f4f9f4] p-5 sm:p-7"
          data-testid="section-ai-coach-explanation"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#1d5246] text-[#f2d888]">
                <Sparkles size={19} />
              </span>
              <div>
                <h3 className="font-display text-base font-extrabold text-[#174338]">
                  AI Privacy Coach Explanation
                </h3>
                <p className="text-xs text-[#6e8579]">
                  Personalized synthesis generated from your deterministic audit scores.
                </p>
              </div>
            </div>

            {!aiExplanation && (
              <button
                onClick={() => requestAiExplanation(result)}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 rounded-full bg-[#1b5044] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#256658] disabled:opacity-50"
                data-testid="button-request-ai-explanation"
              >
                {aiLoading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Thinking...
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> Explain My Results
                  </>
                )}
              </button>
            )}
          </div>

          {aiExplanation && (
            <div
              className="mt-5 rounded-2xl border border-[#d2e4d7] bg-white p-5 text-[13px] leading-relaxed text-[#35594b]"
              data-testid="text-ai-explanation-content"
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3 whitespace-pre-wrap">{children}</p>,
                  h2: ({ children }) => (
                    <h4 className="mb-2 mt-4 font-bold text-[#194639]">{children}</h4>
                  ),
                  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
                  ol: ({ children }) => (
                    <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>
                  ),
                  li: ({ children }) => <li className="pl-0.5">{children}</li>,
                }}
              >
                {aiExplanation}
              </ReactMarkdown>
              <div className="mt-4 flex items-center justify-between border-t border-[#e2ede4] pt-3 text-[10px] text-[#799084]">
                <span>Generated via Groq Privacy Assistant</span>
                <span className="font-medium">No personal credentials were sent</span>
              </div>
            </div>
          )}

          {aiFailed && !aiExplanation && (
            <div
              className="mt-4 rounded-xl border border-[#f0debe] bg-[#fff9ee] p-3.5 text-xs leading-5 text-[#7f6533]"
              role="alert"
              data-testid="status-ai-unavailable-notice"
            >
              AI recommendations are temporarily unavailable, but your privacy assessment is still
              available.
            </div>
          )}
        </div>

        {/* Disclaimer / Note */}
        <div className="mt-10 flex items-center gap-2 border-t border-[#dce8df] pt-5 text-[11px] leading-relaxed text-[#84958c]">
          <ShieldCheck size={14} className="shrink-0 text-[#598672]" />
          PrivacyGuard does not change your external account settings directly. All recommendations are
          step-by-step actions for you to perform safely.
        </div>
      </div>
    );
  }

  // Questionnaire Flow
  const progressPercent = Math.round(((currentIndex + 1) / auditQuestions.length) * 100);
  const isLastQuestion = currentIndex === auditQuestions.length - 1;
  const CategoryIcon = getCategoryIcon(currentQ.categoryIcon);

  return (
    <div className="page-enter max-w-[760px] px-4 py-7 sm:px-8 sm:py-10 lg:px-12">
      {/* Top back button */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#618075] hover:text-[#1a5748]"
        data-testid="button-audit-exit"
      >
        <ArrowLeft size={14} /> Exit Audit
      </Link>

      {/* Progress Bar & Header */}
      <div className="mb-6" data-testid="section-audit-progress">
        <div className="flex items-center justify-between text-xs font-bold text-[#446b5a]">
          <span>Privacy Audit</span>
          <span>
            Question {currentIndex + 1} of {auditQuestions.length} ({progressPercent}%)
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#dbe8de]">
          <div
            className="h-full rounded-full bg-[#276451] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div
        className="rounded-[24px] border border-[#dce8df] bg-[#fbfdf9] p-6 shadow-sm sm:p-8"
        data-testid={`card-audit-question-${currentQ.id}`}
      >
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#6b897b]">
          <span className="grid size-6 place-items-center rounded-md bg-[#e4efe6] text-[#295c4a]">
            <CategoryIcon size={13} />
          </span>
          {currentQ.categoryTitle}
        </div>

        <h2
          className="font-display mt-4 text-[clamp(1.25rem,2.5vw,1.65rem)] font-extrabold leading-snug tracking-[-.035em] text-[#1b4438]"
          data-testid="text-audit-question-title"
        >
          {currentQ.question}
        </h2>

        {/* Options */}
        <div className="mt-6 space-y-3" role="radiogroup" aria-label={currentQ.question}>
          {currentQ.options.map((opt) => {
            const isSelected = selectedOption === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleSelectOption(opt.value)}
                role="radio"
                aria-checked={isSelected}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left text-sm font-semibold transition ${
                  isSelected
                    ? 'border-[#2d6c57] bg-[#eef7f1] text-[#1e4d3e] shadow-sm ring-1 ring-[#2d6c57]'
                    : 'border-[#dce8df] bg-white text-[#3e5f52] hover:border-[#b1cdb8] hover:bg-[#f6faf7]'
                }`}
                data-testid={`button-audit-option-${opt.value}`}
              >
                <span>{opt.label}</span>
                <span
                  className={`grid size-5 place-items-center rounded-full border transition ${
                    isSelected
                      ? 'border-[#2d6c57] bg-[#2d6c57] text-white'
                      : 'border-[#c6d7cc] bg-transparent'
                  }`}
                >
                  {isSelected && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-[#e3ede5] pt-5">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#cadccf] bg-white px-4 py-2.5 text-xs font-bold text-[#446759] transition hover:bg-[#edf5ee] disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="button-audit-prev"
          >
            <ArrowLeft size={14} /> Back
          </button>

          {isLastQuestion ? (
            <button
              onClick={handleCalculateScore}
              disabled={!selectedOption || submittingScore}
              className="inline-flex items-center gap-2 rounded-full bg-[#184c43] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#236457] disabled:cursor-not-allowed disabled:opacity-45"
              data-testid="button-audit-calculate"
            >
              {submittingScore ? 'Calculating...' : 'Calculate My Privacy Score'}
              <Sparkles size={14} />
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!selectedOption}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#184c43] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#236457] disabled:cursor-not-allowed disabled:opacity-45"
              data-testid="button-audit-next"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2 text-[10px] text-[#86998f]">
        <ShieldCheck size={13} /> Your audit is calculated deterministically on your device. No
        sensitive credentials are requested or stored.
      </div>
    </div>
  );
}
