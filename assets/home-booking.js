'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const calendar = $('whatsapp-calendar');
  if (!calendar) return;
  const phone = '5511994269621';
  const zone = 'America/Argentina/Buenos_Aires';
  let month = '';
  const language = () => document.documentElement.lang.startsWith('es') ? 'es' : 'pt';
  const tr = (pt, es) => language() === 'pt' ? pt : es;
  const locale = () => language() === 'pt' ? 'pt-BR' : 'es-AR';
  function today() {
    const parts = new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const value = type => parts.find(part => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
  }
  const dateFor = key => new Date(key + 'T12:00:00Z');
  function limitFor(start) {
    const date = dateFor(start);
    date.setUTCDate(date.getUTCDate() + 60);
    return date.toISOString().slice(0, 10);
  }
  function shiftMonth(value, amount) {
    const date = dateFor(value + '-01');
    date.setUTCMonth(date.getUTCMonth() + amount);
    return date.toISOString().slice(0, 7);
  }
  function dayLabel(key) {
    return new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', dateStyle: 'full' }).format(dateFor(key));
  }
  function whatsappLink(key) {
    const message = tr(
      `Olá, Dr. Gabriel! Gostaria de agendar uma consulta para ${dayLabel(key)}. Quais horários você tem disponíveis nesse dia?`,
      `¡Hola, Dr. Gabriel! Quisiera agendar una consulta para el ${dayLabel(key)}. ¿Qué horarios tenés disponibles ese día?`
    );
    const url = new URL('https://wa.me/' + phone);
    url.searchParams.set('text', message);
    return url.href;
  }
  function render() {
    const first = today(), last = limitFor(first);
    const minimumMonth = first.slice(0, 7), maximumMonth = last.slice(0, 7);
    if (!month || month < minimumMonth) month = minimumMonth;
    if (month > maximumMonth) month = maximumMonth;
    $('whatsapp-month').textContent = new Intl.DateTimeFormat(locale(), { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(dateFor(month + '-01'));
    for (const [id, label] of [['whatsapp-prev', tr('Mês anterior', 'Mes anterior')], ['whatsapp-next', tr('Próximo mês', 'Mes siguiente')]]) {
      $(id).setAttribute('aria-label', label);
      $(id).title = label;
    }
    $('whatsapp-prev').disabled = month === minimumMonth;
    $('whatsapp-next').disabled = month === maximumMonth;
    const weekdays = language() === 'pt' ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] : ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    $('whatsapp-weekdays').replaceChildren();
    for (const name of weekdays) {
      const label = document.createElement('span'); label.textContent = name; $('whatsapp-weekdays').append(label);
    }
    const days = $('whatsapp-days'); days.replaceChildren();
    const start = dateFor(month + '-01');
    for (let i = 0; i < (start.getUTCDay() + 6) % 7; i++) {
      const gap = document.createElement('span'); gap.setAttribute('aria-hidden', 'true'); days.append(gap);
    }
    const end = dateFor(shiftMonth(month, 1) + '-01'); end.setUTCDate(0);
    for (let n = 1; n <= end.getUTCDate(); n++) {
      const key = month + '-' + String(n).padStart(2, '0');
      const enabled = key >= first && key <= last;
      const day = document.createElement(enabled ? 'a' : 'span');
      day.className = 'calendar-day' + (enabled ? '' : ' is-disabled') + (key === first ? ' is-today' : '');
      day.textContent = String(n);
      if (key === first) day.setAttribute('aria-current', 'date');
      if (enabled) {
        day.href = whatsappLink(key); day.target = '_blank'; day.rel = 'noopener noreferrer';
        day.setAttribute('aria-label', tr('Solicitar consulta para ', 'Solicitar consulta para el ') + dayLabel(key));
      } else day.setAttribute('aria-disabled', 'true');
      days.append(day);
    }
    $('online-booking').href = 'agendar.html?lang=' + language();
  }
  $('whatsapp-choose').addEventListener('click', () => {
    calendar.hidden = !calendar.hidden;
    $('whatsapp-choose').setAttribute('aria-expanded', String(!calendar.hidden));
    if (!calendar.hidden) {
      render();
      const day = $('whatsapp-days').querySelector('a');
      if (day) day.focus({ preventScroll: true });
    }
  });
  $('whatsapp-prev').addEventListener('click', () => { month = shiftMonth(month, -1); render(); });
  $('whatsapp-next').addEventListener('click', () => { month = shiftMonth(month, 1); render(); });
  document.addEventListener('site-language-change', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('focus', render);
  const header = document.querySelector('header');
  function headerHeight() {
    if (header) document.documentElement.style.setProperty('--header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
  }
  if (header && typeof ResizeObserver !== 'undefined') new ResizeObserver(headerHeight).observe(header);
  window.addEventListener('resize', headerHeight);
  headerHeight();
  render();
})();
