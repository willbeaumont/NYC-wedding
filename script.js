document.documentElement.classList.add('js');

const WEDDING_DATE = new Date('2026-10-09T11:00:00-04:00');
const countdown = document.querySelector('#countdown');

function updateCountdown(now = new Date()) {
  if (!countdown) return;

  const millisecondsRemaining = WEDDING_DATE.getTime() - now.getTime();
  if (millisecondsRemaining <= 0) {
    countdown.textContent = 'The New York celebration has arrived.';
    return;
  }

  const days = Math.ceil(millisecondsRemaining / 86_400_000);
  countdown.textContent = `${days} ${days === 1 ? 'day' : 'days'} until the Friday celebration.`;
}

function markCurrentItineraryDay(now = new Date()) {
  const dateInNewYork = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  document.querySelectorAll('[data-event-date]').forEach((card) => {
    const isToday = card.dataset.eventDate === dateInNewYork;
    card.classList.toggle('is-today', isToday);
    if (isToday) card.setAttribute('aria-current', 'date');
  });
}

async function copyAddress(button) {
  const address = button.dataset.copy;
  if (!address) return;

  try {
    await navigator.clipboard.writeText(address);
    showToast('Address copied to clipboard.');
  } catch {
    showToast('Copy was unavailable. Select the address above instead.');
  }
}

let toastTimeout;
function showToast(message) {
  const toast = document.querySelector('#copy-toast');
  if (!toast) return;

  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', () => copyAddress(button));
});

updateCountdown();
markCurrentItineraryDay();
