import snapshot from '@/data/northern-ca.json';
import { type Dataset, validateDataset } from '@/lib/audit';
import { guidedAudit, modelAudit, type ModelConfig } from '@/lib/agent';
const data = snapshot as Dataset;
function config(): ModelConfig | null {
  const baseURL = process.env.EQUITY_MODEL_BASE_URL,
    model = process.env.EQUITY_MODEL_NAME;
  return baseURL && model
    ? { baseURL, model, apiKey: process.env.EQUITY_MODEL_API_KEY }
    : null;
}
export async function GET() {
  const c = config();
  return Response.json({
    mode: c ? 'model' : 'guided',
    model: c?.model ?? null,
  });
}
export async function POST(request: Request) {
  if (Number(request.headers.get('content-length') ?? 0) > 4096)
    return Response.json({ error: 'Request is too large.' }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return Response.json({ error: 'Request is too large.' }, { status: 413 });
    const body = JSON.parse(raw);
    if (
      typeof body.question !== 'string' ||
      !body.question.trim() ||
      body.question.length > 800 ||
      !['guided', 'model', undefined].includes(body.mode)
    )
      return Response.json(
        {
          error: 'Provide a question of 1–800 characters and a supported mode.',
        },
        { status: 400 },
      );
    if (validateDataset(data).some((c) => !c.pass))
      return Response.json(
        { error: 'Audit blocked: dataset validation failed.' },
        { status: 503 },
      );
    const c = config();
    if (body.mode === 'model' && !c)
      return Response.json(
        {
          error:
            'No model is configured. Use the guided audit or configure an open local model.',
        },
        { status: 409 },
      );
    const result =
      body.mode === 'model' && c
        ? await modelAudit(data, body.question.trim(), c)
        : guidedAudit(data, body.question.trim());
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof SyntaxError
            ? 'Invalid JSON request.'
            : e instanceof Error
              ? e.message
              : 'Audit failed.',
      },
      { status: 400 },
    );
  }
}
