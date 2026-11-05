(function () {
  const biz = window.BUSINESS;

  // Fill business details into the page
  document.querySelectorAll('[data-biz]').forEach((el) => {
    const key = el.dataset.biz;
    el.textContent = key === 'phone' ? biz.phoneDisplay : biz[key];
  });
  document.querySelectorAll('.js-whatsapp').forEach((a) => {
    a.href = `https://wa.me/${biz.phone}?text=${encodeURIComponent('Hi, I need field balancing service.')}`;
    a.target = '_blank';
    a.rel = 'noopener';
  });
  document.querySelectorAll('.js-call').forEach((a) => (a.href = `tel:+${biz.phone}`));
  document.querySelectorAll('.js-mail').forEach((a) => (a.href = `mailto:${biz.email}`));
  document.getElementById('year').textContent = new Date().getFullYear();

  // Mobile menu
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') links.classList.remove('open');
  });

  // Order form
  const form = document.getElementById('orderForm');
  const done = document.getElementById('orderDone');
  const errorBox = form.querySelector('.form-error');
  form.elements.date.min = new Date().toISOString().slice(0, 10);

  const FIELDS = [
    ['name', 'Name'], ['company', 'Company'], ['phone', 'Phone'], ['email', 'Email'],
    ['location', 'Site / City'], ['machine', 'Machine'], ['qty', 'Quantity'], ['rpm', 'RPM'],
    ['power', 'Power'], ['weight', 'Rotor weight'], ['diameter', 'Rotor diameter'],
    ['mounting', 'Mounting'], ['model', 'Brand / Model'], ['symptoms', 'Symptoms'],
    ['reading', 'Vibration reading'], ['service', 'Service'], ['notes', 'Notes'],
    ['date', 'Preferred date'], ['urgency', 'Urgency'],
  ];

  function makeRef() {
    const d = new Date();
    const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
    return `FB-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function buildMessage(ref) {
    const data = new FormData(form);
    const lines = [`*New Field Balancing Order* (${ref})`, ''];
    FIELDS.forEach(([key, label]) => {
      const val = key === 'symptoms' ? data.getAll(key).join(', ') : (data.get(key) || '').toString().trim();
      if (val) lines.push(`${label}: ${val}`);
    });
    return lines.join('\n');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

    if (!form.checkValidity()) {
      const bad = [...form.elements].filter((el) => el.willValidate && !el.checkValidity());
      bad.forEach((el) => el.classList.add('invalid'));
      errorBox.textContent = 'Please fill the required fields marked *.';
      errorBox.hidden = false;
      bad[0].focus();
      return;
    }

    const ref = makeRef();
    const msg = buildMessage(ref);
    const channel = e.submitter ? e.submitter.dataset.channel : 'whatsapp';

    if (channel === 'email') {
      const subject = `Field balancing order ${ref}`;
      window.location.href = `mailto:${biz.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg.replace(/\*/g, ''))}`;
    } else {
      window.open(`https://wa.me/${biz.phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    }

    document.getElementById('orderRef').textContent = ref;
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.getElementById('newOrder').addEventListener('click', () => {
    form.reset();
    done.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth' });
  });
})();
