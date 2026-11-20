import type {PendingTask} from './collection-types';
export function reconcileTasks(existing:PendingTask[],generated:PendingTask[]){
 const desired=new Map(generated.map(t=>[t.id,t]));
 const result=existing.map(old=>{
  const next=desired.get(old.id);desired.delete(old.id);
  if(old.status==='done')return old;
  if(!next)return {...old,status:'cancelled' as const};
  if(old.status==='deferred')return {...next,...old,reason:next.reason,recommendation:next.recommendation};
  return {...old,...next,createdAt:old.createdAt};
 });
 return [...result,...desired.values()];
}
