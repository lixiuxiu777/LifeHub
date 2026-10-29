import { z } from 'zod';

export const entityTypes=['Task','CalendarEvent','Expense','Budget','LearningGoal','StudySession','Habit','HabitCheckIn','Bookmark','DashboardPreference'] as const;
export type EntityType=typeof entityTypes[number];
export const cardIds=['tasks','schedule','expenses','learning','habits','collections','quick'] as const;
const id=z.string().uuid();
const title=z.string().trim().min(1,'请填写标题').max(160);
const note=z.string().trim().max(2000).default('');
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(`${s}T00:00:00Z`);return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===s;},'日期无效');
const instant=z.string().datetime({offset:true});
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
  Task:z.object({title,note,dueDate:date,status:z.enum(['todo','done']).default('todo'),priority:z.enum(['normal','high']).default('normal')}).strict(),
  CalendarEvent:z.object({title,note,startAt:instant,endAt:instant,timeZone:z.enum(['Asia/Shanghai','UTC','America/New_York','Europe/London'])}).strict().refine(v=>Date.parse(v.endAt)>Date.parse(v.startAt),'结束时间必须晚于开始时间'),
  Expense:z.object({title,amountMinor,currency,date,category:z.enum(['餐饮','交通','生活','学习','其他']),note}).strict(),
  Budget:z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),amountMinor,currency,note}).strict(),
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
  return null;
}
export function validateBackup(input:unknown):Entity[]{
  const file=z.object({format:z.literal('lifehub-backup'),version:z.literal(2),exportedAt:instant,records:z.array(envelopeSchema).max(1000)}).strict().parse(input);
  const records=file.records.map(v=>({...v,data:parseData(v.type,v.data)})) as Entity[];
  if(new Set(records.map(r=>r.id)).size!==records.length)throw new Error('备份包含重复 ID');
  if(records.filter(r=>r.type==='DashboardPreference').length>1)throw new Error('只能有一份首页配置');
  for(const record of records){
    if(Date.parse(record.updatedAt)<Date.parse(record.createdAt))throw new Error('更新时间早于创建时间');
    const parent=parentOf(record.type,record.data);
    if(parent&&!records.some(r=>r.id===parent.id&&r.type===parent.type))throw new Error('备份缺少关联记录');
  }
  return records.sort((a,b)=>Number(!!parentOf(a.type,a.data))-Number(!!parentOf(b.type,b.data)));
}
