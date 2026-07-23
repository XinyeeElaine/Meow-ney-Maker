// Writes the dashboard's earnings report. This lives server-side for one reason:
// ANTHROPIC_API_KEY must never reach the browser. Supabase verifies the caller's
// JWT before this function runs (verify_jwt defaults to true), so only signed-in
// users get here — the browser sends its token automatically via functions.invoke.
//
// Deploy once:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy report
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Trust boundary: only these keys are read, and each is forced to a number. The
// model never sees free text from the client, so there is nothing to inject through.
const KEYS = ['week', 'month', 'all', 'secs', 'days', 'bestEarned', 'shifts']

const SYSTEM = `You write short earnings reports for Meow-ney Maker, a pixel-art work timer.
Currency is Malaysian Ringgit (RM). Write exactly three short paragraphs of plain prose:
what the numbers say, what pattern stands out, and one practical suggestion.
No headings, no markdown, no bullet points, no emoji. Be concrete about the figures given.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
    const body = await req.json()
    const s = Object.fromEntries(
      KEYS.map((k) => [k, Number(body?.stats?.[k]) || 0]),
    ) as Record<string, number>

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,        // the prompt asks for three short paragraphs
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          'Write my earnings report.',
          `Earned in the last 7 days: RM ${s.week.toFixed(2)}`,
          `Earned in the last 30 days: RM ${s.month.toFixed(2)}`,
          `Earned all time: RM ${s.all.toFixed(2)}`,
          `Total time worked: ${Math.floor(s.secs / 3600)}h ${Math.floor((s.secs % 3600) / 60)}m`,
          `Days worked: ${s.days}`,
          `Shifts logged: ${s.shifts}`,
          `Best single day: RM ${s.bestEarned.toFixed(2)}`,
        ].join('\n'),
      }],
    })

    const text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()

    return json({ text })
  } catch (err) {
    console.error('report failed:', err)
    // The message can carry API detail, so return a flat string, not the object.
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
