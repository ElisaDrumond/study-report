import { NextResponse } from 'next/server';
import { isLocalRequest } from '../../../lib/local-request';
import { mutateOperation, processOperations } from '../../../lib/operations-store';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json(processOperations());
  } catch {
    return NextResponse.json(
      { error: 'Não foi possível carregar a central operacional.' },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  if (!isLocalRequest(request))
    return NextResponse.json({ error: 'Origem não permitida' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 2000000)
      return NextResponse.json({ error: 'Solicitação muito extensa' }, { status: 413 });
    const command = JSON.parse(raw);
    if (!command || typeof command !== 'object' || Array.isArray(command))
      throw Error('Solicitação inválida');
    if (raw.length > 100000 && command.type !== 'import_clients')
      return NextResponse.json({ error: 'Solicitação muito extensa' }, { status: 413 });
    return NextResponse.json(mutateOperation(command));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && !error.message.includes('SQLITE')
            ? error.message
            : 'Não foi possível registrar a operação.',
      },
      { status: 400 },
    );
  }
}
