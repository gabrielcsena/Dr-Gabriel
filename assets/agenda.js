'use strict';
import {ZONE,meetWindow,googleCalendarLink,calendarFile} from './agenda-tools.mjs?v=12';
(() => {
  const $=id=>document.getElementById(id), cfg=window.AGENDA_CONFIG || {};
  let lang=new URLSearchParams(location.search).get('lang')==='pt'?'pt':'es';
  const tr=(es,pt)=>lang==='pt'?pt:es;
  const base=(cfg.apiBase || '').replace(/\/$/,'');
  let selected=null, selectedPrice=null, config={}, booking=null, status=null, poll=null, timer=null, feedbackTimer=null, requestNo=0, challenge=null, challengeToken='', widget=null;
  const storageKey='dr-gabriel-reservation';
  const time=s=>new Intl.DateTimeFormat(lang==='pt'?'pt-BR':'es-AR',{timeZone:'America/Argentina/Buenos_Aires',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
  const longTime=s=>new Intl.DateTimeFormat(lang==='pt'?'pt-BR':'es-AR',{timeZone:'America/Argentina/Buenos_Aires',dateStyle:'full',timeStyle:'short',hour12:false}).format(new Date(s));
  function translate() {
    document.documentElement.lang=lang==='pt'?'pt-BR':'es-AR';
    $('language').textContent=lang==='pt'?'ES':'PT';
    document.querySelectorAll('[data-es]').forEach(el=>el.textContent=el.dataset[lang]);
    if(selected)$('selection').textContent=longTime(selected);
    showPrice(status?.price ?? selectedPrice);
    if(status)renderStatus(status);
  }
  $('language').onclick=()=>{lang=lang==='pt'?'es':'pt';translate();if(!booking && base)loadSlots();};
  document.querySelectorAll('.contact').forEach(a=>{a.href=`https://wa.me/${cfg.doctorWhatsApp || '5511994269621'}`;a.target='_blank';a.rel='noopener noreferrer';});
  function err(code) {
    if(code==='price_changed')return tr('El precio de la fecha elegida cambió o la página está desactualizada. Actualizá la página y elegí el horario otra vez.','O valor da data escolhida mudou ou a página está desatualizada. Atualize a página e escolha o horário novamente.');
    const errors={slot_taken:tr('Ese horario acaba de ocuparse. Elegí otro.','Esse horário acabou de ser ocupado. Escolha outro.'),invalid_patient:tr('Completá tu nombre y un WhatsApp válido con + y código de país.','Preencha seu nome e um WhatsApp válido com + e código do país.'),invalid_slot:tr('El horario ya no está disponible. Elegí otro.','O horário já não está disponível. Escolha outro.'),too_many_requests:tr('Demasiados intentos. Esperá un minuto y volvé a probar.','Muitas tentativas. Aguarde um minuto e tente novamente.'),too_many_reservations:tr('Ya tenés reservas pendientes. Terminá el pago antes de reservar otro horario.','Você já tem reservas pendentes. Conclua o pagamento antes de reservar outro horário.'),bot_verification_failed:tr('Repetí la verificación y volvé a intentar.','Repita a verificação e tente novamente.'),not_found:tr('No encontramos esta reserva. Contactá al doctor por WhatsApp.','Não encontramos essa reserva. Entre em contato com o médico pelo WhatsApp.')};
    return errors[code] || tr('No pudimos conectar con la agenda. Probá de nuevo o escribime por WhatsApp.','Não conseguimos conectar à agenda. Tente novamente ou fale comigo pelo WhatsApp.');
  }
  async function api(path,options={}) {
    const r=await fetch(base+path,{...options,signal:AbortSignal.timeout(20000)});
    let data;try{data=await r.json();}catch{throw new Error('service_unavailable');}
    if(!r.ok)throw new Error(data.error || 'service_unavailable');return data;
  }
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function showPrice(price) {
    if(!Number.isInteger(price) || price<=0)return;
    const amount='ARS '+new Intl.NumberFormat('es-AR').format(price);
    $('price').textContent=amount;$('pay').textContent=tr('Continuar al pago · ','Continuar para pagamento · ')+amount;
  }
  async function loadSlots() {
    const seq=++requestNo;selected=null;selectedPrice=null;$('patient').hidden=true;$('slots').replaceChildren();$('error').textContent='';
    $('slots-message').textContent=tr('Buscando horarios disponibles…','Buscando horários disponíveis…');
    try{
      const r=await api('/slots?date='+encodeURIComponent($('date').value));if(seq!==requestNo)return;
      if(!Number.isInteger(r.price) || r.price<=0)throw new Error('service_unavailable');
      selectedPrice=r.price;showPrice(r.price);
      $('slots-message').textContent=r.slots.length?'':tr('No hay horarios disponibles para este día. Elegí otra fecha.','Não há horários disponíveis nesse dia. Escolha outra data.');
      for(const s of r.slots) {
        const b=document.createElement('button');b.type='button';b.className='slot';b.textContent=time(s);b.setAttribute('aria-pressed','false');
        b.onclick=()=>{selected=s;$('slots').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('selection').textContent=longTime(s);$('patient').hidden=false;document.querySelectorAll('.steps li').forEach((x,i)=>x.classList.toggle('active',i===1));setupChallenge();$('name').focus({preventScroll:true});};$('slots').append(b);
      }
    }catch(e){if(seq!==requestNo)return;$('slots-message').textContent='';$('error').textContent=err(e.message);}
  }
  async function setupChallenge() {
    if(!config.turnstileSiteKey || widget!==null)return;
    try {
      if(!challenge)challenge=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=resolve;s.onerror=reject;document.head.append(s);});
      await challenge;if(widget!==null)return;
      widget=window.turnstile.render('#challenge',{sitekey:config.turnstileSiteKey,action:'booking',callback:token=>challengeToken=token,'expired-callback':()=>challengeToken=''});
    }catch{$('error').textContent=err('bot_verification_failed');}
  }
  function save(b) {booking=b;try{localStorage.setItem(storageKey,JSON.stringify(b));}catch{}}
  $('form').onsubmit=async e=>{
    e.preventDefault();if(!selected || !selectedPrice)return;
    const phone=$('phone').value.trim().replace(/[\s()-]/g,'');
    if(!/^\+[1-9]\d{7,14}$/.test(phone)){$('error').textContent=err('invalid_patient');$('phone').focus();return;}
    $('pay').disabled=true;$('error').textContent='';
    try {
      const b=await api('/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:selected,price:selectedPrice,lang,name:$('name').value.trim(),phone,turnstileToken:challengeToken})});
      save({id:b.id,token:b.token});
      $('form').hidden=true;$('result').hidden=false;
      renderStatus({status:'reserved',start:selected,price:selectedPrice,expires:b.expires,checkout:b.checkout});
      // Persist only the random confirmation key. Names and phone are not stored in this browser.
      if(!safeCheckout(b.checkout))throw new Error('payment_unavailable');
      location.assign(b.checkout);
    }catch(e){$('error').textContent=err(e.message);if(e.message==='slot_taken'||e.message==='invalid_slot')await loadSlots();if(widget!==null){window.turnstile.reset(widget);challengeToken='';}}
    finally{$('pay').disabled=false;}
  };
  function safeMeet(link){try{const u=new URL(link);return u.protocol==='https:'&&u.hostname==='meet.google.com';}catch{return false;}}
  function safeCheckout(link){try{const u=new URL(link);return u.protocol==='https:'&&(u.hostname==='mercadopago.com.ar'||u.hostname.endsWith('.mercadopago.com.ar'));}catch{return false;}}
  function renderStatus(s) {
    status=s;$('form').hidden=true;$('result').hidden=false;
    $('result-date').textContent=new Intl.DateTimeFormat(lang==='pt'?'pt-BR':'es-AR',{timeZone:ZONE,dateStyle:'full'}).format(new Date(s.start));
    $('result-time').textContent=time(s.start);showPrice(s.price);
    const diagnostics=$('test-diagnostics');
    if(diagnostics) {
      diagnostics.hidden=cfg.testMode!==true || !s.testDiagnostic;
      const labels={payment_not_found:tr('El servidor todavía no encontró el pago de esta reserva.','O servidor ainda não encontrou o pagamento desta reserva.'),payment_not_approved:tr('Mercado Pago todavía no informa el pago como aprobado.','O Mercado Pago ainda não informa o pagamento como aprovado.'),payment_reference_mismatch:tr('El pago encontrado corresponde a otra reserva.','O pagamento encontrado corresponde a outra reserva.'),payment_currency_mismatch:tr('La moneda del pago no coincide con ARS.','A moeda do pagamento não corresponde a ARS.'),payment_amount_mismatch:tr('El importe del pago no coincide con el valor de esta reserva.','O valor do pagamento não corresponde ao valor desta reserva.'),payment_recipient_mismatch:tr('La cuenta que recibió el pago no coincide con MP_COLLECTOR_ID.','A conta que recebeu o pagamento não corresponde a MP_COLLECTOR_ID.'),payment_mode_mismatch:tr('El modo del pago no coincide con MP_LIVE_MODE, o Mercado Pago no informó ese dato.','O modo do pagamento não corresponde a MP_LIVE_MODE, ou o Mercado Pago não informou esse dado.'),payment_validated:tr('El pago fue encontrado y validado.','O pagamento foi encontrado e validado.'),verification_unavailable:tr('Falló la consulta a Mercado Pago o Google; el servidor volverá a intentar.','A consulta ao Mercado Pago ou Google falhou; o servidor tentará novamente.')};
      diagnostics.textContent=s.testDiagnostic?tr('Diagnóstico de prueba: ','Diagnóstico do teste: ')+(s.testDiagnostic.codes||[]).map(code=>labels[code]||tr('Verificación en curso.','Verificação em andamento.')).join(' ')+(s.testDiagnostic.providerStatus?` (HTTP ${s.testDiagnostic.providerStatus})`:''):'';
    }
    for(const id of ['checkout','confirmed-tools','again'])$(id).hidden=true;
    const messages={
      reserved:[tr('Tu horario está reservado','Seu horário está reservado'),tr('Completá el pago antes de que termine la reserva. Si ya pagaste, estamos verificando la aprobación.','Conclua o pagamento antes do fim da reserva. Se já pagou, estamos verificando a aprovação.')],
      confirming:[tr('Pago aprobado','Pagamento aprovado'),tr('Estamos creando el enlace de tu videollamada. La confirmación aparecerá acá.','Estamos criando o link da sua videochamada. A confirmação aparecerá aqui.')],
      confirmed:[tr('Tu consulta está confirmada','Sua consulta está confirmada'),tr('Tu consulta está agendada para la fecha y el horario de abajo. Guardá los datos y el enlace. La videollamada comienza en el horario acordado.','Sua consulta está agendada para a data e o horário abaixo. Salve os dados e o link. A videochamada começa no horário combinado.')],
      expired:[tr('La reserva venció','A reserva expirou'),tr('El horario fue liberado. Si pagaste, conservá el comprobante y contactá al doctor antes de volver a pagar.','O horário foi liberado. Se você pagou, guarde o comprovante e fale com o médico antes de pagar novamente.')],
      refunding:[tr('Estamos solicitando tu reembolso','Estamos solicitando seu reembolso'),tr('No pudimos confirmar el horario. No vuelvas a pagar mientras procesamos la devolución.','Não conseguimos confirmar o horário. Não pague novamente enquanto processamos a devolução.')],
      refunded:[tr('Reembolso solicitado','Reembolso solicitado'),tr('El horario no pudo confirmarse y Mercado Pago recibió la devolución. El plazo para acreditarla depende del medio de pago.','Não foi possível confirmar o horário e o Mercado Pago recebeu a devolução. O prazo para o valor voltar depende do meio de pagamento.')],
      failed:[tr('No pudimos iniciar el pago','Não conseguimos iniciar o pagamento'),tr('Elegí otro horario o contactá al doctor.','Escolha outro horário ou fale com o médico.')]
    };
    const m=messages[s.status]||messages.confirming;$('result-title').textContent=m[0];$('result-detail').textContent=m[1];$('status-icon').textContent=s.status==='confirmed'?'✓':'◷';
    document.querySelectorAll('.steps li').forEach((x,i)=>x.classList.toggle('active',i===2));
    if(s.checkout && safeCheckout(s.checkout)){$('checkout').href=s.checkout;$('checkout').hidden=false;}
    if(s.status==='confirmed' && safeMeet(s.meet)) {
      $('confirmed-tools').hidden=false;$('meet-link').value=s.meet;
      $('google-calendar').href=googleCalendarLink(s);
      const ics=calendarFile(s,booking.id);
      if($('ics').href.startsWith('blob:'))URL.revokeObjectURL($('ics').href);
      $('ics').href=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));$('ics').download='consulta-dr-gabriel.ics';
    }
    if(['expired','refunded','failed'].includes(s.status))$('again').hidden=false;
    clearInterval(timer);timer=null;$('countdown').textContent='';
    if(s.status==='confirmed' && safeMeet(s.meet)){updateMeet();timer=setInterval(updateMeet,15000);}
    if(s.status==='reserved') {
      const tick=()=>{const n=Math.max(0,Math.ceil((Date.parse(s.expires)-Date.now())/1000));$('countdown').textContent=tr('Tiempo restante: ','Tempo restante: ')+Math.floor(n/60)+':'+String(n%60).padStart(2,'0');if(!n)$('checkout').hidden=true;};tick();timer=setInterval(tick,1000);
    }
  }
  function updateMeet() {
    const state=meetWindow(status.start,status.end),enabled=state==='open';
    $('meet').setAttribute('aria-disabled',String(!enabled));
    if(enabled)$('meet').href=status.meet;else $('meet').removeAttribute('href');
    $('meet').textContent=enabled?tr('Entrar a la consulta','Entrar na consulta'):state==='early'?tr('Disponible 15 minutos antes','Disponível 15 minutos antes'):tr('Horario de la consulta finalizado','Horário da consulta encerrado');
    $('meet-message').textContent=state==='early'?tr('La consulta todavía no comenzó. Este botón se habilita 15 minutos antes. Podés guardar el enlace ahora.','A consulta ainda não começou. Este botão fica disponível 15 minutos antes. Você pode salvar o link agora.'):state==='open'?tr('Ya podés abrir la sala. El doctor te atenderá en el horario reservado.','Você já pode abrir a sala. O médico atenderá no horário reservado.'):tr('El horario reservado ya terminó. Para coordinar con el doctor, usá WhatsApp.','O horário reservado já terminou. Para combinar com o médico, use o WhatsApp.');
  }
  $('meet').onclick=e=>{if(meetWindow(status.start,status.end)!=='open'){e.preventDefault();updateMeet();}};
  async function check() {
    if(!booking || !base)return;
    try{const s=await api('/status?id='+encodeURIComponent(booking.id),{headers:{Authorization:'Bearer '+booking.token}});$('error').textContent='';renderStatus(s);if(['confirmed','refunded','failed'].includes(s.status)){clearTimeout(poll);return;}}
    catch(e){$('error').textContent=err(e.message);if(e.message==='not_found'){clearTimeout(poll);$('again').hidden=false;return;}}
    poll=setTimeout(check,15000);
  }
  function confirmationText() {
    const link=new URL('agendar.html',location.href);link.hash=`booking=${booking.id}&token=${booking.token}`;link.search='';
    if(lang==='pt')link.search='?lang=pt';
    return `Consulta confirmada · Dr. Gabriel C. de Sena\n${longTime(status.start)}\n${tr('Horario de Argentina (UTC−3)','Horário da Argentina (UTC−3)')}\nGoogle Meet: ${status.meet}\n${tr('Tu confirmación privada (no la compartas):','Sua confirmação privada (não compartilhe):')} ${link.href}`;
  }
  async function copyText(text,field) {
    clearTimeout(feedbackTimer);field.hidden=false;field.value=text;let copied=false;
    try {await navigator.clipboard.writeText(text);copied=true;}catch {field.focus();field.select();try{copied=document.execCommand('copy');}catch{}}
    $('copy-feedback').textContent=copied?tr('¡Copiado! Podés volver a copiar cuando quieras.','Copiado! Você pode copiar novamente quando quiser.'):tr('El navegador no permitió copiar. Seleccioná el texto de abajo y usá Copiar o Ctrl+C.','O navegador não permitiu copiar. Selecione o texto abaixo e use Copiar ou Ctrl+C.');
    if(copied)feedbackTimer=setTimeout(()=>{$('copy-feedback').textContent='';},3000);
  }
  $('copy').onclick=()=>copyText(confirmationText(),$('confirmation-text'));
  $('copy-meet').onclick=()=>copyText(status.meet,$('meet-link'));
  $('meet-link').onclick=()=>{$('meet-link').select();};
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && status?.status==='confirmed')updateMeet();});
  $('again').onclick=()=>{
    booking=null;status=null;clearTimeout(poll);clearInterval(timer);clearTimeout(feedbackTimer);try{localStorage.removeItem(storageKey);}catch{};
    if($('ics').href.startsWith('blob:'))URL.revokeObjectURL($('ics').href);
    $('result').hidden=true;$('form').hidden=false;$('confirmation-text').hidden=true;$('copy-feedback').textContent='';loadSlots();
  };
  $('date').onchange=loadSlots;
  async function init() {
    $('test-mode').hidden=cfg.testMode!==true;
    translate();$('date').min=today();$('date').value=today();
    const fragment=new URLSearchParams(location.hash.slice(1));
    if(/^[a-f0-9]{32}$/.test(fragment.get('booking')||'') && /^[\da-f-]{36}$/.test(fragment.get('token')||'')) {
      save({id:fragment.get('booking'),token:fragment.get('token')});history.replaceState(null,'',location.pathname+(lang==='pt'?'?lang=pt':''));
    }else{try{booking=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}}
    if(!base){$('unconfigured').hidden=false;$('form').hidden=true;return;}
    try {
      config=await api('/config');const end=new Date(Date.now()+config.bookingDays*86400000);$('date').max=new Intl.DateTimeFormat('en-CA',{timeZone:config.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(end);
      if(booking){$('form').hidden=true;$('result').hidden=false;$('result-title').textContent=tr('Buscando tu reserva…','Buscando sua reserva…');await check();}else await loadSlots();
    }catch(e){$('error').textContent=err(e.message);}
  }
  init();
})();
