export type Guide = { id: string; category: string; title: string; summary: string; read: string; accent: string; steps: string[]; takeaway: string };
export type Lesson = { id: string; title: string; summary: string; duration: string; level: string; body: string[]; quiz: { question: string; options: string[]; answer: number; explanation: string } };

export const guides: Guide[] = [
  { id: 'privacy-basics', category: 'A good place to start', title: 'Your privacy, in five small steps', summary: 'A gentle reset for the settings that matter most across your everyday accounts.', read: '6 min', accent: 'mint', steps: ['Use a unique password for your email account, and turn on a password manager.', 'Turn on two-step sign-in for your email and banking accounts.', 'Review which apps can see your location; choose “while using” where possible.', 'Remove apps you no longer use, including their access to your accounts.', 'Take a moment to check your social profile and audience settings.'], takeaway: 'You do not need to do everything today. One thoughtful change is real progress.' },
  { id: 'location', category: 'Phone settings', title: 'Make location sharing work for you', summary: 'Choose when an app can see where you are, and when it cannot.', read: '4 min', accent: 'blue', steps: ['Open your phone’s privacy settings and find Location Services.', 'Review apps one by one. Ask whether location is needed for the feature you use.', 'Choose “While Using” instead of “Always” for most apps.', 'Turn off precise location for apps that only need a general area.', 'Check location sharing with people and pause anything you no longer need.'], takeaway: 'You can change this any time. Your map and delivery apps may need access only while open.' },
  { id: 'data-brokers', category: 'Your personal information', title: 'A practical first step on data brokers', summary: 'Learn what these companies do and what you can reasonably do about it.', read: '7 min', accent: 'peach', steps: ['Search your name with your city to see what is publicly visible.', 'Avoid entering sensitive details into unfamiliar removal sites.', 'Use official privacy request pages when you recognize the company.', 'Revisit your social profiles and limit public details such as phone number and birthday.', 'Keep expectations realistic: listings may take time to disappear or return.'], takeaway: 'Reducing information at the source helps. No single search or removal request can erase everything.' },
  { id: 'email', category: 'Email', title: 'Quiet the tracking in your inbox', summary: 'A few sensible email habits can reduce invisible tracking and unwanted mail.', read: '5 min', accent: 'gold', steps: ['Turn on image protection or remote-content blocking in your email settings.', 'Unsubscribe using the sender’s link only when you recognize and trust them.', 'Mark suspicious messages as spam rather than replying.', 'Use an alias for newsletters and shopping when your email service offers one.', 'Pause before sharing personal details in response to urgent messages.'], takeaway: 'A legitimate service will not ask you to rush into sharing a password or verification code.' },
];

export const lessons: Lesson[] = [
  { id: 'passwords', title: 'Passwords without the stress', summary: 'Understand why unique passwords matter and how to make them manageable.', duration: '4 min', level: 'Everyday basics', body: ['A password can be strong and still be a problem if it is reused. When one service has a data breach, reused passwords can put other accounts at risk.', 'A password manager creates and remembers a different password for each service. You only need to protect the manager itself with a strong passphrase and two-step sign-in.', 'Start with your email account. It is often the key to resetting other accounts. Then update important accounts as you naturally use them.'], quiz: { question: 'Why is reusing a password risky?', options: ['It makes the password harder to remember', 'A breach at one service can put other accounts at risk', 'It prevents two-step sign-in'], answer: 1, explanation: 'Unique passwords help contain the impact if one service is breached.' } },
  { id: 'two-step', title: 'The extra lock: two-step sign-in', summary: 'What it is, what it protects, and a simple way to turn it on.', duration: '3 min', level: 'Everyday basics', body: ['Two-step sign-in asks for one more proof that it is really you, beyond your password.', 'An authenticator app or a security key is generally stronger than text messages, but using text messages is still a useful step if that is what is available.', 'Save recovery codes somewhere safe. They can help you get back into your account if you lose your phone.'], quiz: { question: 'What does two-step sign-in add?', options: ['A second proof of identity beyond your password', 'A second password you reuse everywhere', 'A public profile setting'], answer: 0, explanation: 'It adds another check, so a password alone is less likely to be enough.' } },
  { id: 'phishing', title: 'Spot a message that feels off', summary: 'Notice common pressure tactics before you click or reply.', duration: '5 min', level: 'Everyday basics', body: ['Unexpected urgency is a common trick. Pause if a message threatens account closure or says you must act immediately.', 'Check the sender and destination carefully. Display names and familiar logos can be copied.', 'Instead of using a link in a surprising message, open the service’s app or type its known address yourself.', 'If you already clicked, change the affected password from the real service and contact its official support.'], quiz: { question: 'A delivery text asks for a small fee through a link you did not expect. What is a safer next step?', options: ['Open the link quickly before it expires', 'Reply with your details', 'Check the delivery company through its official app or website'], answer: 2, explanation: 'Reach a service through a channel you choose rather than a surprising link.' } },
];

export const suggestedPrompts = [
  'How can I improve my Instagram privacy?',
  'What privacy settings should I check first?',
  'Explain location tracking.',
  'How do I reduce unnecessary app permissions?',
  'What is third-party data sharing?',
  'Give me a privacy checklist.',
];

export function getGuideFallback(question: string): string {
  const query = question.toLowerCase();
  const guide = /location|gps|where|permission|tracking|track/.test(query)
    ? guides.find((item) => item.id === 'location')
    : /third.party|broker|sharing|sell|data/.test(query)
      ? guides.find((item) => item.id === 'data-brokers')
      : /email|inbox|pixel|phish|suspicious|link/.test(query)
        ? guides.find((item) => item.id === 'email')
        : guides.find((item) => item.id === 'privacy-basics');

  if (!guide) return 'Open the built-in privacy guides for practical steps you can take now.';
  const steps = guide.steps.slice(0, 4).map((step, index) => `${index + 1}. ${step}`).join('\n');
  return `**Guide-based help: ${guide.title}**\n\n${guide.summary}\n\n**A few steps to try**\n${steps}\n\n**Keep in mind:** ${guide.takeaway}\n\nThis is built-in guidance, not an AI-generated answer.`;
}

export const recommendations = [
  { id: 'secure-email', title: 'Protect your email first', why: 'Your inbox can reset many of your other accounts. A unique password and two-step sign-in are a strong starting point.', guide: 'privacy-basics', label: 'Start here', time: 'About 10 minutes', color: 'mint' },
  { id: 'check-location', title: 'Review location access', why: 'A quick look at phone permissions helps you choose which apps need your location and when.', guide: 'location', label: 'Phone settings', time: 'About 5 minutes', color: 'blue' },
  { id: 'learn-phishing', title: 'Practice spotting a suspicious message', why: 'A short lesson can make it easier to pause before an unexpected link or urgent request.', lesson: 'phishing', label: 'Short lesson', time: '5 minutes', color: 'peach' },
];
