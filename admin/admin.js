const cfg=window.OSS_CONFIG||{};
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const loginView=$('#login-view'),dashboard=$('#dashboard'),panel=$('#panel');
let client=null;
const state={tab:'overview',inquiries:[],records:[],search:'',status:'all'};

const contentTypes={
  projects:{table:'website_projects',title:'Projects',singular:'project',description:'Manage project and case-study records.',primary:'title',fields:[
    {name:'title',label:'Project title',required:true},{name:'category',label:'Category'},{name:'summary',label:'Summary',type:'textarea',full:true},{name:'cover_image_url',label:'Cover image URL',type:'url',full:true},{name:'sort_order',label:'Sort order',type:'number'},{name:'published',label:'Published',type:'checkbox'}]},
  gallery:{table:'website_gallery',title:'Gallery',singular:'gallery item',description:'Manage approved operations and project imagery.',primary:'caption',fields:[
    {name:'caption',label:'Caption',required:true},{name:'image_url',label:'Image URL',type:'url',required:true,full:true},{name:'sort_order',label:'Sort order',type:'number'},{name:'published',label:'Published',type:'checkbox'}]},
  equipment:{table:'website_equipment',title:'Equipment',singular:'equipment item',description:'Maintain vessel and equipment capability records.',primary:'name',fields:[
    {name:'name',label:'Name',required:true},{name:'category',label:'Category'},{name:'summary',label:'Summary',type:'textarea',full:true},{name:'availability_note',label:'Availability note',type:'textarea',full:true},{name:'sort_order',label:'Sort order',type:'number'},{name:'published',label:'Published',type:'checkbox'}]},
  services:{table:'website_services',title:'Services',singular:'service',description:'Manage marine service descriptions and publishing state.',primary:'name',fields:[
    {name:'name',label:'Service name',required:true},{name:'slug',label:'URL slug',required:true},{name:'summary',label:'Summary',type:'textarea',full:true},{name:'body',label:'Full description',type:'textarea',full:true},{name:'sort_order',label:'Sort order',type:'number'},{name:'published',label:'Published',type:'checkbox'}]}
};

const esc=(value='')=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const attr=value=>esc(value).replace(/`/g,'&#96;');
const formatDate=value=>value?new Intl.DateTimeFormat('en-AE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
const initials=value=>String(value||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
const titleCase=value=>String(value||'').replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
const statusClass=value=>`status-${String(value||'new').replace(/[^a-z]/g,'')}`;
const loading=()=>panel.innerHTML='<div class="loading"><div><div class="spinner"></div><p>Loading workspace…</p></div></div>';

function toast(message,type='success'){
  const item=document.createElement('div');item.className=`toast ${type==='error'?'error':''}`;item.textContent=message;$('#toast-region').append(item);setTimeout(()=>item.remove(),3600);
}
function setConnection(){const el=$('#connection-state');if(!el)return;el.classList.toggle('offline',!navigator.onLine);el.lastChild.textContent=navigator.onLine?' Connected':' Offline'}
function setView(title,kicker='OSS website'){ $('#view-title').textContent=title;$('#view-kicker').textContent=kicker;document.title=`${title} | OSS Control Centre` }
function openDrawer(title,kicker,html){$('#drawer-title').textContent=title;$('#drawer-kicker').textContent=kicker;$('#drawer-body').innerHTML=html;$('#drawer').classList.remove('hidden');$('#drawer-backdrop').classList.remove('hidden');document.body.style.overflow='hidden'}
function closeDrawer(){ $('#drawer').classList.add('hidden');$('#drawer-backdrop').classList.add('hidden');$('#drawer-body').innerHTML='';document.body.style.overflow='' }
function closeSidebar(){ $('#sidebar').classList.remove('open');$('#nav-backdrop').classList.add('hidden');$('#sidebar-toggle').setAttribute('aria-expanded','false') }

if(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase)client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);

async function authorised(user){
  if(user?.app_metadata?.role!=='admin')return false;
  const {data,error}=await client.rpc('is_website_admin');
  return !error&&data===true;
}
async function enterDashboard(user){
  if(!await authorised(user)){
    await client.auth.signOut();
    $('#login-status').textContent='This account is not authorised as a website administrator.';
    return;
  }
  $('#user-email').textContent=user.email||'';
  $('#user-name').textContent=user.user_metadata?.full_name||'Administrator';
  loginView.classList.add('hidden');dashboard.classList.remove('hidden');
  await loadTab(state.tab);
}
async function boot(){
  if(!client){$('#login-status').textContent='Supabase configuration is unavailable.';return}
  const {data,error}=await client.auth.getSession();
  if(error){$('#login-status').textContent=error.message;return}
  if(data.session)await enterDashboard(data.session.user);
}

$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!client)return;
  const button=$('#login-button'),status=$('#login-status');button.disabled=true;button.firstChild.textContent='Signing in ';status.textContent='';
  const {data,error}=await client.auth.signInWithPassword({email:$('#login-email').value.trim(),password:$('#login-password').value});
  if(error){status.textContent=error.message;button.disabled=false;button.firstChild.textContent='Sign in ';return}
  await enterDashboard(data.user);button.disabled=false;button.firstChild.textContent='Sign in ';
});
$('#toggle-password').addEventListener('click',()=>{const input=$('#login-password'),show=input.type==='password';input.type=show?'text':'password';$('#toggle-password').textContent=show?'Hide':'Show';$('#toggle-password').setAttribute('aria-label',show?'Hide password':'Show password')});
$('#logout').addEventListener('click',async()=>{await client?.auth.signOut();location.reload()});
$('#drawer-close').addEventListener('click',closeDrawer);$('#drawer-backdrop').addEventListener('click',closeDrawer);
$('#sidebar-toggle').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#nav-backdrop').classList.toggle('hidden',!open);$('#sidebar-toggle').setAttribute('aria-expanded',String(open))});
$('#sidebar-close').addEventListener('click',closeSidebar);$('#nav-backdrop').addEventListener('click',closeSidebar);
$('#refresh-view').addEventListener('click',()=>loadTab(state.tab));
addEventListener('keydown',event=>{if(event.key==='Escape'){closeDrawer();closeSidebar()}});
addEventListener('online',setConnection);addEventListener('offline',setConnection);setConnection();
$$('[data-tab]').forEach(button=>button.addEventListener('click',()=>loadTab(button.dataset.tab)));

async function loadTab(tab){
  state.tab=tab;state.search='';state.status='all';closeSidebar();closeDrawer();
  $$('[data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));
  loading();
  try{
    if(tab==='overview')return await loadOverview();
    if(tab==='inquiries')return await loadInquiries();
    if(contentTypes[tab])return await loadContent(tab);
  }catch(error){panel.innerHTML=errorState(error.message);toast(error.message,'error')}
}

function errorState(message){return `<div class="card empty"><i>!</i><h3>Unable to load this view</h3><p>${esc(message||'Please refresh and try again.')}</p></div>`}
function emptyState(title,message){return `<div class="empty"><i>◇</i><h3>${esc(title)}</h3><p>${esc(message)}</p></div>`}

async function loadOverview(){
  setView('Overview','OSS control centre');
  const [inquiryResult,projectResult,galleryResult,equipmentResult,serviceResult]=await Promise.all([
    client.from('website_inquiries').select('*').order('created_at',{ascending:false}).limit(200),
    client.from('website_projects').select('id,published'),client.from('website_gallery').select('id,published'),client.from('website_equipment').select('id,published'),client.from('website_services').select('id,published')
  ]);
  const failed=[inquiryResult,projectResult,galleryResult,equipmentResult,serviceResult].find(x=>x.error);if(failed)throw failed.error;
  state.inquiries=inquiryResult.data||[];
  const newCount=state.inquiries.filter(x=>x.status==='new').length;
  const published=[...(projectResult.data||[]),...(galleryResult.data||[]),...(equipmentResult.data||[]),...(serviceResult.data||[])].filter(x=>x.published).length;
  const contentTotal=[projectResult,galleryResult,equipmentResult,serviceResult].reduce((sum,x)=>sum+(x.data?.length||0),0);
  $('#inquiry-count').textContent=newCount||'';
  const statusCounts=['new','reviewing','quoted','won','lost','spam'].map(key=>({key,count:state.inquiries.filter(x=>x.status===key).length}));
  const maxStatus=Math.max(1,...statusCounts.map(x=>x.count));
  panel.innerHTML=`
    <section class="welcome"><div><span class="eyebrow" style="color:#9fc5d9">Operations snapshot</span><h2>Welcome to OSS Control Centre</h2><p>Review new opportunities and keep website content organised.</p></div><time>${esc(new Intl.DateTimeFormat('en-AE',{dateStyle:'full'}).format(new Date()))}</time></section>
    <section class="metric-grid">
      <article class="metric"><span>Total inquiries</span><strong>${state.inquiries.length}</strong><small>Latest 200 records</small><i>↗</i></article>
      <article class="metric"><span>Needs attention</span><strong>${newCount}</strong><small>New inquiries</small><i>!</i></article>
      <article class="metric"><span>Content records</span><strong>${contentTotal}</strong><small>Across four sections</small><i>◇</i></article>
      <article class="metric"><span>Published</span><strong>${published}</strong><small>Public-ready records</small><i>✓</i></article>
    </section>
    <section class="overview-grid">
      <article class="card"><div class="card-head"><div><h2>Recent inquiries</h2><p>Latest website submissions</p></div><button data-go="inquiries">View all →</button></div><div class="activity-list">${state.inquiries.slice(0,6).map(item=>`<button class="activity-item" data-inquiry="${attr(item.id)}" type="button" style="width:100%;border:0;background:transparent;text-align:left"><span class="activity-avatar">${esc(initials(item.name))}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.company||item.service||'Website inquiry')}</small></span><time>${esc(formatDate(item.created_at))}</time></button>`).join('')||emptyState('No inquiries yet','New website inquiries will appear here.')}</div></article>
      <article class="card"><div class="card-head"><div><h2>Inquiry pipeline</h2><p>Current status distribution</p></div></div><div class="status-stack">${statusCounts.map(x=>`<div class="status-row"><span>${esc(titleCase(x.key))}</span><span class="status-bar"><i style="width:${Math.round(x.count/maxStatus*100)}%"></i></span><b>${x.count}</b></div>`).join('')}</div></article>
    </section>`;
  $('[data-go="inquiries"]')?.addEventListener('click',()=>loadTab('inquiries'));
  $$('[data-inquiry]').forEach(button=>button.addEventListener('click',()=>showInquiry(state.inquiries.find(x=>x.id===button.dataset.inquiry))));
}

async function loadInquiries(){
  setView('Inquiries','Commercial pipeline');
  const {data,error}=await client.from('website_inquiries').select('*').order('created_at',{ascending:false}).limit(200);if(error)throw error;
  state.inquiries=data||[];$('#inquiry-count').textContent=state.inquiries.filter(x=>x.status==='new').length||'';
  renderInquiries();
}
function renderInquiries(){
  panel.innerHTML=`<div class="toolbar"><div class="toolbar-copy"><h2>Website inquiries</h2><p>${state.inquiries.length} latest submissions</p></div><div class="toolbar-actions"><button class="secondary-button" id="export-inquiries" type="button">Export CSV</button></div></div>
    <div class="filters"><label class="search-field"><input id="inquiry-search" type="search" value="${attr(state.search)}" placeholder="Search name, company, email or requirement"></label><select id="status-filter" aria-label="Filter by status"><option value="all">All statuses</option>${['new','reviewing','quoted','won','lost','spam'].map(x=>`<option value="${x}" ${state.status===x?'selected':''}>${titleCase(x)}</option>`).join('')}</select><select id="service-filter" aria-label="Filter by service"><option value="all">All services</option>${[...new Set(state.inquiries.map(x=>x.service).filter(Boolean))].sort().map(x=>`<option value="${attr(x)}">${esc(x)}</option>`).join('')}</select></div>
    <div id="inquiry-list"></div>`;
  $('#inquiry-search').addEventListener('input',event=>{state.search=event.target.value;drawInquiryRows()});
  $('#status-filter').addEventListener('change',event=>{state.status=event.target.value;drawInquiryRows()});
  $('#service-filter').addEventListener('change',drawInquiryRows);
  $('#export-inquiries').addEventListener('click',exportInquiries);drawInquiryRows();
}
function filteredInquiries(){
  const query=state.search.trim().toLowerCase(),service=$('#service-filter')?.value||'all';
  return state.inquiries.filter(item=>(state.status==='all'||item.status===state.status)&&(service==='all'||item.service===service)&&(!query||[item.name,item.company,item.email,item.phone,item.service,item.message,item.project_location].some(value=>String(value||'').toLowerCase().includes(query))));
}
function drawInquiryRows(){
  const items=filteredInquiries(),slot=$('#inquiry-list');
  if(!items.length){slot.innerHTML=`<div class="card">${emptyState('No matching inquiries','Change the search or status filter to see more records.')}</div>`;return}
  slot.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>Received</th><th>Contact</th><th>Service</th><th>Requirement</th><th>Status</th><th></th></tr></thead><tbody>${items.map(item=>`<tr><td data-label="Received">${esc(formatDate(item.created_at))}</td><td data-label="Contact"><div class="primary-cell"><span class="record-avatar">${esc(initials(item.name))}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.company||item.email)}</small></span></div></td><td data-label="Service"><strong>${esc(item.service||'General inquiry')}</strong><br><span class="muted">${esc(item.project_location||'Location not provided')}</span></td><td data-label="Requirement"><span class="truncate">${esc(item.message||'—')}</span></td><td data-label="Status"><select class="status-select ${statusClass(item.status)}" data-status-id="${attr(item.id)}" aria-label="Status for ${attr(item.name)}">${['new','reviewing','quoted','won','lost','spam'].map(x=>`<option value="${x}" ${item.status===x?'selected':''}>${titleCase(x)}</option>`).join('')}</select></td><td data-label="Actions"><div class="row-actions"><button class="row-button" data-view-id="${attr(item.id)}" type="button">View</button></div></td></tr>`).join('')}</tbody></table></div>`;
  $$('[data-view-id]').forEach(button=>button.addEventListener('click',()=>showInquiry(state.inquiries.find(x=>x.id===button.dataset.viewId))));
  $$('[data-status-id]').forEach(select=>select.addEventListener('change',()=>updateInquiryStatus(select)));
}
async function updateInquiryStatus(select){
  const item=state.inquiries.find(x=>x.id===select.dataset.statusId),previous=item.status;select.disabled=true;
  const {error}=await client.from('website_inquiries').update({status:select.value}).eq('id',item.id);
  if(error){select.value=previous;select.disabled=false;toast(error.message,'error');return}
  item.status=select.value;select.className=`status-select ${statusClass(item.status)}`;select.disabled=false;$('#inquiry-count').textContent=state.inquiries.filter(x=>x.status==='new').length||'';toast(`Inquiry marked ${titleCase(item.status)}`);
}
function showInquiry(item){
  if(!item)return;const phone=String(item.phone||'').replace(/[^+\d]/g,'');
  openDrawer(item.name||'Inquiry','Website inquiry',`<div class="detail-hero"><span class="eyebrow" style="color:#9fc5d9">${esc(formatDate(item.created_at))}</span><h3>${esc(item.name)}</h3><p>${esc(item.company||'Direct inquiry')}</p></div><div class="detail-grid"><div class="detail"><span>Email</span><strong><a href="mailto:${attr(item.email)}">${esc(item.email)}</a></strong></div><div class="detail"><span>Phone</span><strong>${item.phone?`<a href="tel:${attr(phone)}">${esc(item.phone)}</a>`:'—'}</strong></div><div class="detail"><span>Service</span><strong>${esc(item.service||'General inquiry')}</strong></div><div class="detail"><span>Location</span><strong>${esc(item.project_location||'Not provided')}</strong></div><div class="detail full"><span>Source</span><strong>${esc(item.source||'Website')} · ${esc(item.page||'Unknown page')}</strong></div></div><div class="detail-message">${esc(item.message||'No requirement supplied.')}</div><div class="detail-actions"><a class="primary-button" href="mailto:${attr(item.email)}?subject=${encodeURIComponent(`OSS enquiry: ${item.service||'Marine support'}`)}">Reply by email</a>${item.phone?`<a class="secondary-button" href="tel:${attr(phone)}">Call contact</a>`:''}</div>`);
}
function exportInquiries(){
  const rows=filteredInquiries(),columns=['created_at','name','company','email','phone','service','project_location','message','status','source','page'];
  const csv=[columns.join(','),...rows.map(row=>columns.map(key=>`"${String(row[key]??'').replace(/"/g,'""')}"`).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`oss-inquiries-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);toast(`Exported ${rows.length} inquiries`);
}

async function loadContent(type){
  const config=contentTypes[type];setView(config.title,'Website content');
  const {data,error}=await client.from(config.table).select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:false}).limit(200);if(error)throw error;
  state.records=data||[];renderContent(type);
}
function renderContent(type){
  const config=contentTypes[type];
  panel.innerHTML=`<div class="toolbar"><div class="toolbar-copy"><h2>${esc(config.title)}</h2><p>${esc(config.description)}</p></div><div class="toolbar-actions"><button class="primary-button" id="add-record" type="button">Add ${esc(config.singular)} <span>+</span></button></div></div>${state.records.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>${esc(config.fields.find(x=>x.name===config.primary)?.label||'Name')}</th><th>Category / slug</th><th>Order</th><th>Visibility</th><th></th></tr></thead><tbody>${state.records.map(record=>`<tr><td data-label="Record"><div class="primary-cell"><span class="record-avatar">${esc(initials(record[config.primary]))}</span><span><strong>${esc(record[config.primary]||'Untitled')}</strong><small>${esc(record.summary||record.image_url||'No description')}</small></span></div></td><td data-label="Category / slug">${esc(record.category||record.slug||'—')}</td><td data-label="Order">${esc(record.sort_order??0)}</td><td data-label="Visibility"><span class="badge ${record.published?'status-won':'status-lost'}">${record.published?'Published':'Draft'}</span></td><td data-label="Actions"><div class="row-actions"><button class="row-button" data-edit-id="${attr(record.id)}" type="button">Edit</button></div></td></tr>`).join('')}</tbody></table></div>`:`<div class="card">${emptyState(`No ${config.title.toLowerCase()} yet`,`Add the first ${config.singular} to begin.`)}</div>`}`;
  $('#add-record').addEventListener('click',()=>showEditor(type,{}));$$('[data-edit-id]').forEach(button=>button.addEventListener('click',()=>showEditor(type,state.records.find(x=>x.id===button.dataset.editId))));
}
function fieldMarkup(field,row){
  if(field.type==='checkbox')return `<label class="publish-field"><input type="checkbox" name="${attr(field.name)}" ${row[field.name]?'checked':''}> ${esc(field.label)}</label>`;
  const value=row[field.name]??'',classes=`field ${field.full?'full':''}`;
  if(field.type==='textarea')return `<label class="${classes}">${esc(field.label)}<textarea name="${attr(field.name)}" ${field.required?'required':''}>${esc(value)}</textarea></label>`;
  return `<label class="${classes}">${esc(field.label)}<input name="${attr(field.name)}" type="${field.type||'text'}" value="${attr(value)}" ${field.required?'required':''} ${field.type==='number'?'step="1"':''}></label>`;
}
function showEditor(type,row){
  const config=contentTypes[type],editing=Boolean(row.id),imageField=config.fields.find(x=>x.name.includes('image_url'));
  openDrawer(editing?`Edit ${config.singular}`:`Add ${config.singular}`,config.title,`<form class="editor-form" id="record-form">${config.fields.map(field=>fieldMarkup(field,row)).join('')}${imageField?`<div class="image-preview" id="image-preview">${row[imageField.name]?`<img src="${attr(row[imageField.name])}" alt="Preview">`:''}</div>`:''}<div class="editor-actions"><button class="primary-button" id="save-record" type="submit">${editing?'Save changes':'Create record'}</button><button class="secondary-button" id="cancel-edit" type="button">Cancel</button>${editing?'<button class="danger-button" id="delete-record" type="button">Delete</button>':''}</div></form>`);
  $('#cancel-edit').addEventListener('click',closeDrawer);$('#record-form').addEventListener('submit',event=>saveRecord(event,type,row));
  if(editing)$('#delete-record').addEventListener('click',()=>deleteRecord(type,row));
  if(imageField){const input=$(`[name="${imageField.name}"]`);input?.addEventListener('input',()=>{$('#image-preview').innerHTML=input.value?`<img src="${attr(input.value)}" alt="Preview">`:''})}
  if(type==='services'&&!editing){const name=$('[name="name"]'),slug=$('[name="slug"]');name.addEventListener('input',()=>{if(!slug.dataset.edited)slug.value=name.value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')});slug.addEventListener('input',()=>slug.dataset.edited='true')}
}
async function saveRecord(event,type,row){
  event.preventDefault();const config=contentTypes[type],form=event.currentTarget,button=$('#save-record'),data=new FormData(form),payload={};
  config.fields.forEach(field=>payload[field.name]=field.type==='checkbox'?form.elements[field.name].checked:field.type==='number'?Number(data.get(field.name)||0):String(data.get(field.name)||'').trim());
  if(config.table==='website_projects')payload.updated_at=new Date().toISOString();button.disabled=true;button.textContent='Saving…';
  const result=row.id?await client.from(config.table).update(payload).eq('id',row.id):await client.from(config.table).insert(payload);button.disabled=false;
  if(result.error){button.textContent=row.id?'Save changes':'Create record';toast(result.error.message,'error');return}
  closeDrawer();toast(`${titleCase(config.singular)} ${row.id?'updated':'created'}`);await loadContent(type);
}
async function deleteRecord(type,row){
  const config=contentTypes[type];if(!confirm(`Delete "${row[config.primary]||'this record'}"? This cannot be undone.`))return;
  const button=$('#delete-record');button.disabled=true;button.textContent='Deleting…';const {error}=await client.from(config.table).delete().eq('id',row.id);
  if(error){button.disabled=false;button.textContent='Delete';toast(error.message,'error');return}closeDrawer();toast(`${titleCase(config.singular)} deleted`);await loadContent(type);
}

boot();
