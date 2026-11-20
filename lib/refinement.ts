import {buildReport} from './rules';

export const refinementStyles = ['formal','executive','detailed'] as const;
export type RefinementStyle = typeof refinementStyles[number];
export const introductions = [
 'Apresento as atividades e os acompanhamentos financeiros da data de referência.',
 'Segue o panorama financeiro da data de referência, com as atividades registradas e as pendências em acompanhamento.',
 'Apresento o detalhamento das atividades financeiras e dos acompanhamentos registrados para revisão.'
] as const;
export function reportSections(body:string){
 return [...body.matchAll(/^\d+\. (.+)$/gm)].map((m,i,all)=>({id:`section_${i}`,title:m[1],content:body.slice(m.index!+m[0].length,all[i+1]?.index??body.lastIndexOf('Permaneço à disposição')).trim()}));
}
export function editorialSchema(ids:string[]){return {type:'object',additionalProperties:false,required:['introduction','sections'],properties:{introduction:{type:'integer',enum:[0,1,2]},sections:{type:'array',items:{type:'string',enum:ids.length?ids:['none']}}}};}
export function applyEditorialPlan(original:ReturnType<typeof buildReport>,raw:unknown,style:RefinementStyle){
 if(!raw||typeof raw!=='object')throw Error('Resposta inválida');
 const plan=raw as {introduction:number;sections:string[]};
 const sections=reportSections(original.body);
 if(Object.keys(raw).sort().join(',')!=='introduction,sections'||!Number.isInteger(plan.introduction)||!introductions[plan.introduction]||!Array.isArray(plan.sections)||plan.sections.length!==sections.length||new Set(plan.sections).size!==sections.length||plan.sections.some(id=>!sections.some(s=>s.id===id)))throw Error('Divergência na estrutura da resposta. O original foi preservado.');
 const blocks=plan.sections.map((id,i)=>{const s=sections.find(s=>s.id===id)!;return `${i+1}. ${s.title}\n\n${s.content}`});
 // All facts, free text, statuses and calculated totals are immutable server-owned blocks.
 const body=['Prezadas, boa tarde!','',introductions[plan.introduction],'',blocks.join('\n\n'),'', 'Permaneço à disposição para eventuais orientações.','','Atenciosamente,','Elisa Anjo'].join('\n');
 return {subject:original.subject,body,style};
}
