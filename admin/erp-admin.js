/* ERP-backed website publishing. Operational records remain read-only here. */
const baseLoadContent=loadContent;

loadContent=async function(type){
  if(type==='projects')return loadErpPublishing('projects');
  if(type==='equipment')return loadErpPublishing('equipment');
  return baseLoadContent(type);
};

const erpPublishing={
  projects:{
    title:'ERP Projects',description:'Publish approved ERP projects to the public website without duplicating operational data.',publicationTable:'website_projects',
    async sources(){
      const {data,error}=await client.from('projects').select('id,name,project_type,status,stage,execution_status,job_no,start_date,end_date').order('created_at',{ascending:false}).limit(300);
      if(error)throw error;
      return (data||[]).map(row=>({...row,source_kind:'project',source_type:row.project_type||'Project'}));
    },
    defaults(row){return {id:row.id,title:row.name||'Untitled project',category:row.project_type||'Marine project',summary:'',cover_image_url:'',sort_order:0,published:true}}
  },
  equipment:{
    title:'ERP Fleet & Equipment',description:'Select existing vessels and assets for public display. ERP ownership and operational data remain unchanged.',publicationTable:'website_equipment',
    async sources(){
      const [vesselsResult,assetsResult]=await Promise.all([
        client.from('vessels').select('id,name,vessel_type,status,flag_state,classification_society,gross_tonnage,net_tonnage').order('created_at',{ascending:false}).limit(300),
        client.from('assets').select('id,name,category,status,location,description,vessel_type').order('created_at',{ascending:false}).limit(300)
      ]);
      if(vesselsResult.error)throw vesselsResult.error;if(assetsResult.error)throw assetsResult.error;
      return [
        ...(vesselsResult.data||[]).map(row=>({...row,source_kind:'vessel',source_type:row.vessel_type||'Vessel'})),
        ...(assetsResult.data||[]).map(row=>({...row,source_kind:'asset',source_type:row.category||row.vessel_type||'Equipment'}))
      ];
    },
    defaults(row){return {id:row.id,name:row.name||'Unnamed asset',category:row.source_type,summary:'',availability_note:'Contact OSS for availability.',sort_order:0,published:true}}
  }
};

async function loadErpPublishing(type){
  const config=erpPublishing[type];setView(config.title,'ERP publication');
  const [sourceResult,publicationResult]=await Promise.allSettled([
    config.sources(),client.from(config.publicationTable).select('*').order('sort_order',{ascending:true})
  ]);
  if(sourceResult.status==='rejected'){
    panel.innerHTML=errorState(`ERP access is not enabled for this website administrator: ${sourceResult.reason?.message||'permission denied'}`);return;
  }
  if(publicationResult.status==='rejected'||publicationResult.value.error)throw publicationResult.reason||publicationResult.value.error;
  const sources=sourceResult.value,publications=publicationResult.value.data||[],publicationById=new Map(publications.map(item=>[String(item.id),item]));
  state.erp={type,sources,publications,publicationById,search:'',filter:'all'};
  renderErpPublishing();
}

function renderErpPublishing(){
  const {type,sources,publications,publicationById}=state.erp,config=erpPublishing[type];
  const unmatched=publications.filter(item=>!sources.some(source=>String(source.id)===String(item.id)));
  panel.innerHTML=`
    <div class="toolbar"><div class="toolbar-copy"><h2>${esc(config.title)}</h2><p>${esc(config.description)}</p></div><div class="toolbar-actions"><span class="connection"><i></i>${sources.length} ERP records</span></div></div>
    <div class="erp-notice"><strong>ERP remains the source of truth.</strong><span>Publishing copies only approved display fields into the protected website projection. Budgets, clients, contacts, notes and financial information are never exposed.</span></div>
    <div class="filters"><label class="search-field"><input id="erp-search" type="search" placeholder="Search ERP records"></label><select id="erp-publication-filter"><option value="all">All records</option><option value="published">Published</option><option value="draft">Not published</option></select><select id="erp-type-filter"><option value="all">All types</option>${[...new Set(sources.map(x=>x.source_type).filter(Boolean))].sort().map(value=>`<option value="${attr(value)}">${esc(value)}</option>`).join('')}</select></div>
    <div id="erp-record-list"></div>
    ${unmatched.length?`<section class="legacy-records"><div class="card-head"><div><h2>Website-only records</h2><p>Legacy records not linked to an ERP ID</p></div></div><div class="legacy-grid">${unmatched.map(item=>`<button type="button" data-legacy-id="${attr(item.id)}"><strong>${esc(item.title||item.name||item.caption||'Untitled')}</strong><span>${item.published?'Published':'Draft'} · Edit website record</span></button>`).join('')}</div></section>`:''}`;
  $('#erp-search').addEventListener('input',event=>{state.erp.search=event.target.value;drawErpRows()});
  $('#erp-publication-filter').addEventListener('change',event=>{state.erp.filter=event.target.value;drawErpRows()});
  $('#erp-type-filter').addEventListener('change',drawErpRows);
  $$('[data-legacy-id]').forEach(button=>button.addEventListener('click',()=>showEditor(type,publications.find(x=>String(x.id)===button.dataset.legacyId))));
  drawErpRows();
}

function drawErpRows(){
  const {type,sources,publicationById,search,filter}=state.erp,query=search.trim().toLowerCase(),typeFilter=$('#erp-type-filter')?.value||'all';
  const rows=sources.filter(source=>{
    const publication=publicationById.get(String(source.id)),published=publication?.published===true;
    return (filter==='all'||(filter==='published'&&published)||(filter==='draft'&&!published))&&(typeFilter==='all'||source.source_type===typeFilter)&&(!query||[source.name,source.job_no,source.source_type,source.status,source.stage].some(value=>String(value||'').toLowerCase().includes(query)));
  });
  const slot=$('#erp-record-list');
  if(!rows.length){slot.innerHTML=`<div class="card">${emptyState('No matching ERP records','Change the filters to see additional records.')}</div>`;return}
  slot.innerHTML=`<div class="table-wrap"><table class="data-table"><thead><tr><th>ERP record</th><th>Type</th><th>ERP status</th><th>Website</th><th></th></tr></thead><tbody>${rows.map(source=>{
    const publication=publicationById.get(String(source.id)),published=publication?.published===true;
    return `<tr><td data-label="ERP record"><div class="primary-cell"><span class="record-avatar">${esc(initials(source.name))}</span><span><strong>${esc(source.name||'Untitled')}</strong><small>${esc(source.job_no||source.flag_state||source.location||source.source_kind)}</small></span></div></td><td data-label="Type">${esc(source.source_type)}</td><td data-label="ERP status"><span class="badge status-reviewing">${esc(source.status||source.stage||source.execution_status||'Active')}</span></td><td data-label="Website"><span class="badge ${published?'status-won':'status-lost'}">${published?'Published':'Not published'}</span></td><td data-label="Actions"><div class="row-actions"><button class="row-button" data-erp-edit="${attr(source.id)}" type="button">${publication?'Edit':'Publish'}</button>${publication?`<button class="row-button" data-erp-toggle="${attr(source.id)}" type="button">${published?'Unpublish':'Publish'}</button>`:''}</div></td></tr>`
  }).join('')}</tbody></table></div>`;
  $$('[data-erp-edit]').forEach(button=>button.addEventListener('click',()=>openErpPublicationEditor(rows.find(x=>String(x.id)===button.dataset.erpEdit))));
  $$('[data-erp-toggle]').forEach(button=>button.addEventListener('click',()=>toggleErpPublication(button.dataset.erpToggle)));
}

function openErpPublicationEditor(source){
  if(!source)return;const {type,publicationById}=state.erp,config=erpPublishing[type],existing=publicationById.get(String(source.id)),row=existing||config.defaults(source),project=type==='projects';
  openDrawer(existing?`Edit ${source.name}`:`Publish ${source.name}`,'ERP website publication',`
    <div class="erp-source-summary"><span class="eyebrow">Read-only ERP source</span><strong>${esc(source.name)}</strong><small>${esc(source.source_type)} · ${esc(source.status||source.stage||'Active')}</small></div>
    <form class="editor-form" id="erp-publication-form">
      <label class="field">Public ${project?'title':'name'}<input name="display_name" value="${attr(project?row.title:row.name)}" required></label>
      <label class="field">Public category<input name="category" value="${attr(row.category||source.source_type)}"></label>
      <label class="field full">Public summary<textarea name="summary" placeholder="Write a customer-safe summary">${esc(row.summary||'')}</textarea></label>
      ${project?`<label class="field full">Cover image URL<input name="cover_image_url" type="url" value="${attr(row.cover_image_url||'')}"></label>`:`<label class="field full">Availability note<textarea name="availability_note">${esc(row.availability_note||'Contact OSS for availability.')}</textarea></label>`}
      <label class="field">Sort order<input name="sort_order" type="number" value="${attr(row.sort_order??0)}"></label>
      <label class="publish-field"><input name="published" type="checkbox" ${row.published!==false?'checked':''}> Published on website</label>
      <div class="editor-actions"><button class="primary-button" id="save-erp-publication" type="submit">Save publication</button><button class="secondary-button" id="cancel-erp-publication" type="button">Cancel</button></div>
    </form>`);
  $('#cancel-erp-publication').addEventListener('click',closeDrawer);
  $('#erp-publication-form').addEventListener('submit',event=>saveErpPublication(event,source));
}

async function saveErpPublication(event,source){
  event.preventDefault();const {type,publicationById}=state.erp,config=erpPublishing[type],form=event.currentTarget,data=new FormData(form),project=type==='projects';
  const payload={id:source.id,category:String(data.get('category')||source.source_type).trim(),summary:String(data.get('summary')||'').trim(),sort_order:Number(data.get('sort_order')||0),published:form.elements.published.checked};
  if(project){payload.title=String(data.get('display_name')||source.name).trim();payload.cover_image_url=String(data.get('cover_image_url')||'').trim()}
  else{payload.name=String(data.get('display_name')||source.name).trim();payload.availability_note=String(data.get('availability_note')||'').trim()}
  const button=$('#save-erp-publication');button.disabled=true;button.textContent='Saving…';
  const {data:record,error}=await client.from(config.publicationTable).upsert(payload,{onConflict:'id'}).select().single();
  if(error){button.disabled=false;button.textContent='Save publication';toast(error.message,'error');return}
  publicationById.set(String(source.id),record);state.erp.publications=state.erp.publications.filter(x=>String(x.id)!==String(source.id));state.erp.publications.push(record);closeDrawer();toast(`${source.name} publication saved`);renderErpPublishing();
}

async function toggleErpPublication(id){
  const {type,publicationById}=state.erp,config=erpPublishing[type],record=publicationById.get(String(id));if(!record)return;
  const published=!record.published,{data,error}=await client.from(config.publicationTable).update({published}).eq('id',record.id).select().single();
  if(error){toast(error.message,'error');return}publicationById.set(String(id),data);state.erp.publications=state.erp.publications.map(x=>String(x.id)===String(id)?data:x);toast(`${data.title||data.name} ${published?'published':'unpublished'}`);renderErpPublishing();
}
