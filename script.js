(() => {
  const body=document.body, menu=document.querySelector('.menu-toggle'), nav=document.querySelector('.nav');
  const closeMenu=()=>{nav?.classList.remove('open');body.classList.remove('menu-open');menu?.setAttribute('aria-expanded','false');menu?.setAttribute('aria-label','Open navigation')};
  menu?.addEventListener('click',()=>{const open=!nav.classList.contains('open');nav.classList.toggle('open',open);body.classList.toggle('menu-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation')});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent=new Date().getFullYear());
  const header=document.querySelector('.site-header'); const headerState=()=>header?.classList.toggle('scrolled',window.scrollY>20); window.addEventListener('scroll',headerState,{passive:true}); headerState();

  const cfg=window.OSS_CONFIG||{};
  async function sb(path,opts={}) { if(!cfg.supabaseUrl||!cfg.supabaseAnonKey) return null; const headers={apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${cfg.supabaseAnonKey}`,'Content-Type':'application/json',...(opts.headers||{})}; return fetch(`${cfg.supabaseUrl}/rest/v1/${path}`,{...opts,headers}); }

  const form=document.getElementById('rfq-form'), status=document.getElementById('form-status');
  form?.addEventListener('submit',async e=>{e.preventDefault(); const btn=form.querySelector('button[type=submit]'); const data=Object.fromEntries(new FormData(form).entries()); delete data.consent; data.source='website'; data.page=location.pathname; data.status='new'; btn.disabled=true; btn.textContent='Sending…'; status.textContent='';
    try { if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){ await new Promise(r=>setTimeout(r,400)); status.textContent='Website is ready. Add Supabase values in config.js to receive RFQs in the admin panel.'; return; }
      const res=await sb('website_inquiries',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(data)}); if(!res?.ok) throw new Error(`HTTP ${res?.status}`); form.reset(); status.textContent='Thank you. Your RFQ has been submitted.';
    } catch(err){ console.error(err); status.textContent='Submission failed. Please email commercial@offshoresupportservices.ae or call +971 50 260 6292.'; }
    finally { btn.disabled=false; btn.textContent='Submit RFQ'; }
  });

  async function hydrateProjects(){const grid=document.querySelector('[data-projects-grid]'); if(!grid||!cfg.supabaseUrl) return; try{const r=await sb('website_projects?published=eq.true&order=sort_order.asc,created_at.desc&limit=12'); if(!r?.ok)return; const items=await r.json(); if(!items.length)return; grid.innerHTML=items.map(p=>`<article class="project-card"><div class="project-image dynamic" style="background-image:url('${escapeHtml(p.cover_image_url||'')}')"></div><div class="project-caption"><span class="project-tag">${escapeHtml(p.category||'Project')}</span><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.summary||'')}</span></div></article>`).join('');}catch(e){console.warn(e)}}
  async function hydrateGallery(){const grid=document.querySelector('[data-gallery-grid]'); if(!grid||!cfg.supabaseUrl)return; try{const r=await sb('website_gallery?published=eq.true&order=sort_order.asc,created_at.desc&limit=18'); if(!r?.ok)return; const items=await r.json(); if(!items.length)return; grid.innerHTML=items.map((x,i)=>`<figure class="${i%5===0?'wide':''}"><div class="gallery-img dynamic" style="background-image:url('${escapeHtml(x.image_url||'')}')"></div><figcaption>${escapeHtml(x.caption||'OSS Marine')}</figcaption></figure>`).join('');}catch(e){console.warn(e)}}
  async function hydrateEquipment(){const grid=document.querySelector('[data-equipment-grid]'); if(!grid||!cfg.supabaseUrl)return; try{const r=await sb('website_equipment?published=eq.true&order=sort_order.asc,name.asc&limit=20'); if(!r?.ok)return; const items=await r.json(); if(!items.length)return; grid.innerHTML=items.map(x=>`<article><div class="equipment-icon">▣</div><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.summary||'')}</p>${x.availability_note?`<small>${escapeHtml(x.availability_note)}</small>`:''}</article>`).join('');}catch(e){console.warn(e)}}
  function escapeHtml(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  hydrateProjects(); hydrateGallery(); hydrateEquipment();
})();
