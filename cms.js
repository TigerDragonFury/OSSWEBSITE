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
  const itemTypeLabel=value=>({vessel:'Vessel',equipment:'Heavy equipment',inventory:'Marine spares'}[value]||'Marine equipment');
  const storeCard=item=>{
    const description=item.summary||'Contact OSS for specifications and availability.',preview=description.length>155?`${description.slice(0,152).trim()}…`:description;
    const price=item.price_amount?new Intl.NumberFormat('en-AE',{style:'currency',currency:item.currency||'AED',maximumFractionDigits:2}).format(item.price_amount):item.price_label||'Price on request',href=`contact.html?interest=${encodeURIComponent(item.title)}#rfq`,canBuy=item.purchasable&&Number(item.price_amount)>0&&(item.stock_quantity===null||Number(item.stock_quantity)>0);
    return `<article class="mc-store-card" data-store-kind="${esc(item.item_type)}"><a class="mc-store-image" href="${esc(href)}"><img src="${esc(safeImage(item.image_url,item.item_type==='vessel'?'/assets/images/fleet-vessel-02.webp':'/assets/images/equipment-rental.webp'))}" alt="${esc(item.title)}"><span>${esc(itemTypeLabel(item.item_type))}</span></a><div class="mc-store-copy"><small>${esc(item.category||itemTypeLabel(item.item_type))}</small><h3>${esc(item.title)}</h3><p class="mc-store-excerpt">${esc(preview)}</p>${description.length>155?`<details class="mc-store-description"><summary>Read full description</summary><p>${esc(description)}</p></details>`:''}<div class="mc-store-meta"><span>${esc(item.condition||'Available')}</span>${item.location?`<span>${esc(item.location)}</span>`:''}${item.stock_quantity!==null?`<span>${esc(item.stock_quantity)} available</span>`:''}</div><strong class="mc-store-price">${esc(price)}</strong><div class="mc-store-actions">${canBuy?`<button class="mc-btn red" type="button" data-cart-add="${attrCart(item.id)}" data-cart-title="${attrCart(item.title)}" data-cart-price="${attrCart(item.price_amount)}" data-cart-currency="${attrCart(item.currency||'AED')}" data-cart-image="${attrCart(safeImage(item.image_url,'/assets/images/equipment-rental.webp'))}" data-cart-max="${attrCart(item.max_order_quantity||10)}">Add to cart</button>`:''}<a class="mc-btn" href="${esc(href)}">Enquire →</a></div></div></article>`;
  };
  const attrCart=value=>esc(value).replace(/\`/g,'&#96;');

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
    const records=await request('website_equipment');if(!records.length)return;const vessels=records.filter(item=>item.source_kind==='vessel'||(!item.source_kind&&isVessel(item))),equipment=records.filter(item=>!vessels.includes(item));
    document.querySelectorAll('[data-cms-vessels]').forEach(target=>{if(!vessels.length)return;const lead=target.querySelector('.mc-fleet-lead')?'<div class="mc-fleet-lead">ERP vessels approved for public display.</div>':'';target.innerHTML=lead+vessels.slice(0,4).map((item,index)=>`<a class="mc-fleet-card" href="contact.html?interest=${encodeURIComponent(item.name)}#rfq"><img src="${esc(safeImage(item.image_url,fleetImages[index%fleetImages.length]))}" alt="${esc(item.name)}"><span>${esc(item.name)}${item.category?` · ${esc(item.category)}`:''}</span></a>`).join('')});
    const target=document.querySelector('[data-cms-equipment]');if(target&&equipment.length)target.innerHTML=equipment.map((item,index)=>`<article class="mc-equipment-card"><img src="${esc(safeImage(item.image_url,'/assets/images/equipment-rental.webp'))}" alt="${esc(item.name)}"><div><small>${String(index+1).padStart(2,'0')} · ${esc(item.category||'Heavy equipment')}</small><h3>${esc(item.name)}</h3><p>${esc(item.summary||item.availability_note||'Contact OSS for availability.')}</p><a class="mc-btn" href="contact.html?interest=${encodeURIComponent(item.name)}#rfq">Request availability →</a></div></article>`).join('');
  }
  async function hydrateStore(){
    let records=[];try{records=await request('website_store_items')}catch(error){records=[]}
    const store=document.querySelector('[data-cms-store]');if(store){if(records.length)store.innerHTML=records.map(storeCard).join('');const buttons=[...document.querySelectorAll('[data-store-filter]')];buttons.forEach(button=>button.addEventListener('click',()=>{buttons.forEach(x=>x.classList.toggle('active',x===button));const kind=button.dataset.storeFilter;store.querySelectorAll('[data-store-kind]').forEach(card=>card.hidden=kind!=='all'&&card.dataset.storeKind!==kind)}))}
    if(!records.length)return;
    const featured=document.querySelector('[data-cms-featured-store]');if(featured){const picks=records.filter(item=>item.featured).slice(0,3);if(picks.length)featured.innerHTML=picks.map(storeCard).join('')}
  }

  const jobs=[];
  if(page==='index.html')jobs.push(hydrateServices(),hydrateEquipment(),hydrateStore());
  if(page==='services.html')jobs.push(hydrateServices());
  if(page==='projects.html')jobs.push(hydrateProjects());
  if(page==='gallery.html')jobs.push(hydrateGallery());
  if(page==='fleet.html')jobs.push(hydrateEquipment());
  if(page==='store.html')jobs.push(hydrateStore());
  Promise.allSettled(jobs).then(()=>document.documentElement.dataset.cms='ready');
})();
