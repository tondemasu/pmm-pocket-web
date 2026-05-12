'use strict';
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const APP_VERSION = 'PMM Pocket Web v022';
const state = { data:null, fileName:'pmm_data.json', fileHandle:null, dirty:false, edit:{type:null,id:null,index:null}, previewTarget:null, photoTarget:null, crop:{img:null,scale:1,rotation:0,dx:0,dy:0,drag:false,lastX:0,lastY:0}, choice:{input:null,button:null,options:[]} };
const typeLabels = ['P','PS','K','KS','K（要フォロー）','KS（要フォロー）'];
const titleOptions = ['','20p','50p','ONE','GM','PM','ECM','DCM','PDCM'];
const genderOptions = ['','男性','女性','その他'];
const genOptions = ['','20代','30代','40代','50代','60代','70代'];
const progressFlags = [
  ['activity_flag_pbtest','PB試験'],['activity_flag_3kuchi','3口'],['activity_flag_be','BE'],['activity_flag_pbs','PBS'],
  ['activity_flag_dreamlist','夢リスト'],['activity_flag_sevenbridge','センスオブブリッジ'],['activity_flag_listup','リストアップ'],['activity_flag_awpgrad','AWP卒業']
];
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
async function forceUpdateApp(){try{if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister()));} if(window.caches){const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k)));} toast('最新版を読み込みます'); setTimeout(()=>{location.href=location.pathname+'?v=022&t='+Date.now();},350);}catch(e){location.href=location.pathname+'?v=022&t='+Date.now();}}
function uid(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)).replace(/-/g,'')}
function markDirty(v=true){state.dirty=v; $('#dirtyMark').textContent=v?'未保存':''}
function escapeHtml(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function photoSrc(b64){if(!b64)return ''; if(String(b64).startsWith('data:'))return b64; return 'data:image/jpeg;base64,'+b64}
function stripDataUrl(s){return String(s||'').replace(/^data:image\/\w+;base64,/, '')}
function membersArray(){if(!state.data?.members)return[];return Object.values(state.data.members).filter(m=>!m.removed && !m.deleted)}
function emptyData(){return {root_id:null,members:{},other_members:[],pending_self_members:[]}}
function normalizeData(d){d=d||emptyData(); d.members=d.members||{}; d.other_members=Array.isArray(d.other_members)?d.other_members:[]; d.pending_self_members=Array.isArray(d.pending_self_members)?d.pending_self_members:[]; d.other_members.forEach(o=>{if(!o.id)o.id=uid()}); d.pending_self_members.forEach(p=>{if(!p.pending_id)p.pending_id=uid()}); return d}
function firstVal(obj, keys){for(const k of keys){const v=obj?.[k]; if(v!==undefined && v!==null && String(v)!=='') return v;} return ''}
function setAliases(obj, keys, value){keys.forEach(k=>{obj[k]=value})}
function selfMemo(m){return firstVal(m,['activity_note','activity_memo','memo','note'])}
function otherMemo(o){return firstVal(o,['note','memo','activity_note'])}
function pendingMemo(p){return firstVal(p,['activity_memo','memo','note'])}
function isFollowTarget(obj){return !!(obj && (obj.follow || obj.need_follow || obj.activity_follow || String(firstVal(obj,['member_type','status'])).includes('要フォロー')))}
function followCheckHtml(obj){return `<div class="form-row follow-check-row"><label><input type="checkbox" name="follow" ${isFollowTarget(obj)?'checked':''}> 要フォロー</label></div>`}

let pendingReadFile = null;
function openFileNotice(fileName){
  return new Promise(resolve=>{
    const d=$('#readDialog');
    $('#readFileName').textContent=fileName || '名称不明';
    const ok=$('#readOkBtn'), cancel=$('#readCancelBtn'), cancel2=$('#readCancelBtn2');
    const cleanup=(result)=>{
      ok.onclick=cancel.onclick=cancel2.onclick=null;
      d.close();
      resolve(result);
    };
    ok.onclick=()=>cleanup(true);
    cancel.onclick=()=>cleanup(false);
    cancel2.onclick=()=>cleanup(false);
    d.showModal();
  });
}
const SHARE_START = '--- PMM MEMBER SHARE START ---';
const SHARE_END = '--- PMM MEMBER SHARE END ---';
let pendingSharePayload = null;
function memberSharePayload(kind, obj){
  if(!obj)return null;
  const payload = {
    type:'PMM_MEMBER_SHARE',
    version:1,
    name:obj.name || '',
    group:firstVal(obj,['team','team2','introducer_name','group','belong']) || '',
    title:firstVal(obj,['role','title','profile_role','member_type']) || '',
    member_type:firstVal(obj,['member_type']) || '',
    area:firstVal(obj,['region','profile_region','area']) || '',
    gender:firstVal(obj,['gender']) || '',
    age:firstVal(obj,['generation','age']) || '',
    memo: kind==='self' ? selfMemo(obj) : (kind==='pending' ? pendingMemo(obj) : otherMemo(obj)),
    follow: !!obj.follow || !!obj.need_follow || String(firstVal(obj,['member_type'])).includes('要フォロー'),
    left:firstVal(obj,['left','left_point','left_points','left_total','pmm_left']),
    right:firstVal(obj,['right','right_point','right_points','right_total','pmm_right']),
    cp:firstVal(obj,['cp','commission_point','commission_points','commission','pmm_cp'])
  };
  Object.keys(payload).forEach(k=>{ if(payload[k]===undefined || payload[k]===null) payload[k]=''; });
  return payload;
}
function shareTextFromPayload(payload){
  return `${SHARE_START}
${JSON.stringify(payload)}
${SHARE_END}`;
}
async function sharePayload(payload){
  if(!payload){toast('共有する相手が見つかりません');return;}
  const text=shareTextFromPayload(payload);
  const title=`PMM個人データ：${payload.name || 'メンバー'}`;
  try{
    if(navigator.share){
      await navigator.share({title, text});
      toast('共有を開きました');
    }else if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      toast('共有テキストをコピーしました');
    }else{
      $('#infoTitle').textContent='共有テキスト';
      $('#infoBody').innerHTML=`<p class="notice">この文章を全文コピーしてLINEやメールで送ってください。</p><pre class="share-text">${escapeHtml(text)}</pre>`;
      $('#infoDialog').showModal();
    }
  }catch(e){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text); toast('共有テキストをコピーしました');}
  }
}
function shareOther(index){
  const o=state.data?.other_members?.[Number(index)];
  return sharePayload(memberSharePayload('other', o));
}
function shareSelf(id){
  const m=state.data?.members?.[id] || membersArray().find(x=>String(x.id)===String(id));
  return sharePayload(memberSharePayload('self', m));
}
function sharePending(index){
  const p=state.data?.pending_self_members?.[Number(index)];
  return sharePayload(memberSharePayload('pending', p));
}
function parseShareText(text){
  const raw=String(text||'').trim();
  const start=raw.indexOf(SHARE_START);
  const end=raw.indexOf(SHARE_END);
  const jsonText = start>=0 && end>start ? raw.slice(start+SHARE_START.length,end).trim() : raw;
  const data=JSON.parse(jsonText);
  if(data.type!=='PMM_MEMBER_SHARE') throw new Error('not share data');
  return data;
}
function openShareImportDialog(){
  $('#shareImportText').value='';
  $('#shareImportDialog').showModal();
}

async function pasteShareImportText(){
  const ta=$('#shareImportText');
  try{
    if(navigator.clipboard && navigator.clipboard.readText){
      const txt=await navigator.clipboard.readText();
      if(txt){ta.value=txt; toast('貼り付けました'); return;}
    }
  }catch(e){}
  ta.focus();
  toast('貼り付け欄を長押しして貼り付けてください');
}
function showShareImportConfirm(payload){
  pendingSharePayload=payload;
  const attrs=[payload.title,payload.area,payload.gender,payload.age].filter(Boolean).join(' / ') || '-';
  $('#shareImportSummary').innerHTML=`<p>この共有データを保存しますか？</p><p><strong>名前：</strong>${escapeHtml(payload.name||'-')}<br><strong>所属：</strong>${escapeHtml(payload.group||'-')}<br><strong>属性：</strong>${escapeHtml(attrs)}</p><p class="notice">保存先を選んでください<br>※MAPには自動配置されません</p>`;
  $('#shareImportConfirmDialog').showModal();
}
function importSharedMember(dest){
  const p=pendingSharePayload;
  if(!p){toast('共有データがありません');return;}
  if(dest==='other'){
    state.data.other_members.push({id:uid(),name:p.name||'',team:p.group||'',role:p.title||'',region:p.area||'',gender:p.gender||'',generation:p.age||'',note:p.memo||'',memo:p.memo||'',follow:!!p.follow});
    toast('つながりメンバーに保存しました');
  }else{
    state.data.pending_self_members.push({pending_id:uid(),name:p.name||'',member_type:p.member_type || (typeLabels.includes(p.title)?p.title:'P'),introducer_name:p.group||'',region:p.area||'',title:p.title||'',activity_memo:p.memo||'',memo:p.memo||'',follow:!!p.follow,left:p.left||'',right:p.right||'',cp:p.cp||'',created_at:new Date().toISOString().slice(0,19),source:'PMM_MEMBER_SHARE'});
    toast('自MAPメンバーに保存しました');
  }
  markDirty(); renderAll(); pendingSharePayload=null;
  $('#shareImportConfirmDialog').close(); $('#shareImportDialog').close();
}
async function sharePreviewPhoto(){
  const img=$('#previewImage');
  const dataUrl=img?.src||'';
  const obj=getPreviewObj(state.previewTarget);
  if(!dataUrl || dataUrl.startsWith('data:image/svg')){toast('共有できる写真がありません');return;}
  try{
    const res=await fetch(dataUrl);
    const blob=await res.blob();
    const safe=String(obj?.name||'member').replace(/[\/:*?"<>|]/g,'_');
    const file=new File([blob],`PMM_${safe}_photo.jpg`,{type:blob.type||'image/jpeg'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file]});
      toast('写真共有を開きました');
    }else{
      toast('この端末では写真共有に対応していません');
      alert('この端末では写真共有に対応していません。写真を長押しして保存または共有してください。');
    }
  }catch(e){
    toast('写真の共有に失敗しました');
    alert('写真の共有に失敗しました。写真を長押しして保存または共有してください。');
  }
}
async function readJsonFile(file){const txt=await file.text(); const data=normalizeData(JSON.parse(txt)); state.data=data; state.fileName=file.name||'pmm_data.json'; state.fileHandle=null; $('#loadedName').textContent=state.fileName; $('#startView').classList.add('hidden'); $('#mainView').classList.remove('hidden'); markDirty(false); renderAll(); toast('読み込みました')}
function ensureJsonName(name){
  let n=String(name||'pmm_data.json').trim();
  if(!n)n='pmm_data.json';
  n=n.replace(/[\\/:*?"<>|]/g,'_');
  if(!n.toLowerCase().endsWith('.json')) n += '.json';
  return n;
}
function isIOSLike(){return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1)}
async function shareJsonFile(name, blob){
  try{
    const file=new File([blob], name, {type:'application/json'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file]});
      return true;
    }
  }catch(e){}
  return false;
}
async function downloadJsonAs(fileName){
  if(!state.data){toast('データがありません');return;}
  const name=ensureJsonName(fileName||state.fileName);
  const blob = new Blob([JSON.stringify(state.data,null,2)],{type:'application/json'});

  // iPhone Safariではaタグのdownloadが黒いプレビュー画面になることがあるため、
  // 共有シートを優先して「ファイルに保存」を選べるようにする。
  if(isIOSLike()){
    const shared=await shareJsonFile(name, blob);
    if(shared){
      state.fileName=name;
      $('#loadedName').textContent=state.fileName;
      markDirty(false);
      toast('共有画面から保存してください');
      return;
    }
  }

  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  state.fileName=name;
  $('#loadedName').textContent=state.fileName;
  markDirty(false);
  toast('保存ファイルを作成しました');
}
function openSaveDialog(){
  if(!state.data){toast('データがありません');return;}
  const d=$('#saveDialog');
  $('#saveCurrentName').textContent=ensureJsonName(state.fileName);
  $('#saveFileNameInput').value=ensureJsonName(state.fileName);
  $('#saveRenameBox').classList.add('hidden');
  d.showModal();
}
async function writeJson(){openSaveDialog()}
function renderAll(){renderSelf();renderOther();renderPending();renderFollow(); updateHomeCounts();}

function updateHomeCounts(){
  const selfEl=$('#homeSelfCount'), otherEl=$('#homeOtherCount');
  if(selfEl) selfEl.textContent = ($('#selfCount')?.textContent||'0件').replace('件','') || '0';
  if(otherEl) otherEl.textContent = ($('#otherCount')?.textContent||'0件').replace('件','') || '0';
  const followEl=$('#homeFollowCount'); if(followEl) followEl.textContent = ($('#followCount')?.textContent||'0件').replace('件','') || '0';
}
function switchTab(name){
  $$('.bottom-tab').forEach(x=>x.classList.toggle('active', x.dataset.tab===name));
  $$('.tab-view').forEach(v=>v.classList.remove('active'));
  const target = $('#tab-'+name); if(target) target.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

function placeholderImage(name){
  const initial = escapeHtml((name||'?').slice(0,1));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420"><rect width="720" height="420" rx="28" fill="#102136"/><text x="360" y="235" text-anchor="middle" font-family="sans-serif" font-size="120" font-weight="700" fill="#9ecfff">${initial}</text><text x="360" y="305" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#d8e6f5">写真未登録</text></svg>`;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
function makeAvatar(b64,name,large=false){const src=photoSrc(b64); if(src){return `<img class="avatar ${large?'large':''}" src="${src}" alt="" data-preview="${escapeHtml(src)}">`} return `<div class="avatar ${large?'large':''}" data-preview="">${escapeHtml((name||'?').slice(0,1))}</div>`}
function typeTag(t){const cls=String(t||'').toLowerCase().replace(/[（）]/g,'');return `<span class="tag ${cls}">${escapeHtml(t||'-')}</span>`}
function searchText(obj,keys){return keys.map(k=>obj?.[k]||'').join(' ').toLowerCase()}
function pointVal(obj, keys){return firstVal(obj, keys)}
function pointSummary(obj){const l=pointVal(obj,['left','left_point','left_points','left_total','pmm_left']); const r=pointVal(obj,['right','right_point','right_points','right_total','pmm_right']); const cp=pointVal(obj,['cp','commission_point','commission_points','commission','pmm_cp']); const s=[]; if(l!=='')s.push('左'+escapeHtml(l)); if(r!=='')s.push('右'+escapeHtml(r)); if(cp!=='')s.push('CP'+escapeHtml(cp)); return s.length ? '<span class="point-summary">'+s.join('　')+'</span>' : ''}
function renderSelf(){
  const q=($('#selfSearch')?.value||'').trim().toLowerCase();
  const list=$('#selfList'); if(!list)return;
  const allowed=['P','PS','K（要フォロー）','KS（要フォロー）'];
  const pendingBase=(state.data?.pending_self_members||[]).map((p,idx)=>({...p,_idx:idx,_kind:'pending',_memo:pendingMemo(p)}));
  let pendingRows=pendingBase.filter(p=>!q||searchText(p,['name','member_type','introducer_name','region','title','memo','activity_memo','note','status','next_action','next_action_date','event','_memo']).includes(q));
  let selfRows=membersArray().filter(m=>allowed.includes(m.member_type||''));
  selfRows=selfRows.filter(m=>!q||searchText({...m,_memo:selfMemo(m)},['name','member_type','introducer_name','profile_region','profile_role','memo','note','activity_promise','activity_next_action','activity_next_date','activity_event','activity_temperature','activity_note','activity_memo','_memo']).includes(q));
  const rows=[...pendingRows,...selfRows.map(m=>({...m,_kind:'self'}))];
  $('#selfCount').textContent=`${rows.length}件`;
  list.innerHTML=rows.map(item=>{
    if(item._kind==='pending'){
      return `<article class="member-card new-member-card" data-preview-type="pending" data-preview-index="${item._idx}">${makeAvatar(item.photo_data,item.name)}<div class="card-main"><div class="card-title"><span class="new-prefix">新</span>${escapeHtml(item.name||'未入力')}</div><div class="card-meta">${typeTag(item.member_type)} 紹介者: ${escapeHtml(item.introducer_name||'-')}<br>${escapeHtml([item.region,item.title,item.next_action,item.next_action_date].filter(Boolean).join(' / '))}</div></div><div class="card-actions"><button class="secondary-btn small" data-share-pending="${item._idx}">共有</button><button class="secondary-btn small" data-edit-pending="${item._idx}">編集</button></div></article>`;
    }
    return `<article class="member-card" data-self-id="${item.id}" data-preview-type="self" data-preview-id="${item.id}">${makeAvatar(item.photo_data,item.name)}<div class="card-main"><div class="card-title">${escapeHtml(item.name)}</div><div class="card-meta">${typeTag(item.member_type)} ${escapeHtml(item.profile_region||'')} ${escapeHtml(item.profile_role||'')} ${pointSummary(item)}${isFollowTarget(item)?' <span class="follow-badge">要フォロー</span>':''}<br>${escapeHtml(item.activity_next_action||'')}${item.activity_next_date?' / '+escapeHtml(item.activity_next_date):''}</div></div><div class="card-actions"><button class="secondary-btn small" data-share-self="${item.id}">共有</button><button class="secondary-btn small" data-edit-self="${item.id}">編集</button></div></article>`;
  }).join('')||'<p class="notice">該当なし</p>';
}
function renderOther(){const q=($('#otherSearch')?.value||'').trim().toLowerCase(); const base=(state.data?.other_members||[]).map((o,idx)=>({...o,_idx:idx,_memo:otherMemo(o)})); const rows=base.filter(o=>!q||searchText(o,['name','team','team2','team3','role','region','gender','generation','note','memo','_memo']).includes(q)); $('#otherCount').textContent=`${rows.length}件`; $('#otherList').innerHTML=rows.map(o=>`<article class="member-card" data-preview-type="other" data-preview-index="${o._idx}"><div data-preview-wrap>${makeAvatar(o.photo_data,o.name)}</div><div class="card-main"><div class="card-title">${escapeHtml(o.name)} ${isFollowTarget(o)?'<span class="follow-badge">要フォロー</span>':''}</div><div class="card-meta">${escapeHtml([o.team,o.team2,o.team3].filter(Boolean).join(' / ')||'-')}<br>${escapeHtml([o.role,o.region,o.gender,o.generation].filter(Boolean).join(' / '))}</div></div><div class="card-actions"><button class="secondary-btn small" data-share-other="${o._idx}">共有</button><button class="secondary-btn small" data-edit-other="${o._idx}">編集</button></div></article>`).join('')||'<p class="notice">該当なし</p>'}
function renderFollow(){const list=$('#followList'); if(!list)return; const q=($('#followSearch')?.value||'').trim().toLowerCase(); const pending=(state.data?.pending_self_members||[]).map((p,idx)=>({...p,_idx:idx,_kind:'pending',_memo:pendingMemo(p),_category:'自MAP'})).filter(isFollowTarget); const self=membersArray().map(m=>({...m,_kind:'self',_memo:selfMemo(m),_category:'自MAP'})).filter(isFollowTarget); const other=(state.data?.other_members||[]).map((o,idx)=>({...o,_idx:idx,_kind:'other',_memo:otherMemo(o),_category:'つながり'})).filter(isFollowTarget); let rows=[...pending,...self,...other]; rows=rows.filter(x=>!q||searchText(x,['name','team','team2','team3','role','region','gender','generation','profile_region','profile_role','member_type','introducer_name','note','memo','activity_note','activity_memo','_memo']).includes(q)); $('#followCount').textContent=`${rows.length}件`; list.innerHTML=rows.map(item=>{ const meta=item._kind==='other' ? `${escapeHtml([item.team,item.team2,item.team3].filter(Boolean).join(' / ')||'-')}<br>${escapeHtml([item.role,item.region,item.gender,item.generation].filter(Boolean).join(' / '))}` : `${typeTag(item.member_type)} ${escapeHtml(item.introducer_name||item.profile_region||item.region||'')} ${pointSummary(item)}<br>${escapeHtml(item.activity_next_action||item.next_action||'')}${(item.activity_next_date||item.next_action_date)?' / '+escapeHtml(item.activity_next_date||item.next_action_date):''}`; const action=item._kind==='other'?`<button class="secondary-btn small" data-edit-other="${item._idx}">編集</button>`:(item._kind==='pending'?`<button class="secondary-btn small" data-edit-pending="${item._idx}">編集</button>`:`<button class="secondary-btn small" data-edit-self="${item.id}">編集</button>`); const previewAttrs=item._kind==='self'?`data-preview-type="self" data-preview-id="${item.id}"`:`data-preview-type="${item._kind}" data-preview-index="${item._idx}"`; return `<article class="member-card" ${previewAttrs}>${makeAvatar(item.photo_data,item.name)}<div class="card-main"><div class="card-title">${escapeHtml(item.name||'未入力')} <span class="follow-badge">要フォロー</span></div><div class="card-meta">${item._category}メンバー<br>${meta}</div></div><div class="card-actions">${action}</div></article>`; }).join('')||'<p class="notice">要フォロー対象はありません</p>';}
function renderPending(){renderSelf()}
function formInput(label,name,value='',type='text'){return `<div class="form-row"><label>${label}</label><input name="${name}" type="${type}" value="${escapeHtml(value)}"></div>`}
function formText(label,name,value=''){return `<div class="form-row"><label>${label}</label><textarea name="${name}">${escapeHtml(value)}</textarea></div>`}
function displayChoiceValue(v){return v ? v : '未設定'}
function formSelect(label,name,value='',opts=[]){
  const safeName=escapeHtml(name);
  const safeLabel=escapeHtml(label);
  const safeValue=escapeHtml(value||'');
  const optionJson=escapeHtml(JSON.stringify(opts));
  return `<div class="form-row choice-row"><label>${safeLabel}</label><input type="hidden" name="${safeName}" value="${safeValue}"><button type="button" class="choice-select-btn" data-choice-name="${safeName}" data-choice-label="${safeLabel}" data-choice-options="${optionJson}"><span>${escapeHtml(displayChoiceValue(value))}</span><span class="choice-chevron">⌄</span></button></div>`
}
function openChoiceSheet(btn){
  const row=btn.closest('.choice-row');
  const input=row?.querySelector('input[type="hidden"]');
  if(!input)return;
  let opts=[];
  try{opts=JSON.parse(btn.dataset.choiceOptions||'[]')}catch(e){opts=[]}
  state.choice={input,button:btn,options:opts};
  $('#choiceTitle').textContent=btn.dataset.choiceLabel || '選択';
  const current=input.value||'';
  $('#choiceList').innerHTML=opts.map((o,i)=>`<button type="button" class="choice-option ${o===current?'selected':''}" data-choice-index="${i}"><span>${escapeHtml(displayChoiceValue(o))}</span><span>${o===current?'✓':''}</span></button>`).join('');
  $('#choiceDialog').showModal();
}
function chooseSheetValue(index){
  const i=Number(index);
  const v=state.choice.options?.[i] ?? '';
  if(state.choice.input) state.choice.input.value=v;
  if(state.choice.button) state.choice.button.querySelector('span:first-child').textContent=displayChoiceValue(v);
  if($('#choiceDialog')?.open) $('#choiceDialog').close();
}

function progressHtml(obj){return `<div class="form-row"><label>進捗チェック</label><div class="checks">${progressFlags.map(([k,l])=>`<label><input type="checkbox" name="${k}" ${obj?.[k]?'checked':''}> ${l}</label>`).join('')}</div></div>`}
function photoBlock(obj){return `<div class="photo-row">${makeAvatar(obj.photo_data,obj.name,true)}<div class="photo-actions"><button type="button" class="secondary-btn small" id="photoEditBtn">写真登録</button><button type="button" class="danger-btn small" id="photoRemoveBtn">写真削除</button></div></div>`}
function openEdit(type,idOrIndex){state.edit={type,id:null,index:null}; let obj={}; if(type==='self'){state.edit.id=idOrIndex; obj=state.data.members[idOrIndex]||{}} if(type==='other'){state.edit.index=Number(idOrIndex); obj=state.data.other_members[state.edit.index]||{}} if(type==='pending'){state.edit.index=Number(idOrIndex); obj=state.data.pending_self_members[state.edit.index]||{}} if(type==='other-new'){obj={id:uid(),name:''}} if(type==='pending-new'){obj={pending_id:uid(),name:'',member_type:'P',created_at:new Date().toISOString().slice(0,19)}}
  $('#editTitle').textContent= type.includes('other')?'つながりメンバー':type.includes('pending')?'新メンバー':'自MAPメンバー';
  $('#deleteBtn').classList.toggle('hidden', type.endsWith('new'));
  let html=photoBlock(obj);
  if(type==='self') html += `${followCheckHtml(obj)}<div class="self-edit-tabs" role="tablist" aria-label="自MAPメンバー編集切替"><button type="button" class="self-edit-tab active" data-self-edit-tab="activity">活動管理</button><button type="button" class="self-edit-tab" data-self-edit-tab="basic">基本情報</button></div><section class="self-edit-pane active" data-self-edit-pane="activity"><h4>活動管理</h4>${formInput('約束したこと','activity_promise',obj.activity_promise)}${formInput('次回アクション','activity_next_action',obj.activity_next_action)}${formInput('次回予定日','activity_next_date',obj.activity_next_date,'date')}${formInput('参加予定イベント','activity_event',obj.activity_event)}${formInput('温度感','activity_temperature',obj.activity_temperature)}${formText('活動メモ','activity_note',selfMemo(obj))}</section><section class="self-edit-pane" data-self-edit-pane="basic"><h4>基本情報</h4><div class="two-col">${formInput('名前','name',obj.name)}${formSelect('メンバー種類','member_type',obj.member_type,typeLabels)}${formInput('紹介者名','introducer_name',obj.introducer_name)}${formInput('地域','profile_region',obj.profile_region)}${formInput('タイトル','profile_role',obj.profile_role)}${formInput('左','left',firstVal(obj,['left','left_point','left_points','left_total','pmm_left']),'number')}${formInput('右','right',firstVal(obj,['right','right_point','right_points','right_total','pmm_right']),'number')}${formInput('CP','cp',firstVal(obj,['cp','commission_point','commission_points','commission','pmm_cp']),'number')}</div>${progressHtml(obj)}</section>`;
  else if(type.includes('other')) html += `${followCheckHtml(obj)}<div class="edit-quick-actions"><button type="button" class="secondary-btn small" id="otherShareBtn">このメンバーを共有</button></div>${formInput('名前','name',obj.name)}<div class="two-col">${formInput('所属1','team',obj.team)}${formInput('所属2','team2',obj.team2)}${formInput('所属3','team3',obj.team3)}${formSelect('タイトル','role',obj.role,titleOptions)}${formInput('地域','region',obj.region)}${formSelect('性別','gender',obj.gender,genderOptions)}${formSelect('世代','generation',obj.generation,genOptions)}</div>${formText('メモ','note',otherMemo(obj))}`;
  else html += `${followCheckHtml(obj)}<div class="two-col">${formInput('名前','name',obj.name)}${formSelect('メンバー種類','member_type',obj.member_type,typeLabels)}${formInput('紹介者名','introducer_name',obj.introducer_name)}${formInput('地域','region',obj.region)}${formInput('タイトル','title',obj.title)}</div>${progressHtml(obj)}<h4>活動管理</h4>${formInput('約束したこと','promise',obj.promise||obj.activity_promise)}${formInput('次回アクション','next_action',obj.next_action)}${formInput('次回予定日','next_action_date',obj.next_action_date,'date')}${formInput('参加予定イベント','event',obj.event)}${formInput('温度感','temperature',obj.temperature)}${formText('活動メモ','activity_memo',obj.activity_memo||obj.memo)}`;
  $('#editBody').innerHTML=html; $('#editSaveTopBtn').classList.toggle('hidden', !type.includes('pending')); $('#editDialog').showModal();
}
function saveEdit(){const fd=new FormData($('#editForm')); const type=state.edit.type; let obj={}; if(type==='self') obj=state.data.members[state.edit.id]; else if(type==='other') obj=state.data.other_members[state.edit.index]; else if(type==='pending') obj=state.data.pending_self_members[state.edit.index]; else obj={};
  for(const [k,v] of fd.entries()) obj[k]=String(v);
  if(type==='self'){ setAliases(obj,['activity_note','activity_memo','memo'], obj.activity_note||''); setAliases(obj,['left','left_point','left_points','left_total','pmm_left'], obj.left||''); setAliases(obj,['right','right_point','right_points','right_total','pmm_right'], obj.right||''); setAliases(obj,['cp','commission_point','commission_points','commission','pmm_cp'], obj.cp||''); }
  if(type.includes('other')) setAliases(obj,['note','memo'], obj.note||'');
  if(type.includes('pending')) setAliases(obj,['activity_memo','memo'], obj.activity_memo||'');
  progressFlags.forEach(([k])=>{obj[k]=!!$('#editBody').querySelector(`[name="${k}"]`)?.checked});
  const followBox=$('#editBody').querySelector('[name="follow"]'); if(followBox) obj.follow=!!followBox.checked;
  if(type==='other-new'){ if(!obj.id)obj.id=uid(); state.data.other_members.push(obj); }
  if(type==='pending-new'){ if(!obj.pending_id)obj.pending_id=uid(); if(!obj.created_at)obj.created_at=new Date().toISOString().slice(0,19); obj.source='PMM Pocket Web'; state.data.pending_self_members.push(obj); }
  markDirty(); renderAll(); $('#editDialog').close(); toast('記入しました。最後に保存してください')
}
function editTargetName(){
  const type=state.edit.type;
  let obj=null;
  if(type==='self') obj=state.data.members[state.edit.id];
  else if(type==='other') obj=state.data.other_members[state.edit.index];
  else if(type==='pending') obj=state.data.pending_self_members[state.edit.index];
  return (obj?.name || obj?.member_name || obj?.full_name || 'このメンバー').trim() || 'このメンバー';
}
function askConfirmDelete(name, type='member'){
  return new Promise(resolve=>{
    const d=$('#confirmDialog');
    const label = type==='self' ? '自MAPメンバー情報' : (type==='other' ? 'つながりメンバー情報' : '新メンバー情報');
    $('#confirmTitle').textContent='本当に削除しますか？';
    $('#confirmMessage').textContent=`${label}から\n${name}さんを削除します\n\n削除すると元に戻せません`;
    const ok=$('#confirmOkBtn'), cancel=$('#confirmCancelBtn');
    const cleanup=(v)=>{ok.onclick=null;cancel.onclick=null;d.oncancel=null; if(d.open)d.close(); resolve(v);};
    ok.onclick=()=>cleanup(true);
    cancel.onclick=()=>cleanup(false);
    d.oncancel=(e)=>{e.preventDefault(); cleanup(false);};
    d.showModal();
  });
}
async function deleteEdit(){
  const type=state.edit.type;
  const name=editTargetName();
  const ok=await askConfirmDelete(name, type);
  if(!ok)return;
  if(type==='self'){
    const obj=state.data.members[state.edit.id];
    if(obj){obj.deleted=true; obj.removed=true;}
  }else if(type==='other'){
    state.data.other_members.splice(state.edit.index,1);
  }else if(type==='pending'){
    state.data.pending_self_members.splice(state.edit.index,1);
  }
  markDirty();renderAll();$('#editDialog').close();toast('削除しました。最後に保存してください')
}
function openPhoto(){state.photoTarget={...state.edit}; resetCrop(); $('#photoDialog').showModal(); drawCrop()}
function resetCrop(){state.crop={img:null,scale:1,rotation:0,dx:0,dy:0,drag:false,lastX:0,lastY:0}; $('#zoomRange').value=1}
function getCurrentObj(){const t=state.edit.type;if(t==='self')return state.data.members[state.edit.id]; if(t==='other')return state.data.other_members[state.edit.index]; if(t==='pending')return state.data.pending_self_members[state.edit.index]; return null}
function setCurrentPhoto(b64){const obj=getCurrentObj(); if(obj){obj.photo_data=b64; markDirty(); renderAll();}}
function loadCropFile(file){if(!file)return; const img=new Image(); img.onload=()=>{state.crop.img=img; state.crop.scale=Math.max(320/img.width,320/img.height); $('#zoomRange').value=state.crop.scale; state.crop.dx=0; state.crop.dy=0; drawCrop()}; img.src=URL.createObjectURL(file)}
function drawCrop(){const c=$('#cropCanvas'),ctx=c.getContext('2d'),cr=state.crop; ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle='#111';ctx.fillRect(0,0,c.width,c.height); if(!cr.img)return; ctx.save(); ctx.translate(c.width/2+cr.dx,c.height/2+cr.dy); ctx.rotate(cr.rotation*Math.PI/180); ctx.scale(cr.scale,cr.scale); ctx.drawImage(cr.img,-cr.img.width/2,-cr.img.height/2); ctx.restore()}
function applyPhoto(){const src=$('#cropCanvas'); const out=document.createElement('canvas'); out.width=160; out.height=160; const o=out.getContext('2d'); o.drawImage(src,40,40,240,240,0,0,160,160); setCurrentPhoto(stripDataUrl(out.toDataURL('image/jpeg',0.72))); $('#photoDialog').close(); $('#editDialog').close(); toast('写真を記入しました。最後に保存してください')}
function preview(src, triggerEl=null){
  const d=$('#previewDialog');
  state.previewTarget = getPreviewTarget(triggerEl);
  const obj = getPreviewObj(state.previewTarget);
  $('#previewImage').src = src || placeholderImage(obj?.name || '');
  $('#previewMemo').value = getPreviewMemo(state.previewTarget);
  if(!d.open)d.show();
}
function getPreviewTarget(el){
  const card = el?.closest?.('[data-preview-type]');
  if(card){
    const type=card.dataset.previewType;
    if(type==='self') return {type:'self', id:card.dataset.previewId};
    return {type, index:Number(card.dataset.previewIndex)};
  }
  if(el?.closest?.('#editDialog') && state.edit?.type){
    if(state.edit.type==='self') return {type:'self', id:state.edit.id};
    return {type:state.edit.type, index:state.edit.index};
  }
  return null;
}
function getPreviewObj(target){
  if(!target||!state.data)return null;
  if(target.type==='self') return membersArray().find(m=>String(m.id)===String(target.id));
  if(target.type==='other') return state.data.other_members?.[target.index];
  if(target.type==='pending') return state.data.pending_self_members?.[target.index];
  return null;
}
function getPreviewMemo(target){
  const obj=getPreviewObj(target);
  if(!obj)return '';
  if(target.type==='self') return selfMemo(obj);
  if(target.type==='other') return otherMemo(obj);
  if(target.type==='pending') return pendingMemo(obj);
  return '';
}
function savePreviewMemo(){
  const target=state.previewTarget;
  const obj=getPreviewObj(target);
  if(!obj){toast('メモの対象が見つかりません');return;}
  const v=$('#previewMemo').value||'';
  if(target.type==='self') setAliases(obj,['activity_note','activity_memo','memo'],v);
  else if(target.type==='other') setAliases(obj,['note','memo'],v);
  else if(target.type==='pending') setAliases(obj,['activity_memo','memo'],v);
  markDirty();
  renderAll();
  toast('メモを記入しました。最後に保存してください');
}

function showInfo(kind){const help=`<p><strong>推奨環境</strong></p><ul><li>iPhoneは <strong>Safari</strong> でお使いください</li><li>Androidは <strong>Chrome</strong> でお使いください</li><li>スマホではホーム画面に追加して使うのがおすすめです</li></ul><p class="notice">ブラウザのまま使う場合、下スワイプや再読み込みでスタート画面に戻ることがあります。保存前に更新すると未保存内容が失われる場合があるため、こまめに保存してください。</p><p>iPhoneのChromeでは、保存ファイルが「このiPhone内 → Chrome」に入りやすく、iCloud Driveへ直接保存しにくい場合があります。iCloud Driveで管理したい場合はSafariでの利用をおすすめします。</p><p><strong>基本の使い方</strong></p><ol><li>PC版PMMを閉じます</li><li>保存ファイル読込でPMM保存ファイルを読み込みます</li><li>自MAPメンバー活動管理やつながりメンバー辞書を編集します</li><li>要フォローにチェックした人は「フォロー」画面でまとめて確認します</li><li>最後に保存ボタンでPC版PMM用の保存ファイルを作成します</li><li>PC版PMMで保存したファイルを開きます</li></ol><p>このWeb版はデータをサーバーへ保存しません。読み込んだJSONはブラウザ内で処理します。</p>`
 const about=`<div class="about-head"><div><p><strong>PMM Pocket Web</strong><br>${APP_VERSION}</p></div><img src="assets/pmm_logo.jpg" alt="PMMロゴ" class="about-logo"></div><p>PMM Pocket Webは、PC版PMMの補助として使う現場用ツールです。</p><p>PMM本体は、全体管理・MAP管理・ポイント計算・作戦立案を担当します。</p><p>Pocket Webは、現場で会ったメンバーの備忘録、写真、メモ、つながりメンバーの情報整理、要フォロー者の活動管理に特化します。</p><p>共有JSONに写真は含めません。写真は必要に応じて写真プレビューの「写真を共有」からLINE等で別送してください。</p><p>お問い合わせ先：兵藤 茂樹<br><a href="https://line.me/ti/p/XJt7xbeJ1j" target="_blank" rel="noopener">LINEで問い合わせる</a></p>`
 const downloads=`<p><strong>PC版PMMダウンロード</strong></p><p>現在準備中です。</p><ul><li>Windows版：準備中</li><li>Mac版：準備中</li></ul><p>公開後、この画面からダウンロード先を案内します。</p>`
 const ios=`<p><strong>スマホのホーム画面に追加</strong></p><p>iPhoneはSafariで開き、共有ボタンから「ホーム画面に追加」を選んでください。</p><p>AndroidはChromeで開き、メニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。</p>`
 const android=`<p><strong>Androidホーム追加</strong></p><p>AndroidはChromeで開き、メニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。</p>`;
 const map={help:['ヘルプ',help],about:['このアプリについて',about],downloads:['PC版PMMダウンロード',downloads],'install-ios':['iPhoneホーム追加',ios],'install-android':['Androidホーム追加',android]};
 const item=map[kind]||map.help; $('#infoTitle').textContent=item[0]; $('#infoBody').innerHTML=item[1]; $('#infoDialog').showModal(); }
function init(){ if(localStorage.getItem('pmmPocketDark')==='1')document.body.classList.add('dark'); const toggleDark=()=>{document.body.classList.toggle('dark');localStorage.setItem('pmmPocketDark',document.body.classList.contains('dark')?'1':'0')}; $$('[data-dark-toggle]').forEach(btn=>btn.onclick=toggleDark);
 ['fileInput','fileInput2'].forEach(id=>{$('#'+id).onchange=async e=>{const f=e.target.files[0]; if(!f)return; const ok=await openFileNotice(f.name); if(ok) await readJsonFile(f); e.target.value='';}});
 $('#newDataBtn').onclick=()=>{state.data=emptyData();state.fileName='pmm_data.json';$('#loadedName').textContent=state.fileName;$('#startView').classList.add('hidden');$('#mainView').classList.remove('hidden');renderAll();markDirty(false)}; $('#saveBtn').onclick=writeJson; $('#shareImportOpenBtn').onclick=openShareImportDialog; $('#shareImportCloseBtn').onclick=()=>$('#shareImportDialog').close(); const pasteBtn=$('#shareImportPasteBtn'); if(pasteBtn) pasteBtn.onclick=pasteShareImportText; $('#shareImportReadBtn').onclick=()=>{try{showShareImportConfirm(parseShareText($('#shareImportText').value));}catch(e){toast('共有データを読み込めません');}}; $('#shareSaveOtherBtn').onclick=()=>importSharedMember('other'); $('#shareSaveSelfBtn').onclick=()=>importSharedMember('self'); $('#shareSaveCancelBtn').onclick=()=>$('#shareImportConfirmDialog').close();
 $$('.bottom-tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
 $('#selfSearch').oninput=renderSelf; $('#otherSearch').oninput=renderOther; const fs=$('#followSearch'); if(fs) fs.oninput=renderFollow; const ps=$('#pendingSearch'); if(ps) ps.oninput=renderPending; $('#otherAddBtn').onclick=()=>openEdit('other-new'); const pa=$('#pendingAddBtn'); if(pa) pa.onclick=()=>openEdit('pending-new'); const sa=$('#selfAddBtn'); if(sa) sa.onclick=()=>openEdit('pending-new'); const ss=$('#selfSaveBtn'); if(ss) ss.onclick=writeJson; const os=$('#otherSaveBtn'); if(os) os.onclick=writeJson; const fsb=$('#followSaveBtn'); if(fsb) fsb.onclick=writeJson;
 document.body.addEventListener('click',e=>{const cb=e.target.closest('.choice-select-btn'); if(cb){openChoiceSheet(cb); return;} const st=e.target.closest('[data-self-edit-tab]'); if(st){const name=st.dataset.selfEditTab; $$('.self-edit-tab').forEach(x=>x.classList.toggle('active',x.dataset.selfEditTab===name)); $$('.self-edit-pane').forEach(x=>x.classList.toggle('active',x.dataset.selfEditPane===name)); return;} const u=e.target.closest('[data-update-app]'); if(u) forceUpdateApp(); const p=e.target.closest('[data-preview]'); if(p) preview(p.dataset.preview, p); const s=e.target.closest('[data-edit-self]'); if(s)openEdit('self',s.dataset.editSelf); const sh=e.target.closest('[data-share-other]'); if(sh){shareOther(sh.dataset.shareOther); return;} const ssr=e.target.closest('[data-share-self]'); if(ssr){shareSelf(ssr.dataset.shareSelf); return;} const spr=e.target.closest('[data-share-pending]'); if(spr){sharePending(spr.dataset.sharePending); return;} const o=e.target.closest('[data-edit-other]'); if(o)openEdit('other',o.dataset.editOther); const pn=e.target.closest('[data-edit-pending]'); if(pn)openEdit('pending',pn.dataset.editPending); const j=e.target.closest('[data-tab-jump]'); if(j)switchTab(j.dataset.tabJump); const l=e.target.closest('[data-dialog]'); if(l)showInfo(l.dataset.dialog);});
 $('#closeEditBtn').onclick=()=>$('#editDialog').close(); const choiceClose=$('#choiceCloseBtn'); if(choiceClose) choiceClose.onclick=()=>$('#choiceDialog').close(); const choiceList=$('#choiceList'); if(choiceList) choiceList.onclick=e=>{const opt=e.target.closest('[data-choice-index]'); if(opt) chooseSheetValue(opt.dataset.choiceIndex);}; document.addEventListener('click',e=>{if(e.target?.id==='otherShareBtn' && state.edit.type?.includes('other')) shareOther(state.edit.index);}); $('#editSaveBtn').onclick=saveEdit; $('#editSaveTopBtn').onclick=saveEdit; $('#deleteBtn').onclick=deleteEdit; $('#closeInfoBtn').onclick=()=>$('#infoDialog').close(); $('#saveCloseBtn').onclick=()=>$('#saveDialog').close(); $('#saveSameBtn').onclick=async()=>{await downloadJsonAs(state.fileName); $('#saveDialog').close();}; $('#saveRenameBtn').onclick=()=>{$('#saveRenameBox').classList.remove('hidden'); $('#saveFileNameInput').focus();}; $('#saveWithNameBtn').onclick=async()=>{await downloadJsonAs($('#saveFileNameInput').value); $('#saveDialog').close();}; $('#closePreviewBtn').onclick=()=>$('#previewDialog').close(); $('#sharePreviewPhotoBtn').onclick=sharePreviewPhoto; $('#previewMemoSaveBtn').onclick=savePreviewMemo;
 document.addEventListener('click',e=>{ if(e.target?.id==='photoEditBtn')openPhoto(); if(e.target?.id==='photoRemoveBtn'){setCurrentPhoto(''); $('#editDialog').close(); toast('写真を削除しました。最後に保存してください')}});
 $('#closePhotoBtn').onclick=()=>$('#photoDialog').close(); $('#photoFileInput').onchange=e=>loadCropFile(e.target.files[0]); $('#photoCameraInput').onchange=e=>loadCropFile(e.target.files[0]); $('#rotatePhotoBtn').onclick=()=>{state.crop.rotation=(state.crop.rotation+90)%360;drawCrop()}; $('#clearPhotoBtn').onclick=()=>{setCurrentPhoto('');$('#photoDialog').close();$('#editDialog').close();toast('写真を削除しました。最後に保存してください')}; $('#applyPhotoBtn').onclick=applyPhoto; $('#zoomRange').oninput=e=>{state.crop.scale=Number(e.target.value);drawCrop()};
 const cw=$('.crop-wrap'); cw.addEventListener('pointerdown',e=>{state.crop.drag=true;state.crop.lastX=e.clientX;state.crop.lastY=e.clientY;cw.setPointerCapture(e.pointerId)}); cw.addEventListener('pointermove',e=>{if(!state.crop.drag)return;state.crop.dx+=e.clientX-state.crop.lastX;state.crop.dy+=e.clientY-state.crop.lastY;state.crop.lastX=e.clientX;state.crop.lastY=e.clientY;drawCrop()}); cw.addEventListener('pointerup',()=>state.crop.drag=false);
 if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=022').then(r=>r.update()).catch(()=>{})}
}
document.addEventListener('DOMContentLoaded',init);
