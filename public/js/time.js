export function localInput(instant,zone){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant));
  const pick=key=>parts.find(p=>p.type===key).value;return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}
export function localToISO(value,zone){
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('请填写日期和时间');
  const wall=Date.parse(`${value}:00Z`);const matches=[];
  for(let offset=-14*60;offset<=14*60;offset+=15){const candidate=wall-offset*60000;if(localInput(candidate,zone)===value)matches.push(candidate);}
  if(matches.length!==1)throw new Error(matches.length?'该时间处于夏令时重复时段，请选择另一个时间。':'日期无效或处于夏令时跳过时段，请重新选择。');
  return new Date(matches[0]).toISOString();
}
export function formattedDate(key,p){
  if(!key)return '—';const [y,m,d]=key.split('-');
  return p.dateFormat==='yyyy-MM-dd'?key:p.dateFormat==='dd/MM/yyyy'?`${d}/${m}/${y}`:`${y}年${Number(m)}月${Number(d)}日`;
}
export function formattedTime(instant,p){return new Intl.DateTimeFormat('zh-CN',{timeZone:p.timeZone,hour:'2-digit',minute:'2-digit',hour12:p.timeFormat==='12h'}).format(new Date(instant));}
