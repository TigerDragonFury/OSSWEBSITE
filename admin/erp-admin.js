/* ERP publishing and commerce. ERP operational rows are always read-only. */
const baseLoadContent=loadContent;
const baseLoadTab=loadTab;

loadContent=async function(type){
  if(type==='projects'||type==='vessels'||type==='heavy-equipment')return loadErpPublishing(type);
  return baseLoadContent(type);
};

loadTab=async function(tab){
  if(!['vessels','heavy-equipment','store','orders'].includes(tab))return baseLoadTab(tab);
  state.tab=tab;state.search='';state.status='all';closeSidebar();closeDrawer();
  $$('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));loading();
  try{return tab==='store'?await loadStorePublishing():tab==='orders'?await loadStoreOrders():await loadErpPublishing(tab)}catch(error){panel.innerHTML=errorState(error.message);toast(error.message,'error')}
};

const vesselPattern=/vessel|tug|barge|boat|craft|ship|landing craft/i;
const erpPublishing={
  projects:{
    title:'ERP Projects',kind:'project',publicationTable:'website_projects',description:'Publish approved ERP projects as public case studies.',
    async sources(){const {data,error}=await client.from('projects').select('id,name,project_type,status,stage,execution_status,job_no,start_date,end_date').order('created_at',{ascending:false}).limit(300);if(error)throw error;return (data||[]).map(row=>({...row,source_kind:'project',source_type:row.project_type||'Project'}))},
    defaults(row){return {id:row.id,title:row.name||'Untitled project',category:row.project_type||'Marine project',summary:'',cover_image_url:'',sort_order:0,published:true}}
  },
  vessels:{
    title:'ERP Vessels',kind:'vessel',publicationTable:'website_equipment',description:'A dedicated vessel catalogue sourced only from the ERP vessels register.',
    async sources(){const {data,error}=await client.from('vessels').select('id,name,vessel_type,status,flag_state,classification_society,gross_tonnage,net_tonnage').order('created_at',{ascending:false}).limit(300);if(error)throw error;return (data||[]).map(row=>({...row,source_kind:'vessel',source_type:row.vessel_type||'Vessel'}))},
    defaults(row){return {id:row.id,name:row.name||'Unnamed vessel',category:row.source_type,summary:'',availability_note:'Contact OSS for vessel availability.',source_kind:'vessel',image_url:'',sort_order:0,published:true}}
  },
  'heavy-equipment':{
    title:'ERP Heavy Equipment',kind:'asset',publicationTable:'website_equipment',description:'Industrial and heavy equipment sourced from ERP assets, separate from vessels.',
    async sources(){const {data,error}=await client.from('assets').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw error;return (data||[]).filter(row=>!vesselPattern.test(`${row.category||''} ${row.vessel_type||''}`)).map(row=>({...row,source_kind:'asset',source_type:row.category||'Heavy equipment'}))},
    defaults(row){return {id:row.id,name:row.name||'Unnamed equipment',category:row.source_type,summary:row.description||'',availability_note:'Contact OSS for equipment availability.',source_kind:'asset',image_url:'',sort_order:0,published:true}}
  }
};

const imageField=(name,label,value='')=>`<div class="field full image-field"><span>${esc(label)}</span><input name="${attr(name)}" type="text" value="${attr(value)}" placeholder="https://… or select an image below"><div class="image-actions"><button class="secondary-button" type="button" data-pick-image="${attr(name)}">Select from gallery</button><label class="upload-button">Upload image<input type="file" data-upload-image="${attr(name)}" accept="image/jpeg,image/png,image/webp"></label></div><div class="selected-image" data-image-preview="${attr(name)}">${value?`<img src="${attr(value)}" alt="Selected image">`:'<span>No image selected</span>'}</div><div class="media-picker hidden" data-media-picker="${attr(name)}"></div></div>`;

async function bindImageField(name){
  const input=$(`[name="${name}"]`),preview=$(`[data-image-preview="${name}"]`),picker=$(`[data-media-picker="${name}"]`);
  const show=url=>preview.innerHTML=url?`<img src="${attr(url)}" alt="Selected image">`:'<span>No image selected</span>';
  input?.addEventListener('input',()=>show(input.value.trim()));
  $(`[data-upload-image="${name}"]`)?.addEventListener('change',event=>{const file=event.target.files?.[0];if(file)show(URL.createObjectURL(file))});
  $(`[data-pick-image="${name}"]`)?.addEventListener('click',async()=>{
    picker.classList.remove('hidden');picker.innerHTML='<span class="muted">Loading gallery…</span>';
    const {data,error}=await client.from('website_gallery').select('id,caption,image_url').order('created_at',{ascending:false}).limit(100);
    if(error){picker.innerHTML=`<span class="muted">${esc(error.message)}</span>`;return}
    picker.innerHTML=(data||[]).length?`<div class="media-grid">${data.map(item=>`<button type="button" data-media-url="${attr(item.image_url)}"><img src="${attr(item.image_url)}" alt=""><span>${esc(item.caption||'Gallery image')}</span></button>`).join('')}</div>`:'<span class="muted">Add images in Gallery or upload a new one.</span>';
    picker.querySelectorAll('[data-media-url]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.mediaUrl;show(input.value);picker.classList.add('hidden')}));
  });
}

async function resolveImage(form,name,folder){
  const file=form.querySelector(`[data-upload-image="${name}"]`)?.files?.[0];
  if(!file)return String(new FormData(form).get(name)||'').trim();
  if(file.size>10*1024*1024)throw new Error('Image must be smaller than 10 MB.');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const {error}=await client.storage.from('website-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});if(error)throw error;
  return client.storage.from('website-media').getPublicUrl(path).data.publicUrl;
}

async function loadErpPublishing(type){
  const config=erpPublishing[type];setView(config.title,'ERP publication');
  const [sourceResult,publicationResult]=await Promise.allSettled([config.sources(),client.from(config.publicationTable).select('*').order('sort_order',{ascending:true})]);
  if(sourceResult.status==='rejected'){panel.innerHTML=errorState(`ERP access is unavailable: ${sourceResult.reason?.message||'permission denied'}`);return}
  if(publicationResult.status==='rejected'||publicationResult.value.error)throw publicationResult.reason||publicationResult.value.error;
  const sources=sourceResult.value,allPublications=publicationResult.value.data||[],sourceIds=new Set(sources.map(row=>String(row.id)));
  const publications=allPublications.filter(item=>sourceIds.has(String(item.id))||(type!=='projects'&&item.source_kind===config.kind));
  state.erp={type,sources,publications,publicationById:new Map(publications.map(item=>[String(item.id),item])),search:'',filter:'all'};renderErpPublishing();
}

function renderErpPublishing(){
  const {type,sources}=state.erp,config=erpPublishing[type];
  panel.innerHTML=`<div class="toolbar"><div class="toolbar-copy"><h2>${esc(config.title)}</h2><p>${esc(config.description)}</p></div><div class="toolbar-actions"><span class="connection"><i></i>${sources.length} ERP records</span></div></div><div class="erp-notice"><strong>ERP remains the source of truth.</strong><span>Only customer-safe display fields and selected images are copied to the website. Operational, financial and ownership data remain private.</span></div><div class="filters"><label class="search-field"><input id="erp-search" type="search" placeholder="Search ERP records"></label><select id="erp-publication-filter"><option value="all">All records</option><option value="published">Published</option><option value="draft">Not published</option></select><select id="erp-type-filter"><option value="all">All types</option>${[...new Set(sources.map(x=>x.source_type).filter(Boolean))].sort().map(value=>`<option value="${attr(value)}">${esc(value)}</option>`).join('')}</select></div><div id="erp-record-list"></div>`;
  $('#erp-search').addEventListener('input',event=>{state.erp.search=event.target.value;drawErpRows()});$('#erp-publication-filter').addEventListener('change',event=>{state.erp.filter=event.target.value;drawErpRows()});$('#erp-type-filter').addEventListener('change',drawErpRows);drawErpRows();
}

function drawErpRows(){
  const {sources,publicationById,search,filter}=state.erp,query=search.trim().toLowerCase(),typeFilter=$('#erp-type-filter')?.value||'all';
  const rows=sources.filter(source=>{const publication=publicationById.get(String(source.id)),published=publication?.published===true;return (filter==='all'||(filter==='published'&&published)||(filter==='draft'&&!published))&&(typeFilter==='all'||source.source_type===typeFilter)&&(!query||[source.name,source.job_no,source.source_type,source.status,source.stage].some(value=>String(value||'').toLowerCase().includes(query)))});
  const slot=$('#erp-record-list');if(!rows.length){slot.innerHTML=`<div class="card">${emptyState('No matching ERP records','Change the filters to see additional records.')}</div>`;return}
  slot.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>ERP record</th><th>Type</th><th>ERP status</th><th>Website</th><th></th></tr></thead><tbody>${rows.map(source=>{const publication=publicationById.get(String(source.id)),published=publication?.published===true;return `<tr><td data-label="ERP record"><div class="primary-cell"><span class="record-avatar">${esc(initials(source.name))}</span><span><strong>${esc(source.name||'Untitled')}</strong><small>${esc(source.job_no||source.flag_state||source.location||source.source_kind)}</small></span></div></td><td data-label="Type">${esc(source.source_type)}</td><td data-label="ERP status"><span class="badge status-reviewing">${esc(source.status||source.stage||source.execution_status||'Active')}</span></td><td data-label="Website"><span class="badge ${published?'status-won':'status-lost'}">${published?'Published':'Not published'}</span></td><td data-label="Actions"><div class="row-actions"><button class="row-button" data-erp-edit="${attr(source.id)}" type="button">${publication?'Edit':'Publish'}</button>${publication?`<button class="row-button" data-erp-toggle="${attr(source.id)}" type="button">${published?'Unpublish':'Publish'}</button>`:''}</div></td></tr>`}).join('')}</tbody></table></div>`;
  $$('[data-erp-edit]').forEach(button=>button.addEventListener('click',()=>openErpPublicationEditor(rows.find(x=>String(x.id)===button.dataset.erpEdit))));$$('[data-erp-toggle]').forEach(button=>button.addEventListener('click',()=>toggleErpPublication(button.dataset.erpToggle)));
}

function openErpPublicationEditor(source){
  if(!source)return;const {type,publicationById}=state.erp,config=erpPublishing[type],existing=publicationById.get(String(source.id)),row=existing||config.defaults(source),project=type==='projects',imageName=project?'cover_image_url':'image_url';
  openDrawer(existing?`Edit ${source.name}`:`Publish ${source.name}`,'ERP website publication',`<div class="erp-source-summary"><span class="eyebrow">Read-only ERP source</span><strong>${esc(source.name)}</strong><small>${esc(source.source_type)} · ${esc(source.status||source.stage||'Active')}</small></div><form class="editor-form" id="erp-publication-form"><label class="field">Public ${project?'title':'name'}<input name="display_name" value="${attr(project?row.title:row.name)}" required></label><label class="field">Public category<input name="category" value="${attr(row.category||source.source_type)}"></label><label class="field full">Public summary<textarea name="summary" placeholder="Write a customer-safe summary">${esc(row.summary||'')}</textarea></label>${!project?`<label class="field full">Availability note<textarea name="availability_note">${esc(row.availability_note||'Contact OSS for availability.')}</textarea></label>`:''}${imageField(imageName,project?'Project cover image':'Display image',row[imageName]||'')}<label class="field">Sort order<input name="sort_order" type="number" value="${attr(row.sort_order??0)}"></label><label class="publish-field"><input name="published" type="checkbox" ${row.published!==false?'checked':''}> Published on website</label><div class="editor-actions"><button class="primary-button" id="save-erp-publication" type="submit">Save publication</button><button class="secondary-button" id="cancel-erp-publication" type="button">Cancel</button></div></form>`);
  bindImageField(imageName);$('#cancel-erp-publication').addEventListener('click',closeDrawer);$('#erp-publication-form').addEventListener('submit',event=>saveErpPublication(event,source));
}

async function saveErpPublication(event,source){
  event.preventDefault();const {type,publicationById}=state.erp,config=erpPublishing[type],form=event.currentTarget,data=new FormData(form),project=type==='projects',button=$('#save-erp-publication');button.disabled=true;button.textContent='Saving…';
  try{const payload={id:source.id,category:String(data.get('category')||source.source_type).trim(),summary:String(data.get('summary')||'').trim(),sort_order:Number(data.get('sort_order')||0),published:form.elements.published.checked};if(project){payload.title=String(data.get('display_name')||source.name).trim();payload.cover_image_url=await resolveImage(form,'cover_image_url','projects')}else{payload.name=String(data.get('display_name')||source.name).trim();payload.availability_note=String(data.get('availability_note')||'').trim();payload.source_kind=config.kind;payload.image_url=await resolveImage(form,'image_url',config.kind==='vessel'?'vessels':'equipment')}
    const {data:record,error}=await client.from(config.publicationTable).upsert(payload,{onConflict:'id'}).select().single();if(error)throw error;publicationById.set(String(source.id),record);state.erp.publications=state.erp.publications.filter(x=>String(x.id)!==String(source.id));state.erp.publications.push(record);closeDrawer();toast(`${source.name} publication saved`);renderErpPublishing();
  }catch(error){button.disabled=false;button.textContent='Save publication';toast(error.message,'error')}
}

async function toggleErpPublication(id){const {publicationById}=state.erp,config=erpPublishing[state.erp.type],record=publicationById.get(String(id));if(!record)return;const published=!record.published,{data,error}=await client.from(config.publicationTable).update({published}).eq('id',record.id).select().single();if(error){toast(error.message,'error');return}publicationById.set(String(id),data);toast(`${data.title||data.name} ${published?'published':'unpublished'}`);renderErpPublishing()}

async function storeSources(){
  const [vessels,assets,inventory]=await Promise.all([client.from('vessels').select('*').order('created_at',{ascending:false}).limit(300),client.from('assets').select('*').order('created_at',{ascending:false}).limit(500),client.from('inventory_items').select('*').limit(1000)]);
  const failed=[vessels,assets,inventory].find(result=>result.error);if(failed)throw failed.error;
  return [...(vessels.data||[]).map(row=>({...row,source_table:'vessels',source_id:String(row.id),source_kind:'vessel',source_type:row.vessel_type||'Vessel'})),...(assets.data||[]).filter(row=>!vesselPattern.test(`${row.category||''} ${row.vessel_type||''} ${row.name||''}`)).map(row=>({...row,source_table:'assets',source_id:String(row.id),source_kind:'equipment',source_type:row.category||row.vessel_type||'Equipment'})),...(inventory.data||[]).map(row=>({...row,name:row.name||row.item_name||row.description||row.sku||'Inventory item',source_table:'inventory_items',source_id:String(row.id),source_kind:'inventory',source_type:row.category||row.item_type||'Marine spare',stock_quantity:row.quantity_on_hand??row.quantity??row.stock_quantity??null}))];
}
const storeKey=row=>`${row.source_table}:${row.source_id}`;

async function loadStorePublishing(){
  setView('Marine Store','ERP sales catalogue');const [sourceResult,listingResult]=await Promise.allSettled([storeSources(),client.from('website_store_items').select('*').order('sort_order',{ascending:true})]);
  if(sourceResult.status==='rejected'){panel.innerHTML=errorState(`ERP store access is unavailable: ${sourceResult.reason?.message||'Run the commerce SQL migration.'}`);return}if(listingResult.status==='rejected'||listingResult.value.error)throw listingResult.reason||listingResult.value.error;
  const sources=sourceResult.value,listings=listingResult.value.data||[];state.store={sources,listings,listingByKey:new Map(listings.map(item=>[storeKey(item),item])),search:'',kind:'all',filter:'all'};renderStore();
}

function renderStore(){
  const {sources}=state.store;panel.innerHTML=`<div class="toolbar"><div class="toolbar-copy"><h2>Store listings</h2><p>Offer existing ERP vessels, heavy equipment, inventory and marine spares for sale.</p></div><div class="toolbar-actions"><span class="connection"><i></i>${sources.length} ERP items</span><a class="secondary-button" href="../store.html" target="_blank" rel="noopener">View store ↗</a></div></div><div class="erp-notice"><strong>Flexible selling.</strong><span>Enable online payment for fixed-price products, or leave it disabled for vessels and equipment that require inspection and a commercial quote.</span></div><div class="filters"><label class="search-field"><input id="store-search" type="search" placeholder="Search vessels, equipment, inventory or SKU"></label><select id="store-kind"><option value="all">All categories</option><option value="vessel">Vessels</option><option value="equipment">Heavy equipment</option><option value="inventory">Inventory & spares</option></select><select id="store-filter"><option value="all">All records</option><option value="published">Published</option><option value="draft">Not listed</option></select></div><div id="store-record-list"></div>`;
  $('#store-search').addEventListener('input',event=>{state.store.search=event.target.value;drawStoreRows()});$('#store-kind').addEventListener('change',event=>{state.store.kind=event.target.value;drawStoreRows()});$('#store-filter').addEventListener('change',event=>{state.store.filter=event.target.value;drawStoreRows()});drawStoreRows();
}

function drawStoreRows(){
  const {sources,listingByKey,search,kind,filter}=state.store,query=search.trim().toLowerCase(),rows=sources.filter(source=>{const listing=listingByKey.get(storeKey(source)),published=listing?.published===true;return (kind==='all'||source.source_kind===kind)&&(filter==='all'||(filter==='published'&&published)||(filter==='draft'&&!published))&&(!query||[source.name,source.sku,source.asset_tag,source.source_type,source.description].some(value=>String(value||'').toLowerCase().includes(query)))}),slot=$('#store-record-list');
  if(!rows.length){slot.innerHTML=`<div class="card">${emptyState('No matching sale items','Change the filters to see more ERP records.')}</div>`;return}
  slot.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>ERP item</th><th>Catalogue</th><th>ERP status / stock</th><th>Store</th><th></th></tr></thead><tbody>${rows.map(source=>{const listing=listingByKey.get(storeKey(source)),published=listing?.published===true;return `<tr><td data-label="ERP item"><div class="primary-cell"><span class="record-avatar">${esc(initials(source.name))}</span><span><strong>${esc(source.name)}</strong><small>${esc(source.sku||source.asset_tag||source.source_table)}</small></span></div></td><td data-label="Catalogue">${esc(titleCase(source.source_kind))} · ${esc(source.source_type)}</td><td data-label="ERP status / stock">${esc(source.stock_quantity??source.status??'Available')}</td><td data-label="Store"><span class="badge ${published?'status-won':'status-lost'}">${published?'Listed':'Not listed'}</span></td><td data-label="Actions"><div class="row-actions"><button class="row-button" data-store-edit="${attr(storeKey(source))}" type="button">${listing?'Edit':'Offer for sale'}</button>${listing?`<button class="row-button" data-store-toggle="${attr(listing.id)}" type="button">${published?'Unpublish':'Publish'}</button>`:''}</div></td></tr>`}).join('')}</tbody></table></div>`;
  $$('[data-store-edit]').forEach(button=>button.addEventListener('click',()=>openStoreEditor(rows.find(row=>storeKey(row)===button.dataset.storeEdit))));$$('[data-store-toggle]').forEach(button=>button.addEventListener('click',()=>toggleStoreListing(button.dataset.storeToggle)));
}

function openStoreEditor(source){
  const existing=state.store.listingByKey.get(storeKey(source)),row=existing||{title:source.name,sku:source.sku||source.asset_tag||'',category:source.source_type,make:source.make||source.manufacturer||source.brand||'',model:source.model||source.model_number||'',model_year:source.model_year||source.year||source.manufacture_year||'',summary:source.description||'',image_url:'',condition:'Used',location:source.location||'Abu Dhabi, UAE',price_amount:'',currency:'AED',price_label:'Price on request',stock_quantity:source.stock_quantity??'',max_order_quantity:10,purchasable:false,featured:false,published:true,sort_order:0};
  openDrawer(existing?`Edit ${source.name}`:`Offer ${source.name}`,'Public store listing',`
    <div class="erp-source-summary"><span class="eyebrow">Read-only ERP source</span><strong>${esc(source.name)}</strong><small>${esc(titleCase(source.source_kind))} · ${esc(source.source_type)}</small></div>
    <form class="editor-form" id="store-publication-form">
      <label class="field">Listing title<input name="title" value="${attr(row.title)}" required></label>
      <label class="field">SKU / stock code<input name="sku" value="${attr(row.sku||source.sku||source.asset_tag||'')}"></label>
      <label class="field">Category<input name="category" value="${attr(row.category||source.source_type)}"></label>
      <label class="field">Make / manufacturer<input name="make" value="${attr(row.make||'')}" placeholder="e.g. Caterpillar"></label>
      <label class="field">Model<input name="model" value="${attr(row.model||'')}" placeholder="e.g. 3512B"></label>
      <label class="field">Model year<input name="model_year" type="number" min="1900" max="2100" value="${attr(row.model_year??'')}"></label>
      <label class="field">Condition<select name="condition"><option ${row.condition==='New'?'selected':''}>New</option><option ${row.condition==='Used'?'selected':''}>Used</option><option ${row.condition==='Refurbished'?'selected':''}>Refurbished</option><option ${row.condition==='For scrap'?'selected':''}>For scrap</option></select></label>
      <label class="field full">Public description<textarea name="summary" required>${esc(row.summary||'')}</textarea></label>
      ${imageField('image_url','Product image',row.image_url||'')}
      <label class="field">Location<input name="location" value="${attr(row.location||'Abu Dhabi, UAE')}"></label>
      <label class="field">Price amount<input name="price_amount" type="number" min="0" step="0.01" value="${attr(row.price_amount??'')}"></label>
      <label class="field">Currency<select name="currency">${['AED','USD','EUR'].map(value=>`<option ${row.currency===value?'selected':''}>${value}</option>`).join('')}</select></label>
      <label class="field">Price display<input name="price_label" value="${attr(row.price_label||'Price on request')}" placeholder="Price on request"></label>
      <label class="field">Stock quantity<input name="stock_quantity" type="number" min="0" step="1" value="${attr(row.stock_quantity??'')}"></label>
      <label class="field">Maximum per order<input name="max_order_quantity" type="number" min="1" max="99" value="${attr(row.max_order_quantity??10)}"></label>
      <label class="field">Sort order<input name="sort_order" type="number" value="${attr(row.sort_order??0)}"></label>
      <label class="publish-field"><input name="purchasable" type="checkbox" ${row.purchasable?'checked':''}> Enable Add to Cart and online payment</label>
      <label class="publish-field"><input name="featured" type="checkbox" ${row.featured?'checked':''}> Feature on homepage</label>
      <label class="publish-field"><input name="published" type="checkbox" ${row.published!==false?'checked':''}> Published in store</label>
      <div class="editor-actions"><button class="primary-button" id="save-store-publication" type="submit">Save listing</button><button class="secondary-button" id="cancel-store-publication" type="button">Cancel</button></div>
    </form>`);
  bindImageField('image_url');$('#cancel-store-publication').addEventListener('click',closeDrawer);$('#store-publication-form').addEventListener('submit',event=>saveStoreListing(event,source,existing));
}

async function saveStoreListing(event,source,existing){
  event.preventDefault();const form=event.currentTarget,data=new FormData(form),button=$('#save-store-publication');button.disabled=true;button.textContent='Saving…';
  try{const price=String(data.get('price_amount')||'').trim(),stock=String(data.get('stock_quantity')||'').trim(),year=String(data.get('model_year')||'').trim(),payload={source_id:source.source_id,source_table:source.source_table,item_type:source.source_kind,title:String(data.get('title')||source.name).trim(),sku:String(data.get('sku')||'').trim(),category:String(data.get('category')||source.source_type).trim(),make:String(data.get('make')||'').trim(),model:String(data.get('model')||'').trim(),model_year:year===''?null:Number(year),summary:String(data.get('summary')||'').trim(),image_url:await resolveImage(form,'image_url','store'),condition:String(data.get('condition')||'Used'),location:String(data.get('location')||'').trim(),price_amount:price===''?null:Number(price),currency:String(data.get('currency')||'AED'),price_label:String(data.get('price_label')||'Price on request').trim(),stock_quantity:stock===''?null:Number(stock),max_order_quantity:Math.max(1,Math.min(99,Number(data.get('max_order_quantity'))||10)),purchasable:form.elements.purchasable.checked,featured:form.elements.featured.checked,published:form.elements.published.checked,sort_order:Number(data.get('sort_order')||0),updated_at:new Date().toISOString()};
    const result=existing?await client.from('website_store_items').update(payload).eq('id',existing.id).select().single():await client.from('website_store_items').insert(payload).select().single();if(result.error)throw result.error;state.store.listingByKey.set(storeKey(source),result.data);state.store.listings=state.store.listings.filter(item=>item.id!==result.data.id);state.store.listings.push(result.data);closeDrawer();toast(`${source.name} store listing saved`);renderStore();
  }catch(error){button.disabled=false;button.textContent='Save listing';toast(error.message,'error')}
}

async function toggleStoreListing(id){const listing=state.store.listings.find(item=>String(item.id)===String(id));if(!listing)return;const {data,error}=await client.from('website_store_items').update({published:!listing.published,updated_at:new Date().toISOString()}).eq('id',listing.id).select().single();if(error){toast(error.message,'error');return}state.store.listingByKey.set(storeKey(data),data);state.store.listings=state.store.listings.map(item=>item.id===data.id?data:item);toast(`${data.title} ${data.published?'published':'unpublished'}`);renderStore()}

async function loadStoreOrders(){
  setView('Store Orders','Payments & fulfillment');
  const {data,error}=await client.from('website_orders').select('*,website_order_items(*)').order('created_at',{ascending:false}).limit(300);if(error)throw error;
  state.orders=data||[];renderStoreOrders();
}

function renderStoreOrders(){
  const orders=state.orders||[],money=(amount,currency)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:currency||'AED'}).format(Number(amount)||0);
  panel.innerHTML=`<div class="toolbar"><div class="toolbar-copy"><h2>Customer orders</h2><p>Stripe payment status and internal fulfillment workflow.</p></div><div class="toolbar-actions"><span class="connection"><i></i>${orders.length} orders</span></div></div>${orders.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th></th></tr></thead><tbody>${orders.map(order=>`<tr><td data-label="Order"><strong>#${esc(order.order_number||String(order.id).slice(0,8))}</strong><br><small>${esc(formatDate(order.created_at))}</small></td><td data-label="Customer"><strong>${esc(order.customer_name||'Checkout pending')}</strong><br><small>${esc(order.customer_email||'—')}</small></td><td data-label="Total"><strong>${esc(money(order.amount_total,order.currency))}</strong></td><td data-label="Payment"><span class="badge ${order.payment_status==='paid'?'status-won':'status-reviewing'}">${esc(titleCase(order.payment_status))}</span></td><td data-label="Fulfillment"><span class="badge status-reviewing">${esc(titleCase(order.fulfillment_status))}</span></td><td data-label="Actions"><button class="row-button" type="button" data-order-id="${attr(order.id)}">View order</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="card">${emptyState('No store orders yet','Paid and pending checkout orders will appear here.')}</div>`}`;
  $$('[data-order-id]').forEach(button=>button.addEventListener('click',()=>openOrder(state.orders.find(order=>order.id===button.dataset.orderId))));
}

function openOrder(order){
  const items=order.website_order_items||[],money=(amount,currency)=>new Intl.NumberFormat('en-AE',{style:'currency',currency:currency||order.currency||'AED'}).format(Number(amount)||0);
  openDrawer(`Order #${order.order_number||String(order.id).slice(0,8)}`,'Store order',`<div class="detail-hero"><span class="badge ${order.payment_status==='paid'?'status-won':'status-reviewing'}">${esc(titleCase(order.payment_status))}</span><h2>${esc(money(order.amount_total,order.currency))}</h2><p>${esc(formatDate(order.created_at))}</p></div><div class="detail-grid"><div class="detail"><span>Customer</span><strong>${esc(order.customer_name||'Pending checkout')}</strong></div><div class="detail"><span>Email</span><strong>${esc(order.customer_email||'—')}</strong></div><div class="detail"><span>Phone</span><strong>${esc(order.customer_phone||'—')}</strong></div><div class="detail"><span>Payment</span><strong>${esc(titleCase(order.payment_status))}</strong></div></div><section class="order-lines"><h3>Items</h3>${items.map(item=>`<div><span><strong>${esc(item.title)}</strong><small>${esc(item.sku||'')} · Qty ${esc(item.quantity)}</small></span><b>${esc(money(item.line_total,item.currency))}</b></div>`).join('')}</section><form class="editor-form" id="fulfillment-form"><label class="field full">Fulfillment status<select name="fulfillment_status">${['unfulfilled','processing','ready','fulfilled','cancelled'].map(value=>`<option value="${value}" ${order.fulfillment_status===value?'selected':''}>${titleCase(value)}</option>`).join('')}</select></label><div class="editor-actions"><button class="primary-button" type="submit">Update fulfillment</button><button class="secondary-button" type="button" id="close-order">Close</button></div></form>`);
  $('#close-order').addEventListener('click',closeDrawer);$('#fulfillment-form').addEventListener('submit',async event=>{event.preventDefault();const value=new FormData(event.currentTarget).get('fulfillment_status'),{error}=await client.from('website_orders').update({fulfillment_status:value,updated_at:new Date().toISOString()}).eq('id',order.id);if(error){toast(error.message,'error');return}closeDrawer();toast('Fulfillment status updated');loadStoreOrders()});
}

/* Turn the gallery into the reusable website image library. */
const baseShowEditor=showEditor;
const baseSaveRecord=saveRecord;
showEditor=function(type,row={}){
  baseShowEditor(type,row);
  if(type!=='gallery')return;
  const input=$('[name="image_url"]'),label=input?.closest('.field');if(!input||!label)return;
  label.insertAdjacentHTML('afterend',`<div class="field full image-field"><span>Image library</span><div class="image-actions"><label class="upload-button">Upload image<input type="file" data-upload-image="image_url" accept="image/jpeg,image/png,image/webp"></label></div><div class="selected-image" data-image-preview="image_url">${input.value?`<img src="${attr(input.value)}" alt="Selected image">`:'<span>No image selected</span>'}</div><div class="media-picker hidden" data-media-picker="image_url"></div></div>`);
  bindImageField('image_url');
};
saveRecord=async function(event,type,row){
  if(type!=='gallery')return baseSaveRecord(event,type,row);
  event.preventDefault();const form=event.currentTarget,button=$('#save-record');button.disabled=true;button.textContent='Uploading…';
  try{form.elements.image_url.value=await resolveImage(form,'image_url','gallery');button.disabled=false;return baseSaveRecord(event,type,row)}catch(error){button.disabled=false;button.textContent=row.id?'Save changes':'Create record';toast(error.message,'error')}
};
