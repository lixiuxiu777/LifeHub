export function dateKey(value,timeZone='Asia/Shanghai'){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const pick=key=>parts.find(p=>p.type===key).value;return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
export function addDays(key,count){const d=new Date(`${key}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+count);return d.toISOString().slice(0,10);}
