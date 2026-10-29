import {amountInput,CURRENCIES} from './money.js';
export const paymentMethods=['未指定','现金','银行卡','支付宝','微信','转账','其他'];
export function shiftFinanceMonth(month,delta){const [y,m]=month.split('-').map(Number);const index=y*12+m-1+delta;if(index<12||index>119999)return month;return `${String(Math.floor(index/12)).padStart(4,'0')}-${String(index%12+1).padStart(2,'0')}`;}
const sum=rows=>rows.reduce((total,r)=>total+BigInt(r.data.amountMinor),0n);
export const percent=(part,total)=>total>0n?`${(part*10000n/total)/100n}.${String(part*10000n/total%100n).padStart(2,'0')}`:'0.00';
export const ratio=(part,total)=>total>0n?Number(part*10000n/total)/100:0;
export function financeSummary(records,month,currency){
  const entries=records.filter(r=>r.type==='Expense'&&r.data.date.slice(0,7)===month&&r.data.currency===currency);
  const expenses=entries.filter(r=>r.data.direction!=='income'),incomes=entries.filter(r=>r.data.direction==='income');
  const spent=sum(expenses),income=sum(incomes),net=income-spent;
  const categoryMap=new Map();for(const r of expenses)categoryMap.set(r.data.category,(categoryMap.get(r.data.category)||0n)+BigInt(r.data.amountMinor));
  const categories=[...categoryMap].map(([name,amount])=>({name,amount})).sort((a,b)=>a.amount===b.amount?a.name.localeCompare(b.name):a.amount>b.amount?-1:1);
  const budgets=records.filter(r=>r.type==='Budget'&&r.data.month===month&&r.data.currency===currency).map(record=>{const amount=BigInt(record.data.amountMinor),used=record.data.category?categoryMap.get(record.data.category)||0n:spent;return {record,amount,spent:used,remaining:amount-used,usage:percent(used,amount)};});
  return {entries,expenses,incomes,spent,income,net,categories,budgets,total:budgets.find(b=>!b.record.data.category),allocated:budgets.filter(b=>b.record.data.category).reduce((n,b)=>n+b.amount,0n)};
}
export function filterFinance(entries,state){
  const search=String(state.search||'').trim().toLocaleLowerCase();
  return entries.filter(r=>{const d=r.data;return (!state.from||d.date>=state.from)&&(!state.to||d.date<=state.to)&&(!state.category||d.category===state.category)&&(!state.direction||d.direction===state.direction)&&(!state.paymentMethod||d.paymentMethod===state.paymentMethod)&&(!search||[d.title,d.note,d.category,d.merchant,...(d.tags||[])].join(' ').toLocaleLowerCase().includes(search));}).sort((a,b)=>b.data.date.localeCompare(a.data.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
}
export function financeTrend(records,month,currency,count=6){return Array.from({length:count},(_,i)=>{const key=shiftFinanceMonth(month,i-count+1);const s=financeSummary(records,key,currency);return {month:key,spent:s.spent,income:s.income,net:s.net,count:s.entries.length};});}
const csvCell=(value,user=false)=>{let s=String(value??'');if(user&&/^[\s\uFEFF]*[=+\-@]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
export function financeExport(records,state,format,now=new Date()){
  const s=financeSummary(records,state.month,state.currency),rows=filterFinance(s.entries,state),currency=state.currency;
  if(!Object.hasOwn(CURRENCIES,currency))throw new Error('不支持的货币');
  if(format==='month-json')return {body:JSON.stringify({format:'lifehub-finance-month',version:1,exportedAt:now.toISOString(),month:state.month,currency,precision:CURRENCIES[currency],amountStrategy:'integer minor units; aggregate integers are decimal strings',totals:{expenseMinor:String(s.spent),incomeMinor:String(s.income),netMinor:String(s.net)},records:s.entries,budgets:s.budgets.map(b=>({...b.record,statistics:{spentMinor:String(b.spent),remainingMinor:String(b.remaining),usagePercent:b.usage}}))},null,2),extension:'json',count:s.entries.length,mime:'application/json'};
  const headers=format==='budget-csv'?['月份','币种','小数位','预算范围','分类','预算金额','已支出','剩余预算','使用率%','备注']:['ID','日期','收支','币种','小数位','金额','分类','支付方式','商家','标签','标题','备注','创建时间','更新时间'];
  const lines=[headers.map(v=>csvCell(v)).join(',')];
  if(format==='budget-csv')for(const b of s.budgets){const d=b.record.data;lines.push([csvCell(d.month),csvCell(currency),csvCell(CURRENCIES[currency]),csvCell(d.category?'分类':'总预算'),csvCell(d.category||'',true),csvCell(amountInput(b.amount,currency)),csvCell(amountInput(b.spent,currency)),csvCell(amountInput(b.remaining,currency)),csvCell(b.usage),csvCell(d.note,true)].join(','));}
  else for(const r of rows){const d=r.data;lines.push([csvCell(r.id),csvCell(d.date),csvCell(d.direction==='income'?'收入':'支出'),csvCell(currency),csvCell(CURRENCIES[currency]),csvCell(amountInput(d.amountMinor,currency)),... [d.category,d.paymentMethod,d.merchant,(d.tags||[]).join('；'),d.title,d.note].map(v=>csvCell(v,true)),csvCell(r.createdAt),csvCell(r.updatedAt)].join(','));}
  return {body:'\uFEFF'+lines.join('\r\n')+'\r\n',extension:'csv',count:format==='budget-csv'?s.budgets.length:rows.length,mime:'text/csv; charset=utf-8'};
}
