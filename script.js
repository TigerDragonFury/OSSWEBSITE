(() => {
  const body = document.body;
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  const closeMenu = () => { nav?.classList.remove('open'); body.classList.remove('menu-open'); menu?.setAttribute('aria-expanded', 'false'); menu?.setAttribute('aria-label', 'Open navigation'); };
  menu?.addEventListener('click', () => { const open = !nav.classList.contains('open'); nav.classList.toggle('open', open); body.classList.toggle('menu-open', open); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation'); });
  nav?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  const header = document.querySelector('.site-header');
  const headerState = () => header?.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', headerState, { passive: true }); headerState();

  const cfg = window.OSS_CONFIG || {};
  async function sb(path, opts = {}) {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    return fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, { ...opts, headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  }

  const form = document.getElementById('rfq-form');
  const status = document.getElementById('form-status');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const button = form.querySelector('button[type=submit]');
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.website) return; // Honeypot: silently ignore automated submissions.
    delete data.website; delete data.consent;
    data.source = 'website'; data.page = location.pathname; data.status = 'new';
    button.disabled = true; button.textContent = 'Sending…'; status.textContent = '';
    try {
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('Missing Supabase configuration');
      const response = await sb('website_inquiries', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(data) });
      if (!response?.ok) throw new Error(`HTTP ${response?.status}`);
      form.reset(); status.textContent = 'Thank you. Your RFQ has been submitted.';
    } catch (error) {
      console.error(error); status.textContent = 'We could not submit the form. Please email commercial@offshoresupportservices.ae or call +971 50 260 6292.';
    } finally { button.disabled = false; button.innerHTML = 'Submit RFQ <span>↗</span>'; }
  });

  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  async function hydrateProjects() { const grid = document.querySelector('[data-projects-grid]'); if (!grid || !cfg.supabaseUrl) return; try { const response = await sb('website_projects?published=eq.true&order=sort_order.asc,created_at.desc&limit=12'); if (!response?.ok) return; const items = await response.json(); if (!items.length) return; grid.innerHTML = items.map((project) => `<article class="project-card"><div class="project-image dynamic" style="background-image:url('${escapeHtml(project.cover_image_url || '')}')"></div><div class="project-caption"><span class="project-tag">${escapeHtml(project.category || 'Project')}</span><strong>${escapeHtml(project.title)}</strong><span>${escapeHtml(project.summary || '')}</span></div></article>`).join(''); } catch (error) { console.warn(error); } }
  async function hydrateGallery() { const grid = document.querySelector('[data-gallery-grid]'); if (!grid || !cfg.supabaseUrl) return; try { const response = await sb('website_gallery?published=eq.true&order=sort_order.asc,created_at.desc&limit=18'); if (!response?.ok) return; const items = await response.json(); if (!items.length) return; grid.innerHTML = items.map((image, index) => `<figure class="${index % 5 === 0 ? 'wide' : ''}"><div class="gallery-img dynamic" style="background-image:url('${escapeHtml(image.image_url || '')}')"></div><figcaption>${escapeHtml(image.caption || 'OSS Marine')}</figcaption></figure>`).join(''); } catch (error) { console.warn(error); } }
  async function hydrateEquipment() { const grid = document.querySelector('[data-equipment-grid]'); if (!grid || !cfg.supabaseUrl) return; try { const response = await sb('website_equipment?published=eq.true&order=sort_order.asc,name.asc&limit=20'); if (!response?.ok) return; const items = await response.json(); if (!items.length) return; grid.innerHTML = items.map((item) => `<article><div class="equipment-icon">▣</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.summary || '')}</p>${item.availability_note ? `<small>${escapeHtml(item.availability_note)}</small>` : ''}</article>`).join(''); } catch (error) { console.warn(error); } }
  hydrateProjects(); hydrateGallery(); hydrateEquipment();
})();
