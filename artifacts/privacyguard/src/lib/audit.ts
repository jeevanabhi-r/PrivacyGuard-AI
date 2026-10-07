export type AuditCategory =
  | 'account_security'
  | 'social_media'
  | 'location_privacy'
  | 'app_permissions'
  | 'browser_tracking';

export type AuditOption = 'yes' | 'no' | 'not_sure';

export interface AuditQuestion {
  id: string;
  category: AuditCategory;
  categoryTitle: string;
  categoryIcon: string;
  question: string;
  options: {
    value: AuditOption;
    label: string;
    points: number;
  }[];
}

export const auditQuestions: AuditQuestion[] = [
  // A. Account Security
  {
    id: 'q1',
    category: 'account_security',
    categoryTitle: 'Account Security',
    categoryIcon: 'LockKeyhole',
    question: 'Do you use two-factor authentication (2FA) on your important accounts?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },
  {
    id: 'q2',
    category: 'account_security',
    categoryTitle: 'Account Security',
    categoryIcon: 'LockKeyhole',
    question: 'Do you use different passwords for important accounts?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },

  // B. Social Media Privacy
  {
    id: 'q3',
    category: 'social_media',
    categoryTitle: 'Social Media Privacy',
    categoryIcon: 'UserCheck',
    question: 'Are your social media profiles limited to people you trust?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },
  {
    id: 'q4',
    category: 'social_media',
    categoryTitle: 'Social Media Privacy',
    categoryIcon: 'UserCheck',
    question: 'Do you regularly review who can see your posts, stories, and personal information?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },

  // C. Location Privacy
  {
    id: 'q5',
    category: 'location_privacy',
    categoryTitle: 'Location Privacy',
    categoryIcon: 'MapPin',
    question: 'Do you review which apps can access your location?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },
  {
    id: 'q6',
    category: 'location_privacy',
    categoryTitle: 'Location Privacy',
    categoryIcon: 'MapPin',
    question: 'Do you regularly review Google Maps location sharing and Timeline settings?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },

  // D. App Permissions
  {
    id: 'q7',
    category: 'app_permissions',
    categoryTitle: 'App Permissions',
    categoryIcon: 'Smartphone',
    question: 'Do you review app permissions before allowing access to camera, microphone, contacts, photos, or location?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },
  {
    id: 'q8',
    category: 'app_permissions',
    categoryTitle: 'App Permissions',
    categoryIcon: 'Smartphone',
    question: 'Do you remove apps that you no longer use?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },

  // E. Browser & Tracking
  {
    id: 'q9',
    category: 'browser_tracking',
    categoryTitle: 'Browser Safety',
    categoryIcon: 'Globe',
    question: 'Do you review browser privacy and tracking settings?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },
  {
    id: 'q10',
    category: 'browser_tracking',
    categoryTitle: 'Browser Safety',
    categoryIcon: 'Globe',
    question: 'Do you avoid clicking suspicious links or unexpected attachments?',
    options: [
      { value: 'yes', label: 'Yes', points: 10 },
      { value: 'no', label: 'No', points: 0 },
      { value: 'not_sure', label: "I'm not sure", points: 5 },
    ],
  },
];

export interface CategoryScore {
  category: AuditCategory;
  title: string;
  iconName: string;
  points: number;
  maxPoints: number;
  percentage: number;
}

export interface PrivacyScoreResult {
  totalScore: number;
  ratingLabel: string;
  ratingColor: string;
  badgeBg: string;
  badgeText: string;
  categories: CategoryScore[];
  topRisks: TopRisk[];
  actionPlan: ActionPlanItem[];
}

export interface TopRisk {
  id: string;
  category: AuditCategory;
  severity: 'high' | 'medium';
  title: string;
  description: string;
  questionId: string;
}

export interface ActionPlanItem {
  id: string;
  timeframe: 'TODAY' | 'THIS WEEK' | 'NEXT';
  icon: string;
  title: string;
  description: string;
  guideId: string;
  lessonId?: string;
  associatedQuestionId: string;
  weight: number; // points boost if completed
}

export function calculatePrivacyScore(answers: Record<string, AuditOption>): PrivacyScoreResult {
  let totalScore = 0;

  const categoryMap: Record<AuditCategory, { points: number; maxPoints: number; title: string; icon: string }> = {
    account_security: { points: 0, maxPoints: 20, title: 'Account Security', icon: 'LockKeyhole' },
    social_media: { points: 0, maxPoints: 20, title: 'Social Media Privacy', icon: 'UserCheck' },
    location_privacy: { points: 0, maxPoints: 20, title: 'Location Privacy', icon: 'MapPin' },
    app_permissions: { points: 0, maxPoints: 20, title: 'App Permissions', icon: 'Smartphone' },
    browser_tracking: { points: 0, maxPoints: 20, title: 'Browser Safety', icon: 'Globe' },
  };

  auditQuestions.forEach((q) => {
    const answer = answers[q.id];
    let points = 0;
    if (answer === 'yes') points = 10;
    else if (answer === 'not_sure') points = 5;
    else if (answer === 'no') points = 0;

    totalScore += points;
    categoryMap[q.category].points += points;
  });

  const categories: CategoryScore[] = Object.entries(categoryMap).map(([cat, data]) => ({
    category: cat as AuditCategory,
    title: data.title,
    iconName: data.icon,
    points: data.points,
    maxPoints: data.maxPoints,
    percentage: Math.round((data.points / data.maxPoints) * 100),
  }));

  let ratingLabel = 'High Risk';
  let ratingColor = 'text-[#d6453d]';
  let badgeBg = 'bg-[#fdf0ef] border-[#f8c8c5]';
  let badgeText = 'text-[#c73b33]';

  if (totalScore >= 90) {
    ratingLabel = 'Excellent';
    ratingColor = 'text-[#2b7252]';
    badgeBg = 'bg-[#ebf6ee] border-[#b9e2c6]';
    badgeText = 'text-[#266849]';
  } else if (totalScore >= 75) {
    ratingLabel = 'Good';
    ratingColor = 'text-[#387e5b]';
    badgeBg = 'bg-[#eaf4ed] border-[#c2e2cc]';
    badgeText = 'text-[#316e50]';
  } else if (totalScore >= 50) {
    ratingLabel = 'Needs Attention';
    ratingColor = 'text-[#bf7e21]';
    badgeBg = 'bg-[#fff7e6] border-[#f8deab]';
    badgeText = 'text-[#9c6314]';
  }

  // Top risks identification
  const topRisks: TopRisk[] = [];
  const addRisk = (id: string, cat: AuditCategory, sev: 'high' | 'medium', title: string, desc: string, qId: string) => {
    topRisks.push({ id, category: cat, severity: sev, title, description: desc, questionId: qId });
  };

  if (answers.q1 !== 'yes') {
    addRisk('r1', 'account_security', answers.q1 === 'no' ? 'high' : 'medium', 'Account Security', 'Consider enabling 2FA on your primary accounts.', 'q1');
  }
  if (answers.q2 !== 'yes') {
    addRisk('r2', 'account_security', answers.q2 === 'no' ? 'high' : 'medium', 'Password Security', 'Unique passwords for every service prevent cascade breaches.', 'q2');
  }
  if (answers.q6 !== 'yes') {
    addRisk('r3', 'location_privacy', answers.q6 === 'no' ? 'high' : 'medium', 'Location Privacy', 'Review Google Maps location sharing and Timeline settings.', 'q6');
  }
  if (answers.q5 !== 'yes' && answers.q6 === 'yes') {
    addRisk('r4', 'location_privacy', 'medium', 'App Location Access', 'Review which apps have continuous location permissions.', 'q5');
  }
  if (answers.q3 !== 'yes' || answers.q4 !== 'yes') {
    addRisk('r5', 'social_media', answers.q3 === 'no' || answers.q4 === 'no' ? 'high' : 'medium', 'Social Media Privacy', 'Review who can see your posts and personal information.', 'q3');
  }
  if (answers.q7 !== 'yes' || answers.q8 !== 'yes') {
    addRisk('r6', 'app_permissions', answers.q7 === 'no' ? 'high' : 'medium', 'App Permissions', 'Remove unused apps and audit camera/microphone permissions.', 'q7');
  }
  if (answers.q9 !== 'yes' || answers.q10 !== 'yes') {
    addRisk('r7', 'browser_tracking', answers.q10 === 'no' ? 'high' : 'medium', 'Browser Safety', 'Tighten tracking protection and exercise caution with unexpected links.', 'q9');
  }

  // Action plan items mapped to actual guides & lessons
  const actionPlan: ActionPlanItem[] = [];

  if (answers.q1 !== 'yes' || answers.q2 !== 'yes') {
    actionPlan.push({
      id: 'action-2fa',
      timeframe: 'TODAY',
      icon: 'LockKeyhole',
      title: 'Enable Two-Step Sign-In',
      description: 'PrivacyGuard recommends protecting your email and banking first with two-factor authentication.',
      guideId: 'privacy-basics',
      lessonId: 'two-step',
      associatedQuestionId: 'q1',
      weight: 10,
    });
  }

  if (answers.q5 !== 'yes' || answers.q6 !== 'yes') {
    actionPlan.push({
      id: 'action-location',
      timeframe: 'THIS WEEK',
      icon: 'MapPin',
      title: 'Review Google Maps & Location Settings',
      description: 'Follow this guide to limit continuous background GPS sharing and audit Google Maps Timeline.',
      guideId: 'location',
      associatedQuestionId: 'q6',
      weight: 10,
    });
  }

  if (answers.q7 !== 'yes' || answers.q8 !== 'yes') {
    actionPlan.push({
      id: 'action-apps',
      timeframe: 'NEXT',
      icon: 'Smartphone',
      title: 'Audit App Permissions & Remove Unused Apps',
      description: 'Follow this guide to revoke unnecessary microphone, camera, and contact access.',
      guideId: 'privacy-basics',
      associatedQuestionId: 'q7',
      weight: 10,
    });
  }

  if (answers.q3 !== 'yes' || answers.q4 !== 'yes') {
    actionPlan.push({
      id: 'action-social',
      timeframe: 'THIS WEEK',
      icon: 'UserCheck',
      title: 'Revisit Social Profiles & Audience Settings',
      description: 'PrivacyGuard recommends limiting publicly visible profile details and data broker exposure.',
      guideId: 'data-brokers',
      associatedQuestionId: 'q3',
      weight: 10,
    });
  }

  if (answers.q9 !== 'yes' || answers.q10 !== 'yes') {
    actionPlan.push({
      id: 'action-browser',
      timeframe: 'NEXT',
      icon: 'Globe',
      title: 'Quiet Tracking in Your Browser & Inbox',
      description: 'Follow this guide to reduce web trackers, tracking pixels, and suspicious email solicitations.',
      guideId: 'email',
      lessonId: 'phishing',
      associatedQuestionId: 'q10',
      weight: 10,
    });
  }

  // If already full score, show helpful maintenance action items
  if (actionPlan.length === 0) {
    actionPlan.push({
      id: 'action-maintenance',
      timeframe: 'THIS WEEK',
      icon: 'ShieldCheck',
      title: 'Periodic Privacy Maintenance',
      description: 'Review your privacy routine every few months to ensure new app installs follow your standards.',
      guideId: 'privacy-basics',
      associatedQuestionId: 'q1',
      weight: 0,
    });
  }

  return {
    totalScore,
    ratingLabel,
    ratingColor,
    badgeBg,
    badgeText,
    categories,
    topRisks: topRisks.slice(0, 3),
    actionPlan: actionPlan.slice(0, 4),
  };
}
