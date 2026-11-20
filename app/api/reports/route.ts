import { buildStoredReport } from '../../../lib/operational-reports';
import { NextResponse } from 'next/server';
import { isDate } from '../../../lib/rules';
import { getReports, saveReport } from '../../../lib/db';
import { refinementStyles } from '../../../lib/refinement';
export const runtime = 'nodejs';
export async function GET() {
  return NextResponse.json(getReports());
}
export async function POST(request: Request) {
  try {
    const {
      date,
      extra = '',
      nextSteps = '',
      persist = false,
      body,
      subject,
      originalBody,
      refinedBody,
      refinementStyle,
      refinedAt,
    } = await request.json();
    if (!isDate(date)) return NextResponse.json({ error: 'Data inválida' }, { status: 400 });
    const result = buildStoredReport(date, String(extra), String(nextSteps));
    if (persist) {
      const report = {
        id: crypto.randomUUID(),
        date,
        subject: typeof subject === 'string' ? subject : result.subject,
        body: typeof body === 'string' ? body : result.body,
        originalBody: typeof originalBody === 'string' ? originalBody : result.body,
        refinedBody: typeof refinedBody === 'string' ? refinedBody : null,
        refinementStyle: refinementStyles.includes(refinementStyle) ? refinementStyle : null,
        refinedAt:
          typeof refinedAt === 'string' && Number.isFinite(Date.parse(refinedAt))
            ? refinedAt
            : null,
        createdAt: new Date().toISOString(),
      };
      saveReport(report);
      return NextResponse.json(report);
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Não foi possível gerar o relatório' }, { status: 400 });
  }
}
