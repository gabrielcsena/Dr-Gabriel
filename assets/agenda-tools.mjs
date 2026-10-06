export const ZONE='America/Argentina/Buenos_Aires';
export function meetWindow(start,end,now=Date.now()) {
  if(now>=Date.parse(end))return 'ended';
  return now>=Date.parse(start)-15*60000?'open':'early';
}
export function calendarStamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
}
export function googleCalendarLink(s) {
  const u=new URL('https://calendar.google.com/calendar/render');
  u.search=new URLSearchParams({action:'TEMPLATE',text:'Consulta · Dr. Gabriel C. de Sena',dates:calendarStamp(s.start)+'/'+calendarStamp(s.end),ctz:ZONE,location:s.meet,details:'Consulta online. Horario de Argentina (UTC−3). Google Meet: '+s.meet});
  return u.href;
}
const escapeICS=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
function fold(line) {
  let result='',length=0;const encoder=new TextEncoder();
  for(const char of line) {const size=encoder.encode(char).length;if(length+size>75){result+='\r\n ';length=1;}result+=char;length+=size;}
  return result;
}
export function calendarFile(s,id,now=new Date().toISOString()) {
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Dr Gabriel//Agenda//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    'UID:'+escapeICS(id)+'@dr-gabriel','DTSTAMP:'+calendarStamp(now),'DTSTART:'+calendarStamp(s.start),'DTEND:'+calendarStamp(s.end),
    'SUMMARY:Consulta Dr. Gabriel C. de Sena','LOCATION:'+escapeICS(s.meet),'DESCRIPTION:'+escapeICS('Consulta online. Horario de Argentina (UTC−3).\nGoogle Meet: '+s.meet),
    'BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:Consulta Dr. Gabriel','END:VALARM','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
