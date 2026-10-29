import { z } from 'zod';

export const entityTypes=['Task','CalendarEvent','Expense','Budget','LearningGoal','StudySession','Habit','HabitCheckIn','Bookmark','DashboardPreference'] as const;
export type EntityType=typeof entityTypes[number];
export const cardIds=['tasks','schedule','expenses','learning','habits','collections','quick'] as const;
const id=z.string().uuid();
const title=z.string().trim().min(1,'请填写标题').max(160);
const note=z.string().trim().max(2000).default('');
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(`${s}T00:00:00Z`);return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;},'日期无效');
const instant=z.string().datetime({offset:true});
const timeZone=z.enum(['Asia/Shanghai','UTC','America/New_York','Europe/London']);
const repeat=z.object({frequency:z.enum(['daily','weekly','monthly']),interval:z.number().int().min(1).max(30),count:z.number().int().min(2).max(60)}).strict();
const taskSchema=z.object({
  title,description:z.string().trim().max(4000).optional(),note,
  dueDate:date,status:z.enum(['todo','in_progress','done']).default('todo'),priority:z.enum(['low','normal','high','urgent']).default('normal'),
  category:z.string().trim().max(60).default('未分类').transform(v=>v||'未分类'),tags:z.array(z.string().trim().min(1).max(30)).max(20).default([]).transform(v=>[...new Set(v)]),
  timeZone:timeZone.default('Asia/Shanghai'),parentTaskId:id.nullable().default(null),recurrence:repeat.nullable().default(null),
  seriesId:id.nullable().default(null),occurrenceDate:date.nullable().default(null),occurrenceIndex:z.number().int().min(1).max(60).nullable().default(null),
}).strict().transform(({note,description,...value})=>({...value,description:description??note}));
const eventSchema=z.object({
  title,note,allDay:z.boolean().default(false),startAt:instant.nullable().optional(),endAt:instant.nullable().optional(),startDate:date.nullable().optional(),endDate:date.nullable().optional(),timeZone:timeZone.default('Asia/Shanghai'),taskId:id.nullable().default(null),
}).strict().superRefine((v,ctx)=>{
  if(v.allDay){if(!v.startDate||!v.endDate||v.endDate<=v.startDate)ctx.addIssue({code:'custom',message:'全天事件结束日期必须晚于开始日期（结束日期不包含当天）'});if(v.startAt||v.endAt)ctx.addIssue({code:'custom',message:'全天事件不能同时填写时间点'});}
  else{if(!v.startAt||!v.endAt||Date.parse(v.endAt)<=Date.parse(v.startAt))ctx.addIssue({code:'custom',message:'结束时间必须晚于开始时间'});if(v.startDate||v.endDate)ctx.addIssue({code:'custom',message:'指定时间事件不能同时填写全天日期'});}
}).transform(v=>({...v,startAt:v.allDay?null:v.startAt!,endAt:v.allDay?null:v.endAt!,startDate:v.allDay?v.startDate!:null,endDate:v.allDay?v.endDate!:null}));
const currency=z.enum(['CNY','USD','EUR','JPY','KWD']);
// Integer minor units: CNY/USD/EUR=2, JPY=0, KWD=3 decimal places.
const amountMinor=z.number().int().positive().max(1_000_000_000_000);
export const preferenceSchema=z.object({
  theme:z.enum(['system','light','dark']),
  order:z.array(z.enum(cardIds)).length(cardIds.length).refine(a=>new Set(a).size===cardIds.length),
  hidden:z.array(z.enum(cardIds)).max(cardIds.length).refine(a=>new Set(a).size===a.length),
  defaultView:z.enum(['overview','compact','today']),dateFormat:z.enum(['yyyy-MM-dd','dd/MM/yyyy','zh-CN']),timeFormat:z.enum(['24h','12h']),timeZone:z.enum(['Asia/Shanghai','UTC','America/New_York','Europe/London']),
}).strict();
export const payloadSchemas={
  Task:taskSchema,
  CalendarEvent:eventSchema,
  Expense:z.object({title:z.string().trim().max(160).default(''),direction:z.enum(['expense','income']).default('expense'),amountMinor,currency,date,category:z.string().trim().min(1).max(60),paymentMethod:z.enum(['未指定','现金','银行卡','支付宝','微信','转账','其他']).default('未指定'),merchant:z.string().trim().max(160).default(''),tags:z.array(z.string().trim().min(1).max(30)).max(20).default([]).transform(v=>[...new Set(v)]),note}).strict().transform(v=>({...v,title:v.title||`${v.category}${v.direction==='income'?'收入':'支出'}`})),
  Budget:z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),amountMinor,currency,scope:z.enum(['total','category']).default('total'),category:z.string().trim().min(1).max(60).nullable().default(null),note}).strict().refine(v=>v.scope==='category'?!!v.category:v.category===null,'分类预算必须指定分类；总预算不能指定分类'),
  LearningGoal:z.object({title,targetMinutes:z.number().int().min(1).max(1_000_000),status:z.enum(['active','completed']).default('active'),note}).strict(),
  StudySession:z.object({title,goalId:id.nullable().default(null),date,minutes:z.number().int().min(1).max(1440),note}).strict(),
  Habit:z.object({title,note}).strict(),
  HabitCheckIn:z.object({habitId:id,date,note}).strict(),
  Bookmark:z.object({title,url:z.string().trim().url().max(2048).refine(v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}},'只支持不含账号密码的 http/https 链接'),tags:z.string().trim().max(200).default(''),note}).strict(),
  DashboardPreference:preferenceSchema,
};
export type Entity<K extends EntityType=EntityType>={id:string;type:K;createdAt:string;updatedAt:string;version:number;data:z.infer<typeof payloadSchemas[K]>};
export type Task=Entity<'Task'>; export type CalendarEvent=Entity<'CalendarEvent'>; export type Expense=Entity<'Expense'>; export type Budget=Entity<'Budget'>;
export type LearningGoal=Entity<'LearningGoal'>; export type StudySession=Entity<'StudySession'>; export type Habit=Entity<'Habit'>; export type HabitCheckIn=Entity<'HabitCheckIn'>;
export type Bookmark=Entity<'Bookmark'>; export type DashboardPreference=Entity<'DashboardPreference'>;
export const defaultPreference=()=>({theme:'system',order:[...cardIds],hidden:[],defaultView:'overview',dateFormat:'yyyy-MM-dd',timeFormat:'24h',timeZone:'Asia/Shanghai'});
export const envelopeSchema=z.object({id,type:z.enum(entityTypes),createdAt:instant,updatedAt:instant,version:z.number().int().positive().safe(),data:z.unknown()}).strict();
export function parseData(type:EntityType,data:unknown){return payloadSchemas[type].parse(data);}
export function parentOf(type:EntityType,data:any):{id:string;type:EntityType}|null{
  if(type==='HabitCheckIn')return {id:data.habitId,type:'Habit'};
  if(type==='StudySession'&&data.goalId)return {id:data.goalId,type:'LearningGoal'};
  if(type==='Task'&&data.parentTaskId)return {id:data.parentTaskId,type:'Task'};
  if(type==='CalendarEvent'&&data.taskId)return {id:data.taskId,type:'Task'};
  return null;
}
export function validateBackup(input:unknown):Entity[]{
  const file=z.object({format:z.literal('lifehub-backup'),version:z.literal(2),exportedAt:instant,records:z.array(envelopeSchema).max(1000)}).strict().parse(input);
  const preference=file.records.find(v=>v.type==='DashboardPreference');const legacyZone=preference?preferenceSchema.parse(preference.data).timeZone:'Asia/Shanghai';
  const records=file.records.map(v=>{let data=v.data;if(v.type==='Task'&&data&&typeof data==='object'&&!Object.hasOwn(data,'timeZone'))data={...data,timeZone:legacyZone};return {...v,data:parseData(v.type,data)};}) as Entity[];
  if(new Set(records.map(r=>r.id)).size!==records.length)throw new Error('备份包含重复 ID');
  if(records.filter(r=>r.type==='DashboardPreference').length>1)throw new Error('只能有一份首页配置');
  for(const record of records){
    if(Date.parse(record.updatedAt)<Date.parse(record.createdAt))throw new Error('更新时间早于创建时间');
    const parent=parentOf(record.type,record.data);
    if(parent&&!records.some(r=>r.id===parent.id&&r.type===parent.type))throw new Error('备份缺少关联记录');
  }
  return relationOrder(records);
}
export function relationOrder(records:Entity[]):Entity[]{
  const map=new Map(records.map(r=>[r.id,r]));const visited=new Set<string>(),visiting=new Set<string>();const result:Entity[]=[];
  for(const r of records){if(r.type!=='Task')continue;const data=r.data as any;
    if(data.recurrence&&(!data.seriesId||!data.occurrenceDate||!data.occurrenceIndex||data.occurrenceIndex>data.recurrence.count))throw new Error('重复计划缺少有效的实例标识');
    if(!data.recurrence&&(data.seriesId||data.occurrenceDate||data.occurrenceIndex))throw new Error('重复实例缺少规则');
    if(data.parentTaskId&&data.recurrence)throw new Error('重复任务需要为顶层任务');
    let node:Entity|undefined=r;let depth=0;const path=new Set<string>();
    while(node){if(path.has(node.id))throw new Error('子任务关联存在循环');path.add(node.id);const parent=(node.data as any).parentTaskId;if(!parent)break;if(++depth>4)throw new Error('子任务最多支持 5 层');node=map.get(parent);}
  }
  function visit(r:Entity,depth=0){
    if(visiting.has(r.id))throw new Error('记录关联存在循环');if(visited.has(r.id))return;
    if(depth>8)throw new Error('子任务层级过深');visiting.add(r.id);const p=parentOf(r.type,r.data);
    if(p){const parent=map.get(p.id);if(!parent||parent.type!==p.type)throw new Error('关联记录不存在');visit(parent,depth+1);}
    visiting.delete(r.id);visited.add(r.id);result.push(r);
  }
  records.forEach(r=>visit(r));return result;
}
