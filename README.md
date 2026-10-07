# 🛡️ PrivacyGuard AI

### A calmer, smarter way to understand and improve your digital privacy.

PrivacyGuard AI is an AI-powered **Digital Privacy Assistant** that helps users understand their privacy risks, identify weak areas, and take practical steps to improve their digital privacy.

Instead of complicated privacy policies and fear-based warnings, PrivacyGuard AI provides a simple and actionable experience:

> **Assess → Score → Identify Risks → Explain → Act → Learn → Measure**

---

## 🎯 Problem Statement

### CS5 – Digital Privacy Assistant

People use dozens of online services every day, but many do not know:

- Which apps can access their location
- Whether their accounts are properly secured
- How much information they expose on social media
- Which permissions their apps have
- How browser tracking affects them
- How to recognize phishing and suspicious links
- What practical steps they should take to improve their privacy

Privacy information is often complicated, scattered, and difficult for non-technical users to act on.

## 💡 Our Solution

PrivacyGuard AI transforms privacy awareness into a simple, actionable experience.

Users can:

1. Take a privacy assessment
2. Receive a **0–100 Privacy Score**
3. Understand their highest-risk areas
4. Get a personalized action plan
5. Ask an AI privacy assistant questions
6. Learn through short lessons and quizzes
7. Track their progress
8. Retake the assessment and measure improvement

---

# ✨ Key Features

## 🔎 Privacy Audit

PrivacyGuard AI provides a **10-question interactive privacy assessment** covering five important areas:

- 🔐 Account Security
- 📱 Social Media Privacy
- 📍 Location Privacy
- 🔑 App Permissions
- 🌐 Browser & Tracking

Each answer contributes to a deterministic privacy score.

### Privacy Score

| Score | Rating |
|---|---|
| 90–100 | 🟢 Excellent |
| 75–89 | 🟢 Good |
| 50–74 | 🟡 Needs Attention |
| 0–49 | 🔴 High Risk |

---

## 📊 Privacy Score Dashboard

Users receive:

- Overall privacy score
- Category-wise breakdown
- Top privacy risks
- Recommended actions
- Progress toward improving their privacy

The dashboard turns privacy awareness into measurable progress.

---

## 🤖 AI Privacy Assistant

PrivacyGuard AI includes an AI assistant powered by **Groq** using:

`openai/gpt-oss-120b`

The AI helps users understand privacy concepts and provides practical privacy guidance.

### AI Architecture

```text
User
  ↓
React Frontend
  ↓
Supabase Edge Function
  ↓
Groq API
  ↓
AI Response
  ↓
Supabase
  ↓
React Frontend
