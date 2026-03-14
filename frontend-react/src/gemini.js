/**
 * gemini.js — Gemini 1.5 Flash API wrapper (free tier, no billing)
 * Get a free key at: https://aistudio.google.com/app/apikey
 * Set VITE_GEMINI_KEY in frontend-react/.env
 */

const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

export const isAvailable = () => Boolean(GEMINI_KEY)

async function generateContent(prompt, systemInstruction = '') {
  if (!isAvailable()) throw new Error('NO_KEY')
  const body = {
    system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
  }
  const res = await fetch(`${BASE_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`GEMINI_ERROR_${res.status}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

/**
 * Generate an AI work coaching plan from user's role, current work, and blockers.
 * Falls back to null if unavailable — caller handles the fallback.
 */
export async function generateWorkPlan(role, currentWork, blockers) {
  const system = `You are StriveX AI Work Coach. Be concise, actionable, and specific to ${role}.
Never make up tasks that conflict with the user's described work.
Respond in this exact JSON format:
{
  "coaching_text": "2-3 paragraph coaching insight",
  "tasks": [
    { "title": "task title", "description": "brief description", "priority": 1, "estimated_minutes": 30 }
  ]
}
Priority: 1=high, 2=medium, 3=low. Maximum 5 tasks.`

  const prompt = `Role: ${role}
Current work: ${currentWork}
Blockers: ${blockers || 'None mentioned'}

Generate an action plan that works WITH their existing work, not replacing it.`

  try {
    const raw = await generateContent(prompt, system)
    // Extract JSON from markdown code block if present
    const match = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/({[\s\S]*})/)
    const json = JSON.parse(match?.[1] ?? raw)
    return { ...json, ai_powered: true }
  } catch (e) {
    if (e.message === 'NO_KEY') return null
    console.error('Gemini error:', e)
    return null  // Return null — caller shows fallback
  }
}

/**
 * Parse a voice/text goal description into structured goal data.
 */
export async function parseGoalFromText(text) {
  const prompt = `Parse this goal description into structured data. Return ONLY valid JSON:
{
  "title": "clear goal title",
  "description": "brief description",
  "estimated_hours": 40,
  "tags": ["tag1", "tag2"]
}

User input: "${text}"`

  try {
    const raw = await generateContent(prompt)
    const match = raw.match(/({[\s\S]*})/)
    return JSON.parse(match?.[1] ?? raw)
  } catch {
    return null
  }
}

/**
 * Generate a daily behavioral nudge for the user.
 */
export async function generateNudge(goals, completedCount, streak) {
  const prompt = `The user has ${goals.length} active goals, completed ${completedCount} tasks today, streak: ${streak} days.
Write a single, specific, motivating nudge (max 20 words). Be direct and personal. No generic advice.`
  try {
    return await generateContent(prompt)
  } catch {
    const nudges = [
      'One focused hour beats ten distracted ones.',
      'Your future self is watching. Make them proud.',
      'Progress, not perfection. Keep moving.',
      'The hardest part is starting. You already did.',
      `${streak} day streak. Don't break the chain.`,
    ]
    return nudges[Math.floor(Math.random() * nudges.length)]
  }
}
