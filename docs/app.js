'use strict';
const courses = {
  excel: { title: 'Excel para el trabajo', description: 'De una hoja vacía a un reporte claro y útil.', duration: '4 semanas', price: 'S/ 180', schedule: 'Lunes y miércoles, 7:00 a 9:00 p. m. (Perú)', requirements: 'Nivel inicial. Computadora con Microsoft Excel e internet.', topics: ['Organización y limpieza de datos', 'Fórmulas y funciones esenciales', 'Tablas dinámicas y gráficos', 'Proyecto final: reporte de ventas'] },
  power: { title: 'Power BI: datos que cuentan historias', description: 'Conecta tus datos y construye un tablero para tomar decisiones.', duration: '5 semanas', price: 'S/ 240', schedule: 'Martes y jueves, 7:00 a 9:00 p. m. (Perú)', requirements: 'Excel básico. Windows, Power BI Desktop e internet.', topics: ['Importación y limpieza con Power Query', 'Relaciones y modelo de datos', 'Medidas DAX iniciales', 'Proyecto final: tablero de indicadores'] },
  ai: { title: 'IA para tu día a día', description: 'Usa herramientas de inteligencia artificial con propósito y criterio.', duration: '3 semanas', price: 'S/ 150', schedule: 'Sábados, 9:00 a. m. a 12:00 p. m. (Perú)', requirements: 'Nivel inicial. Computadora, navegador e internet.', topics: ['Instrucciones claras y contexto', 'Redacción y síntesis de información', 'Verificación de resultados y privacidad', 'Proyecto final: asistente para una tarea cotidiana'] }
};
const panel = document.querySelector('#chat-panel');
const launcher = document.querySelector('#chat-launcher');
const input = document.querySelector('#chat-input');
const messages = document.querySelector('#messages');
const dialog = document.querySelector('#course-dialog');
const sendButton = document.querySelector('#chat-send');
let history = [], busy = false, previousFocus = launcher, selectedCourse;

function openChat() { previousFocus = document.activeElement; panel.hidden = false; launcher.hidden = true; launcher.setAttribute('aria-expanded', 'true'); input.focus(); }
function closeChat() { panel.hidden = true; launcher.hidden = false; launcher.setAttribute('aria-expanded', 'false'); (previousFocus?.isConnected ? previousFocus : launcher).focus(); }
document.querySelectorAll('[data-chat]').forEach(button => button.addEventListener('click', openChat));
document.querySelector('#chat-close').addEventListener('click', closeChat);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden && !dialog.open) closeChat(); });

document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelectorAll('[data-category]').forEach(card => { card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter; });
}));
document.querySelectorAll('[data-course]').forEach(button => button.addEventListener('click', () => {
  selectedCourse = courses[button.dataset.course];
  document.querySelector('#dialog-title').textContent = selectedCourse.title;
  document.querySelector('#dialog-description').textContent = selectedCourse.description;
  const facts = document.querySelector('#dialog-facts'); facts.replaceChildren();
  for (const [label, value] of [['Duración', selectedCourse.duration], ['Precio total', selectedCourse.price], ['Horario', selectedCourse.schedule], ['Requisitos', selectedCourse.requirements]]) {
    const term = document.createElement('dt'), detail = document.createElement('dd'); term.textContent = label; detail.textContent = value; facts.append(term, detail);
  }
  const topics = document.querySelector('#dialog-topics'); topics.replaceChildren();
  selectedCourse.topics.forEach(text => { const li = document.createElement('li'); li.textContent = text; topics.append(li); });
  dialog.setAttribute('aria-labelledby', 'dialog-title'); dialog.showModal();
}));
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('#dialog-ask').addEventListener('click', () => { dialog.close(); openChat(); input.value = `Me interesa ${selectedCourse.title}. ¿Qué necesito para empezar?`; input.focus(); });

function addMessage(text, role) { const bubble = document.createElement('div'); bubble.className = `bubble ${role}`; bubble.textContent = text; messages.append(bubble); messages.scrollTop = messages.scrollHeight; return bubble; }
async function webhookUrl() {
  const response = await fetch('config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('configuration');
  const config = await response.json();
  if (!config.webhookUrl) throw new Error('configuration');
  const url = new URL(config.webhookUrl);
  if (url.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')) throw new Error('configuration');
  return url.href;
}
async function sendMessage(text) {
  if (busy || !text.trim()) return;
  const message = text.trim().slice(0, 1000);
  busy = true; sendButton.disabled = true; input.disabled = true;
  document.querySelectorAll('[data-question]').forEach(button => { button.disabled = true; });
  addMessage(message, 'user'); input.value = '';
  const pending = addMessage('Consultando tu pregunta…', 'bot');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(await webhookUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history: history.slice(-6) }), signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? 'rate' : 'service');
    const data = await response.json();
    if (data.error || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('service');
    pending.textContent = data.reply;
    history.push({ role: 'user', text: message }, { role: 'model', text: data.reply.slice(0, 1500) }); history = history.slice(-6);
  } catch (error) {
    pending.textContent = error.message === 'rate' ? 'Hemos recibido varias consultas seguidas. Espera un minuto y vuelve a intentarlo.' : 'El asesor no está disponible por el momento. Puedes consultar precios y horarios en los cursos o volver a intentarlo en unos minutos.';
    pending.classList.add('error');
  } finally {
    clearTimeout(timeout); busy = false; sendButton.disabled = false; input.disabled = false;
    document.querySelectorAll('[data-question]').forEach(button => { button.disabled = false; });
    messages.scrollTop = messages.scrollHeight; if (!panel.hidden) input.focus();
  }
}
document.querySelector('#chat-form').addEventListener('submit', event => { event.preventDefault(); void sendMessage(input.value); });
input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void sendMessage(input.value); } });
document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => { void sendMessage(button.dataset.question); }));

if (window.lucide) {
  document.querySelectorAll('button span[aria-hidden], a.button span[aria-hidden]').forEach(span => { if (span.textContent === '↗') { span.textContent = ''; span.dataset.lucide = 'arrow-up-right'; } });
  document.querySelectorAll('.icon-button, .send').forEach(button => { const icon = document.createElement('i'); icon.dataset.lucide = button.classList.contains('send') ? 'arrow-up' : 'x'; button.replaceChildren(icon); });
  lucide.createIcons({ attrs: { width: 20, height: 20, 'aria-hidden': 'true', 'stroke-width': 1.8 } });
}
