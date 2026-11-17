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
  const backend = window.BACKEND || {};
  const online = Boolean(backend.supabaseUrl && backend.anonKey);
  form.elements.date.min = localToday();

  // Without a backend the WhatsApp button is the only way to send.
  if (!online) {
    form.querySelector('[data-channel="online"]').hidden = true;
    form.querySelector('[data-channel="whatsapp"]').textContent = 'Send order on WhatsApp';
    form.querySelector('[data-channel="whatsapp"]').className = 'btn';
  }

  const FIELDS = [
    ['name', 'Name'], ['company', 'Company'], ['phone', 'Phone'], ['email', 'Email'],
    ['location', 'Site / City'], ['machine', 'Machine'], ['qty', 'Quantity'], ['rpm', 'RPM'],
    ['power', 'Power'], ['weight', 'Rotor weight'], ['diameter', 'Rotor diameter'],
    ['mounting', 'Mounting'], ['model', 'Brand / Model'], ['symptoms', 'Symptoms'],
    ['reading', 'Vibration reading'], ['service', 'Service'], ['notes', 'Notes'],
    ['date', 'Preferred date'], ['urgency', 'Urgency'],
  ];

  function localToday() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function value(data, key) {
    return (data.get(key) || '').toString().trim();
  }

  function buildMessage(ref) {
    const data = new FormData(form);
    const lines = [`*New Field Balancing Order*${ref ? ` (${ref})` : ''}`, ''];
    FIELDS.forEach(([key, label]) => {
      const val = key === 'symptoms' ? data.getAll(key).join(', ') : value(data, key);
      if (val) lines.push(`${label}: ${val}`);
    });
    return lines.join('\n');
  }

  // Field names the database expects.
  function buildRequest() {
    const data = new FormData(form);
    return {
      customer_name: value(data, 'name'),
      company: value(data, 'company'),
      phone: value(data, 'phone'),
      email: value(data, 'email'),
      location: value(data, 'location'),
      machine_type: value(data, 'machine'),
      quantity: value(data, 'qty'),
      rpm: value(data, 'rpm'),
      power: value(data, 'power'),
      rotor_weight: value(data, 'weight'),
      rotor_diameter: value(data, 'diameter'),
      mounting: value(data, 'mounting'),
      brand_model: value(data, 'model'),
      symptoms: data.getAll('symptoms'),
      vibration_reading: value(data, 'reading'),
      service: value(data, 'service'),
      notes: value(data, 'notes'),
      preferred_date: value(data, 'date'),
      urgency: value(data, 'urgency'),
    };
  }

  async function submitOnline() {
    const res = await fetch(`${backend.supabaseUrl}/rest/v1/rpc/submit_job_request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: backend.anonKey,
        Authorization: `Bearer ${backend.anonKey}`,
      },
      body: JSON.stringify({ p_request: buildRequest() }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      // Database messages are written for customers ("Please enter a valid phone number.").
      throw new Error((body && body.message) || 'Could not send your request.');
    }
    return body;
  }

  function showDone(ref, viaWhatsapp) {
    document.getElementById('orderRef').textContent = ref || '—';
    document.getElementById('doneTitle').textContent = viaWhatsapp ? 'Almost done ✅' : 'Request received ✅';
    document.getElementById('doneText').textContent = viaWhatsapp
      ? 'WhatsApp has opened with your details. Please press Send there. We will call you back to confirm.'
      : "We'll call you to confirm the visit date. Keep this reference for any follow-up.";
    const share = document.getElementById('doneWhatsapp');
    share.hidden = viaWhatsapp;
    share.href = `https://wa.me/${biz.phone}?text=${encodeURIComponent(
      `Hi, I submitted a field balancing request. Reference: ${ref}`)}`;
    form.hidden = true;
    done.hidden = false;
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

    if (!form.checkValidity()) {
      const bad = [...form.elements].filter((el) => el.willValidate && !el.checkValidity());
      bad.forEach((el) => el.classList.add('invalid'));
      showError('Please fill the required fields marked *.');
      bad[0].focus();
      return;
    }
    if (form.elements.website.value) {
      return; // bot
    }

    const channel = e.submitter ? e.submitter.dataset.channel : 'online';
    if (!online || channel === 'whatsapp') {
      window.open(`https://wa.me/${biz.phone}?text=${encodeURIComponent(buildMessage())}`, '_blank', 'noopener');
      showDone('', true);
      return;
    }

    const buttons = form.querySelectorAll('button[type="submit"]');
    buttons.forEach((b) => (b.disabled = true));
    const label = e.submitter.textContent;
    e.submitter.textContent = 'Sending…';
    try {
      showDone(await submitOnline(), false);
    } catch (err) {
      showError(err instanceof TypeError
        ? 'No internet connection. Please try again, or use WhatsApp.'
        : err.message);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
      e.submitter.textContent = label;
    }
  });

  document.getElementById('newOrder').addEventListener('click', () => {
    form.reset();
    done.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth' });
  });
})();
