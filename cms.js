/* Public CMS hydration. Reads sanitized website_* projections only; never ERP tables. */
(()=>{
  const cfg=window.OSS_CONFIG||{},page=(location.pathname.replace(/\/$/,'').split('/').pop()||'index').replace(/\.html$/,'');
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey)return;
  const esc=(value='')=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const safeImage=(value,fallback)=>{const url=String(value||'').trim();return /^(https?:\/\/|\/|assets\/)/i.test(url)?url:fallback};
  const request=async table=>{
    const response=await fetch(`${cfg.supabaseUrl}/rest/v1/${table}?select=*&published=eq.true&order=sort_order.asc`,{headers:{apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${cfg.supabaseAnonKey}`}});
    if(!response.ok)throw new Error(`${table} unavailable`);
    return response.json();
  };
  const serviceHref=slug=>['vessel-charter','ship-repair','fabrication','equipment-rental','container-refurbishment','scrap-surplus'].includes(slug)?`services/${slug}`:'contact#rfq';
  const fleetImages=['/assets/images/fleet-vessel-01.webp','/assets/images/fleet-vessel-02.webp','/assets/images/fleet-vessel-03.webp','/assets/images/fleet-vessel-04.webp'];
  const isVessel=item=>/vessel|tug|barge|boat|craft|ship|marine/i.test(`${item.category||''} ${item.name||''}`);
  const itemTypeLabel=value=>({vessel:'Vessel',equipment:'Heavy equipment',inventory:'Marine spares'}[value]||'Marine equipment');
  const addCartIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.1M9.5 20a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Zm7 0a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z"/></svg>';
  const storeCard=item=>{
    const description=item.summary||'Contact OSS for specifications and availability.',preview=description.length>155?`${description.slice(0,152).trim()}…`:description,make=String(item.make||''),model=String(item.model||''),year=item.model_year||'';
    const price=item.price_amount?new Intl.NumberFormat('en-AE',{style:'currency',currency:item.currency||'AED',maximumFractionDigits:2}).format(item.price_amount):item.price_label||'Price on request',href=`contact?interest=${encodeURIComponent(item.title)}#rfq`,canBuy=item.purchasable&&Number(item.price_amount)>0&&(item.stock_quantity===null||Number(item.stock_quantity)>0);
    return `<article class="mc-store-card" data-store-kind="${esc(item.item_type)}" data-store-id="${attrCart(item.id)}"><a class="mc-store-image" href="${esc(href)}"><img src="${esc(safeImage(item.image_url,item.item_type==='vessel'?'/assets/images/fleet-vessel-02.webp':'/assets/images/equipment-rental.webp'))}" loading="lazy" decoding="async" alt="${esc(item.title)}"><span>${esc(itemTypeLabel(item.item_type))}</span></a><div class="mc-store-copy"><small>${esc(item.category||itemTypeLabel(item.item_type))}</small><h3><a href="${esc(href)}">${esc(item.title)}</a></h3>${make||model||year?`<p class="mc-store-spec">${esc([make,model,year].filter(Boolean).join(' · '))}</p>`:''}<p class="mc-store-excerpt">${esc(preview)}</p>${description.length>155?`<details class="mc-store-description"><summary>Read full description</summary><p>${esc(description)}</p></details>`:''}<div class="mc-store-meta"><span>${esc(item.condition||'Available')}</span>${item.location?`<span>${esc(item.location)}</span>`:''}${item.stock_quantity!==null?`<span>${esc(item.stock_quantity)} available</span>`:''}</div><strong class="mc-store-price">${esc(price)}</strong><div class="mc-store-actions">${canBuy?`<button class="mc-btn red mc-cart-add" type="button" aria-label="Add ${attrCart(item.title)} to cart" data-cart-add="${attrCart(item.id)}" data-cart-title="${attrCart(item.title)}" data-cart-price="${attrCart(item.price_amount)}" data-cart-currency="${attrCart(item.currency||'AED')}" data-cart-image="${attrCart(safeImage(item.image_url,'/assets/images/equipment-rental.webp'))}" data-cart-max="${attrCart(item.max_order_quantity||10)}"><span class="mc-cart-add-icon">${addCartIcon}</span><span>Add</span></button>`:''}<a class="mc-btn" href="${esc(href)}">Enquire →</a></div></div></article>`;
  };
  const attrCart=value=>esc(value).replace(/\`/g,'&#96;');

  function setupStoreCatalogue(records,store){
    const search=document.querySelector('[data-catalog-search]'),kind=document.querySelector('[data-filter-kind]'),category=document.querySelector('[data-filter-category]'),make=document.querySelector('[data-filter-make]'),model=document.querySelector('[data-filter-model]'),condition=document.querySelector('[data-filter-condition]'),availability=document.querySelector('[data-filter-availability]'),minimum=document.querySelector('[data-filter-min]'),maximum=document.querySelector('[data-filter-max]'),sort=document.querySelector('[data-store-sort]'),count=document.querySelector('[data-results-count]'),empty=document.querySelector('[data-no-results]'),panel=document.querySelector('[data-filter-panel]'),backdrop=document.querySelector('.mc-filter-backdrop'),toggle=document.querySelector('[data-filter-toggle]');
    if(!search||!records.length)return;
    const unique=key=>[...new Set(records.map(item=>String(item[key]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const options=(select,values,label)=>{select.innerHTML=`<option value="all">All ${label}</option>`+values.map(value=>`<option value="${attrCart(value.toLowerCase())}">${esc(value)}</option>`).join('');select.closest('label').hidden=values.length===0};
    options(category,unique('category'),'categories');options(make,unique('make'),'makes');options(model,unique('model'),'models');options(condition,unique('condition'),'conditions');
    const openFilters=open=>{panel?.classList.toggle('open',open);if(backdrop)backdrop.hidden=!open;toggle?.setAttribute('aria-expanded',String(open));document.body.classList.toggle('filters-open',open)};
    let view='grid';try{view=localStorage.getItem('oss-store-view')||'grid'}catch(error){}
    const setView=value=>{view=value==='list'?'list':'grid';store.dataset.catalogueView=view;document.querySelectorAll('[data-store-view]').forEach(button=>{const active=button.dataset.storeView===view;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});try{localStorage.setItem('oss-store-view',view)}catch(error){}};
    const apply=()=>{
      const query=search.value.trim().toLowerCase(),min=minimum.value===''?null:Number(minimum.value),max=maximum.value===''?null:Number(maximum.value);
      let result=records.filter(item=>{const price=item.price_amount===null||item.price_amount===''?null:Number(item.price_amount),stock=item.stock_quantity===null?null:Number(item.stock_quantity),text=[item.title,item.sku,item.category,item.make,item.model,item.summary].join(' ').toLowerCase();return (!query||text.includes(query))&&(kind.value==='all'||item.item_type===kind.value)&&(category.value==='all'||String(item.category||'').toLowerCase()===category.value)&&(make.value==='all'||String(item.make||'').toLowerCase()===make.value)&&(model.value==='all'||String(item.model||'').toLowerCase()===model.value)&&(condition.value==='all'||String(item.condition||'').toLowerCase()===condition.value)&&(availability.value==='all'||(availability.value==='purchase'&&item.purchasable&&price>0)||(availability.value==='quote'&&!item.purchasable)||(availability.value==='stock'&&stock>0)||(availability.value==='out'&&stock===0))&&(min===null||(price!==null&&price>=min))&&(max===null||(price!==null&&price<=max))});
      const mode=sort.value;result.sort((a,b)=>mode==='newest'?String(b.created_at||'').localeCompare(String(a.created_at||'')):mode==='title'?String(a.title||'').localeCompare(String(b.title||'')):mode==='price-asc'?(a.price_amount==null?Infinity:Number(a.price_amount))-(b.price_amount==null?Infinity:Number(b.price_amount)):mode==='price-desc'?(b.price_amount==null?-Infinity:Number(b.price_amount))-(a.price_amount==null?-Infinity:Number(a.price_amount)):(Number(b.featured)-Number(a.featured))||(Number(a.sort_order)-Number(b.sort_order)));
      store.innerHTML=result.map(storeCard).join('');count.textContent=String(result.length);empty.hidden=result.length!==0;const active=[kind,category,make,model,condition,availability].filter(select=>select.value!=='all').length+(minimum.value!==''?1:0)+(maximum.value!==''?1:0);document.querySelectorAll('[data-filter-count]').forEach(node=>node.textContent=String(active));const params=new URLSearchParams(),checkout=new URLSearchParams(location.search).get('checkout');if(checkout)params.set('checkout',checkout);if(query)params.set('q',search.value.trim());[[kind,'type'],[category,'category'],[make,'make'],[model,'model'],[condition,'condition'],[availability,'availability'],[sort,'sort']].forEach(([input,key])=>{if(input.value!=='all'&&!(key==='sort'&&input.value==='featured'))params.set(key,input.value)});if(minimum.value!=='')params.set('min',minimum.value);if(maximum.value!=='')params.set('max',maximum.value);history.replaceState(null,'',`${location.pathname}${params.size?`?${params}`:''}${location.hash}`);
    };
    [search,minimum,maximum].forEach(input=>input.addEventListener('input',apply));[kind,category,make,model,condition,availability,sort].forEach(select=>select.addEventListener('change',apply));
    document.querySelectorAll('[data-store-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.storeView)));document.querySelectorAll('[data-filter-clear]').forEach(button=>button.addEventListener('click',()=>{search.value='';[kind,category,make,model,condition,availability].forEach(select=>select.value='all');minimum.value='';maximum.value='';sort.value='featured';apply();openFilters(false)}));
    toggle?.addEventListener('click',()=>openFilters(!panel.classList.contains('open')));document.querySelectorAll('[data-filter-close]').forEach(button=>button.addEventListener('click',()=>openFilters(false)));const initial=new URLSearchParams(location.search);search.value=initial.get('q')||'';[[kind,'type'],[category,'category'],[make,'make'],[model,'model'],[condition,'condition'],[availability,'availability'],[sort,'sort']].forEach(([input,key])=>{const value=initial.get(key);if(value&&[...input.options].some(option=>option.value===value))input.value=value});minimum.value=initial.get('min')||'';maximum.value=initial.get('max')||'';setView(view);apply();
  }

  async function hydrateServices(){
    const records=await request('website_services');if(!records.length)return;
    const overview=document.querySelector('[data-cms-services]');
    if(overview)overview.innerHTML=records.map((item,index)=>`<article class="mc-card"><small>${String(index+1).padStart(2,'0')}</small><h3>${esc(item.name)}</h3><p>${esc(item.summary||'Contact OSS for scope and availability.')}</p><a class="mc-btn" href="${esc(serviceHref(item.slug))}">Know more →</a></article>`).join('');
    const home=document.querySelector('[data-cms-home-services]');
    if(home&&records.length>=3)home.innerHTML=records.slice(0,6).map(item=>`<a class="mc-service-card" href="${esc(serviceHref(item.slug))}"><h3>${esc(item.name)}</h3><span class="mc-arrow">→</span></a>`).join('');
  }
  async function hydrateProjects(){
    const records=await request('website_projects');if(!records.length)return;const target=document.querySelector('[data-cms-projects]');if(!target)return;
    target.innerHTML=records.map((item,index)=>`<article class="mc-project"><img src="${esc(safeImage(item.cover_image_url,['/assets/images/yard-fabrication.webp','/assets/images/vessel-charter.webp','/assets/images/inspection-repair.webp','/assets/images/marine-logistics.webp'][index%4]))}" loading="lazy" decoding="async" alt=""><div><small>${esc(item.category||'Marine project')}</small><h3>${esc(item.title)}</h3>${item.summary?`<p>${esc(item.summary)}</p>`:''}</div></article>`).join('');
  }
  async function hydrateGallery(){
    const records=await request('website_gallery');if(!records.length)return;const target=document.querySelector('[data-cms-gallery]');if(!target)return;
    target.innerHTML=records.map(item=>`<article class="mc-gallery-item"><img src="${esc(safeImage(item.image_url,'/assets/images/marine-logistics.webp'))}" loading="lazy" decoding="async" alt="${esc(item.caption||'OSS Marine operation')}"><div><small>Operations</small><h3>${esc(item.caption||'OSS Marine')}</h3></div></article>`).join('');
  }
  async function hydrateEquipment(){
    const records=await request('website_equipment');if(!records.length)return;const vessels=records.filter(item=>item.source_kind==='vessel'||(!item.source_kind&&isVessel(item))),equipment=records.filter(item=>!vessels.includes(item));
    document.querySelectorAll('[data-cms-vessels]').forEach(target=>{if(!vessels.length)return;const lead=target.querySelector('.mc-fleet-lead')?'<div class="mc-fleet-lead">ERP vessels approved for public display.</div>':'';target.innerHTML=lead+vessels.slice(0,4).map((item,index)=>`<a class="mc-fleet-card" href="contact?interest=${encodeURIComponent(item.name)}#rfq"><img src="${esc(safeImage(item.image_url,fleetImages[index%fleetImages.length]))}" loading="lazy" decoding="async" alt="${esc(item.name)}"><span>${esc(item.name)}${item.category?` · ${esc(item.category)}`:''}</span></a>`).join('')});
    const target=document.querySelector('[data-cms-equipment]');if(target&&equipment.length)target.innerHTML=equipment.map((item,index)=>`<article class="mc-equipment-card"><img src="${esc(safeImage(item.image_url,'/assets/images/equipment-rental.webp'))}" loading="lazy" decoding="async" alt="${esc(item.name)}"><div><small>${String(index+1).padStart(2,'0')} · ${esc(item.category||'Heavy equipment')}</small><h3>${esc(item.name)}</h3><p>${esc(item.summary||item.availability_note||'Contact OSS for availability.')}</p><a class="mc-btn" href="contact?interest=${encodeURIComponent(item.name)}#rfq">Request availability →</a></div></article>`).join('');
  }
  async function hydrateStore(){
    let records=[];try{records=await request('website_store_items')}catch(error){records=[]}
    const store=document.querySelector('[data-cms-store]');if(store&&records.length)setupStoreCatalogue(records,store);
    if(!records.length)return;
    const featured=document.querySelector('[data-cms-featured-store]');if(featured){const picks=records.filter(item=>item.featured).slice(0,10);if(picks.length)featured.innerHTML=picks.map(storeCard).join('')}if(page==='store'){const schema=document.createElement('script');schema.type='application/ld+json';schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'ItemList',itemListElement:records.map((item,index)=>{const image=safeImage(item.image_url,'');return {'@type':'ListItem',position:index+1,item:{'@type':'Product',name:item.title,description:item.summary||undefined,image:image?new URL(image,location.origin).href:undefined,sku:item.sku||undefined,brand:item.make?{'@type':'Brand',name:item.make}:undefined,offers:item.price_amount?{'@type':'Offer',price:String(item.price_amount),priceCurrency:item.currency||'AED',availability:Number(item.stock_quantity)===0?'https://schema.org/OutOfStock':'https://schema.org/InStock',url:'https://www.offshoresupportservices.ae/store'}:undefined}}})});document.head.append(schema)}
  }

  const jobs=[];
  if(page==='index')jobs.push(hydrateServices(),hydrateEquipment(),hydrateStore());
  if(page==='services')jobs.push(hydrateServices());
  if(page==='projects')jobs.push(hydrateProjects());
  if(page==='gallery')jobs.push(hydrateGallery());
  if(page==='fleet')jobs.push(hydrateEquipment());
  if(page==='store')jobs.push(hydrateStore());
  Promise.allSettled(jobs).then(()=>document.documentElement.dataset.cms='ready');
})();
