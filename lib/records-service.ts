import {z} from 'zod';
import {entityTypes} from './domain';
import {authorize,json,readJson} from './auth-service';
import {plannerMutation} from './planner-service';
import {financeMutation} from './finance-service';
import {lifeMutation} from './life-service';
import {mutationState} from './state-service';
export {authorize,json,readJson,safely} from './auth-service';
export {ApiError} from './api-error';
export {snapshot,stateKey} from './record-utils';
export {restore} from './backup-service';
const mutation=z.object({id:z.string().uuid().optional(),type:z.enum(entityTypes),version:z.number().int().positive().safe().optional(),data:z.unknown().optional(),operationId:z.string().uuid()}).strict();
export async function mutate(request:Request,method:string){
  const {user,db}=await authorize(request,true),input=mutation.parse(await readJson(request));
  const result=input.type==='Task'||input.type==='CalendarEvent'?await plannerMutation(db,user.userId,input,method):input.type==='Expense'||input.type==='Budget'?await financeMutation(db,user.userId,input,method):await lifeMutation(db,user.userId,input,method);
  return json(await mutationState(db,user.userId,result),method==='POST'?201:200);
}
