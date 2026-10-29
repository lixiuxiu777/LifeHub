export const CURRENCIES={CNY:2,USD:2,EUR:2,JPY:0,KWD:3};
export function parseAmount(value,currency){
  if(!Object.hasOwn(CURRENCIES,currency))throw new Error('不支持的货币');
  const precision=CURRENCIES[currency];const text=String(value).trim();
  if(!/^\d+(\.\d+)?$/.test(text))throw new Error('金额必须是正数，不支持科学计数法');
  const [whole,fraction='']=text.split('.');if(fraction.length>precision)throw new Error(`${currency} 最多允许 ${precision} 位小数`);
  const minor=BigInt(whole)*10n**BigInt(precision)+BigInt(fraction.padEnd(precision,'0')||'0');
  if(minor<=0n||minor>1000000000000n)throw new Error('金额必须大于 0 且在支持范围内');return Number(minor);
}
export function amountInput(minor,currency){const value=BigInt(minor),p=CURRENCIES[currency];if(p===undefined)throw new Error('不支持的货币');const text=String(value<0n?-value:value).padStart(p+1,'0');return (value<0n?'-':'')+(p?`${text.slice(0,-p)}.${text.slice(-p)}`:text);}
export function money(minor,currency){
  const value=BigInt(minor),p=CURRENCIES[currency],factor=10n**BigInt(p),absolute=value<0n?-value:value,whole=absolute/factor;
  const fraction=(absolute%factor).toString().padStart(p,'0');
  return (value<0n?'-':'')+new Intl.NumberFormat('zh-CN',{style:'currency',currency,minimumFractionDigits:p,maximumFractionDigits:p}).formatToParts(whole).map(part=>part.type==='fraction'?fraction:part.value).join('');
}
