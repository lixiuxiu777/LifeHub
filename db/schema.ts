import { sql } from 'drizzle-orm';
import { sqliteTable,text,integer,index,uniqueIndex,check,AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { EntityType } from '../lib/domain';

export const records=sqliteTable('lifehub_records',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),type:text('type').$type<EntityType>().notNull(),data:text('data').notNull(),
  parentId:text('parent_id').references(():AnySQLiteColumn=>records.id,{onDelete:'restrict'}),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),version:integer('version').notNull(),
},t=>[
  index('records_owner_type').on(t.ownerId,t.type),
  uniqueIndex('one_dashboard_per_owner').on(t.ownerId).where(sql`${t.type} = 'DashboardPreference'`),
  uniqueIndex('one_checkin_per_day').on(t.ownerId,sql`json_extract(${t.data}, '$.habitId')`,sql`json_extract(${t.data}, '$.date')`).where(sql`${t.type} = 'HabitCheckIn'`),
  uniqueIndex('one_budget_per_scope').on(t.ownerId,sql`json_extract(${t.data}, '$.month')`,sql`json_extract(${t.data}, '$.currency')`,sql`coalesce(json_extract(${t.data}, '$.category'), '')`).where(sql`${t.type} = 'Budget'`),
]);
export const revisions=sqliteTable('lifehub_revisions',{ownerId:text('owner_id').primaryKey(),revision:integer('revision').notNull()});
export const financeReceipts=sqliteTable('lifehub_finance_receipts',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),digest:text('digest').notNull(),resultId:text('result_id').notNull(),createdAt:text('created_at').notNull()});
export const lifeReceipts=sqliteTable('lifehub_life_receipts',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),digest:text('digest').notNull(),resultId:text('result_id').notNull(),createdAt:text('created_at').notNull()});
export const restoreGuard=sqliteTable('lifehub_restore_guard',{ownerId:text('owner_id').primaryKey(),valid:integer('valid').notNull()},t=>[check('valid_restore_revision',sql`${t.valid} = 1`)]);
export const operations=sqliteTable('lifehub_operations',{
  id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),digest:text('digest').notNull(),label:text('label').notNull(),
  beforeJson:text('before_json'),afterJson:text('after_json'),resultId:text('result_id'),createdAt:text('created_at').notNull(),ordinal:integer('ordinal').notNull(),undone:integer('undone').notNull().default(0),
},t=>[index('operations_owner_ordinal').on(t.ownerId,t.ordinal)]);
