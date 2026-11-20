import { NextResponse } from 'next/server';
import { isLocalRequest } from '../../../../lib/local-request';
import { RefinementError,refineReport } from '../../../../lib/openai-refine';
import { buildStoredReport } from '../../../../lib/operational-reports';
import { refinementStyles } from '../../../../lib/refinement';
import { isDate } from '../../../../lib/rules';
export const runtime = 'nodejs';
let busy = false;
export async function POST(request: Request) {
  if (!isLocalRequest(request))
    return NextResponse.json({ error: 'Origem não permitida.' }, { status: 403 });
  if (busy)
    return NextResponse.json({ error: 'Um refinamento já está em andamento.' }, { status: 429 });
  busy = true;
  try {
    if (!request.headers.get('content-type')?.includes('application/json'))
      return NextResponse.json({ error: 'JSON obrigatório.' }, { status: 415 });
    const text = await request.text();
    if (text.length > 40000)
      return NextResponse.json({ error: 'Solicitação muito extensa.' }, { status: 413 });
    const { date, extra = '', nextSteps = '', originalBody, style = 'formal' } = JSON.parse(text);
    if (
      !isDate(date) ||
      !refinementStyles.includes(style) ||
      typeof extra !== 'string' ||
      typeof nextSteps !== 'string' ||
      extra.length > 10000 ||
      nextSteps.length > 10000
    )
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
    const original = buildStoredReport(date, extra, nextSteps);
    if (typeof originalBody !== 'string' || originalBody !== original.body)
      return NextResponse.json(
        {
          error:
            'Os registros ou parâmetros mudaram. Gere novamente o relatório padrão antes de refinar.',
        },
        { status: 409 },
      );
    const refined = await refineReport(original, style);
    return NextResponse.json({ original, refined, generatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof RefinementError
            ? error.message
            : 'Não foi possível refinar. O original foi preservado.',
      },
      { status: error instanceof RefinementError ? error.status : 400 },
    );
  } finally {
    busy = false;
  }
}
