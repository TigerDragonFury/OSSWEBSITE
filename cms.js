/* Public CMS hydration. Reads sanitized website_* projections only; never ERP tables. */
(()=>{
  const cfg=window.OSS_CONFIG||{},page=location.pathname.split('/').pop()||'index.html';
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey)return;
  const esc=(value='')=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const safeImage=(value,fallback)=>{const url=String(value||'').trim();return /^(https?:\/\/|\/|assets\/)/i.test(url)?url:fallback};
  const request=async table=>{
    const response=await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?select=*&published=eq.true&order=sort_order.asc`,{headers:{apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${cfg.supabaseAnonKey}`}});
    if(!response.ok)throw new Error(`${table} unavailable`);
    return response.json();
  };
  const serviceHref=slug=>['vessel-charter','ship-repair','fabrication','equipment-rental','container-refurbishment','scrap-surplus'].includes(slug)?`services/${slug}.html`:'contact.html#rfq';
  const fleetImages=['/assets/images/fleet-vessel-01.webp','/assets/images/fleet-vessel-02.webp','/assets/images/fleet-vessel-03.webp','/assets/images/fleet-vessel-04.webp'];
  const isVessel=item=>/vessel|tug|barge|boat|craft|ship|marine/i.test(`${item.category||''} ${item.name||''}`);

  async function hydrateServices(){
    const records=await request('website_services');if(!records.length)return;
    const overview=document.querySelector('[data-cms-services]');
    if(overview)overview.innerHTML=records.map((item,index)=>`<article class="mc-card"><small>${String(index+1).padStart(2,'0')}</small><h3>${esc(item.name)}</h3><p>${esc(item.summary||'Contact OSS for scope and availability.')}</p><a class="mc-btn" href="${esc(serviceHref(item.slug))}">Know more →</a></article>`).join('');
    const home=document.querySelector('[data-cms-home-services]');
    if(home&&records.length>=3)home.innerHTML=records.slice(0,6).map(item=>`<a class="mc-service-card" href="${esc(serviceHref(item.slug))}"><h3>${esc(item.name)}</h3><span class="mc-arrow">→</span></a>`).join('');
  }
  async function hydrateProjects(){
    const records=await request('website_projects');if(!records.length)return;const target=document.querySelector('[data-cms-projects]');if(!target)return;
    target.innerHTML=records.map((item,index)=>`<article class="mc-project"><img src="${esc(safeImage(item.cover_image_url,['/assets/images/yard-fabrication.webp','/assets/images/vessel-charter.webp','/assets/images/inspection-repair.webp','/assets/images/marine-logistics.webp'][index%4]))}" alt=""><div><small>${esc(item.category||'Marine project')}</small><h3>${esc(item.title)}</h3>${item.summary?`<p>${esc(item.summary)}</p>`:''}</div></article>`).join('');
  }
  async function hydrateGallery(){
    const records=await request('website_gallery');if(!records.length)return;const target=document.querySelector('[data-cms-gallery]');if(!target)return;
    target.innerHTML=records.map(item=>`<article class="mc-gallery-item"><img src="${esc(safeImage(item.image_url,'/assets/images/marine-logistics.webp'))}" alt="${esc(item.caption||'OSS Marine operation')}"><div><small>Operations</small><h3>${esc(item.caption||'OSS Marine')}</h3></div></article>`).join('');
  }
  async function hydrateEquipment(){
    const records=await request('website_equipment');if(!records.length)return;const vessels=records.filter(isVessel),equipment=records.filter(item=>!isVessel(item));
    document.querySelectorAll('[data-cms-vessels]').forEach(target=>{if(!vessels.length)return;const lead=target.querySelector('.mc-fleet-lead')?'<div class="mc-fleet-lead">ERP fleet records approved for public display.</div>':'';target.innerHTML=lead+vessels.slice(0,4).map((item,index)=>`<a class="mc-fleet-card" href="contact.html#rfq"><img src="${fleetImages[index%fleetImages.length]}" alt=""><span>${esc(item.name)}${item.category?` · ${esc(item.category)}`:''}</span></a>`).join('')});
    const target=document.querySelector('[data-cms-equipment]');if(target&&equipment.length)target.innerHTML=equipment.map((item,index)=>`<article class="mc-card"><small>${String(index+1).padStart(2,'0')}</small><h3>${esc(item.name)}</h3><p>${esc(item.summary||item.availability_note||'Contact OSS for availability.')}</p></article>`).join('');
  }

  const jobs=[];
  if(page==='index.html')jobs.push(hydrateServices(),hydrateEquipment());
  if(page==='services.html')jobs.push(hydrateServices());
  if(page==='projects.html')jobs.push(hydrateProjects());
  if(page==='gallery.html')jobs.push(hydrateGallery());
  if(page==='fleet.html')jobs.push(hydrateEquipment());
  Promise.allSettled(jobs).then(()=>document.documentElement.dataset.cms='ready');
})();
