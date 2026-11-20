import OpenAI from 'openai';
import {applyEditorialPlan,editorialSchema,reportSections,type RefinementStyle} from './refinement';
import type {buildReport} from './rules';

export async function refineReport(original:ReturnType<typeof buildReport>,style:RefinementStyle,client?:OpenAI){
 if(!client&&!process.env.OPENAI_API_KEY)throw new RefinementError('Configure OPENAI_API_KEY no servidor para usar o refinamento.',503);
 const api=client??new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:30000,maxRetries:0});
 const sections=reportSections(original.body);
 try{
 const response=await api.responses.create({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',store:false,max_output_tokens:2000,
 instructions:'Você é um editor de relatórios financeiros. Retorne apenas um plano editorial. Escolha introduction: 0 formal, 1 executivo, 2 detalhado. Ordene TODAS as seções uma única vez, mantendo pendências ao final e consolidado antes das pendências. Não acrescente seções. Não há dados financeiros disponíveis; jamais infira fatos.',
 input:JSON.stringify({style,sections:sections.map(({id,title})=>({id,title:title.match(/^(Demandas|E-mails|Mensagens|Pagamentos|Cobranças|Conciliações|Renegociações|Acompanhamento|Outras|Observações|Consolidado|Pendências)/)?.[0]??'Seção adicional'}))}),
 text:{format:{type:'json_schema',name:'editorial_plan',strict:true,schema:editorialSchema(sections.map(s=>s.id))}}});
 if(response.status!=='completed'||!response.output_text)throw Error('invalid');
 return applyEditorialPlan(original,JSON.parse(response.output_text),style);
 }catch(error){
 if(error instanceof OpenAI.APIError){
 if(error.status===401||error.status===403)throw new RefinementError('Chave OpenAI inválida ou sem acesso ao modelo.',503);
 if(error.status===429)throw new RefinementError('Limite da OpenAI atingido. Tente novamente mais tarde.',429);
 throw new RefinementError('Falha de conexão ou indisponibilidade da OpenAI. O original foi preservado.',502);
 }
 throw new RefinementError('Resposta vazia, incompleta ou inconsistente. O original foi preservado.',502);
 }
}
export class RefinementError extends Error{constructor(message:string,public status:number){super(message)}}
