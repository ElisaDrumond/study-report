import {NextResponse} from 'next/server';
import {buildReport,isDate} from '../../../lib/rules';
import {getEntries,getReports,getTasks,saveReport} from '../../../lib/db';
export const runtime='nodejs';
export async function GET(){return NextResponse.json(getReports())}
export async function POST(request:Request){try{const {date,extra='',nextSteps='',persist=false,body,subject}=await request.json();if(!isDate(date))return NextResponse.json({error:'Data inválida'},{status:400});const result=buildReport(date,getEntries(),getTasks(),String(extra),String(nextSteps));if(persist){const report={id:crypto.randomUUID(),date,subject:typeof subject==='string'?subject:result.subject,body:typeof body==='string'?body:result.body,createdAt:new Date().toISOString()};saveReport(report);return NextResponse.json(report)}return NextResponse.json(result)}catch{return NextResponse.json({error:'Não foi possível gerar o relatório'},{status:400})}}
