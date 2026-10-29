import {escape} from './html-utils.js';
import {dateKey} from './date-utils.js';
import {CURRENCIES,amountInput,parseAmount} from './money.js';
import {paymentMethods} from './finance-data.js';
const options=(items,value)=>items.map(v=>`<option value="${escape(v)}" ${v===value?'selected':''}>${escape(v)}</option>`).join('');
export function financeForm(type,record,store,p){
  const today=dateKey(new Date(),p.timeZone),d={currency:'CNY',direction:'expense',date:today,month:today.slice(0,7),scope:'total',paymentMethod:'未指定',...(record?.data||{})};
  const field=(name,label,control,full=false)=>`<label class="form-field ${full?'full':''}" for="f-${name}"><span>${label}</span>${control}</label>`;
  const input=(name,kind='text',extra='')=>`<input id="f-${name}" name="${name}" type="${kind}" value="${escape(d[name]||'')}" ${extra}>`;
  const select=(name,items)=>`<select id="f-${name}" name="${name}">${options(items,d[name])}</select>`;
  const categories=[...new Set(['餐饮','交通','生活','学习','工资','其他',...store.list('Expense').map(r=>r.data.category),...store.list('Budget').map(r=>r.data.category).filter(Boolean)])];
  const category=field('category',type==='Budget'?'预算分类（分类预算必填）':'分类',input('category','text',`maxlength="60" list="finance-categories" ${type==='Expense'?'required':''}`))+`<datalist id="finance-categories">${options(categories,'')}</datalist>`;
  let controls=field('currency','币种',select('currency',Object.keys(CURRENCIES)))+field('amount','金额',`<input id="f-amount" name="amount" inputmode="decimal" maxlength="20" value="${d.amountMinor?amountInput(d.amountMinor,d.currency):''}" placeholder="例如 26.50" required>`);
  if(type==='Expense')controls=field('direction','收支类型',`<select id="f-direction" name="direction"><option value="expense" ${d.direction==='expense'?'selected':''}>支出</option><option value="income" ${d.direction==='income'?'selected':''}>收入</option></select>`)+controls+field('date','记录日期',input('date','date','required'))+category+field('paymentMethod','支付方式',select('paymentMethod',paymentMethods))+field('title','标题（可选）',input('title','text','maxlength="160" placeholder="留空时使用分类和收支类型"'))+field('merchant','商家 / 对方（可选）',input('merchant','text','maxlength="160"'))+field('tags','标签（可选，以逗号分隔）',`<input id="f-tags" name="tags" maxlength="640" value="${escape((d.tags||[]).join(', '))}">`);
  else controls=field('month','预算月份',input('month','month','required'))+field('scope','预算范围',`<select id="f-scope" name="scope"><option value="total" ${d.scope==='total'?'selected':''}>每月总预算</option><option value="category" ${d.scope==='category'?'selected':''}>分类预算</option></select>`)+controls+category;
  controls+=field('note','备注',`<textarea id="f-note" name="note" maxlength="2000" rows="3">${escape(d.note||'')}</textarea>`,true);
  return `<h2 id="dialog-title">${record?.id?'编辑':'新增'}${type==='Expense'?'收支记录':'月度预算'}</h2><p class="dialog-description">金额按币种精度保存；CNY / USD / EUR 为 2 位，JPY 为 0 位，KWD 为 3 位。日期是账务日期，不随时区移动。${type==='Budget'?'总预算与分类预算独立计算，收入不抵扣支出。':''}</p><form id="record-form" data-type="${type}" data-operation-id="${crypto.randomUUID()}" ${record?.id?`data-id="${record.id}" data-version="${record.version}"`:''}><div class="form-grid">${controls}</div><p id="form-error" class="form-error" role="alert" hidden></p><div class="dialog-footer"><button type="button" class="button outline" data-action="close-dialog">取消</button><button class="button solid" type="submit">保存${type==='Expense'?'收支记录':'预算'}</button></div></form>`;
}
export function parseFinanceForm(form){
  const raw=Object.fromEntries(new FormData(form));const d=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,String(v).trim()]));
  d.amountMinor=parseAmount(d.amount,d.currency);delete d.amount;
  if(form.dataset.type==='Expense'){d.tags=d.tags.split(/[,，]/).map(v=>v.trim()).filter(Boolean);if(d.tags.length>20||d.tags.some(v=>v.length>30))throw new Error('最多 20 个标签，每个不超过 30 字');d.tags=[...new Set(d.tags)];}
  else{d.category=d.scope==='total'?null:d.category;if(d.scope==='category'&&!d.category)throw new Error('请填写预算分类');}
  return d;
}
