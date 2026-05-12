'use strict';
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const APP_VERSION = 'PMM Pocket Web v015';
const state = { data:null, fileName:'pmm_data.json', fileHandle:null, dirty:false, edit:{type:null,id:null,index:null}, previewTarget:null, photoTarget:null, crop:{img:null,scale:1,rotation:0,dx:0,dy:0,drag:false,lastX:0,lastY:0} };
const typeLabels = ['P','PS','K','KS','K（要フォロー）','KS（要フォロー）'];
const titleOptions = ['','ONE','GM','PM','ECM','DCM','PDCM'];
const genderOptions = ['','男性','女性','その他'];
const genOptions = ['','20代','30代','40代','50代','60代','70代'];
const progressFlags = [
  ['activity_flag_pbtest','PB試験'],['activity_flag_3kuchi','3口'],['activity_flag_be','BE'],['activity_flag_pbs','PBS'],
  ['activity_flag_dreamlist','夢リスト'],['activity_flag_sevenbridge','センスオブブリッジ'],['activity_flag_listup','リストアップ'],['activity_flag_awpgrad','AWP卒業']
];
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
async function forceUpdateApp(){try{if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister()));} if(window.caches){const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k)));} toast('最新版を読み込みます'); setTimeout(()=>{location.href=location.pathname+'?v=015&t='+Date.now();},350);}catch(e){location.href=location.pathname+'?v=015&t='+Date.now();}}
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

function openFileNotice(fileName){
  alert(`保存ファイルの読み込み\n\n開くファイル：${fileName || '名称不明'}\n\nPC版PMMとPMM Pocket Webで同じ保存ファイルを同時に開くと 上書き事故の原因になります。\n\nPC版PMMを閉じてから読み込んでください。`);
}
function otherShareText(o){
  const teams=[o.team,o.team2,o.team3].filter(Boolean).join(' / ') || '-';
  const attrs=[o.role,o.region,o.gender,o.generation].filter(Boolean).join(' / ') || '-';
  const memo=otherMemo(o)||'';
  return [
    '【PMM 他メンバー情報】',
    `名前：${o.name || '-'}`,
    `所属：${teams}`,
    `属性：${attrs}`,
    memo ? `メモ：\n${memo}` : 'メモ：-'
  ].join('\n');
}
async function shareOther(index){
  const o=state.data?.other_members?.[Number(index)];
  if(!o){toast('共有する相手が見つかりません');return;}
  const text=otherShareText(o);
  try{
    if(navigator.share){
      await navigator.share({title:`PMM：${o.name || '他メンバー'}`, text});
      toast('共有を開きました');
    }else if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      toast('共有文をコピーしました');
    }else{
      $('#infoTitle').textContent='共有文';
      $('#infoBody').innerHTML=`<pre class="share-text">${escapeHtml(text)}</pre>`;
      $('#infoDialog').showModal();
    }
  }catch(e){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text); toast('共有文をコピーしました');}
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
function downloadJsonAs(fileName){
  if(!state.data){toast('データがありません');return;}
  const name=ensureJsonName(fileName||state.fileName);
  const blob = new Blob([JSON.stringify(state.data,null,2)],{type:'application/json'});
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
function renderAll(){renderSelf();renderOther();renderPending(); updateHomeCounts();}

function updateHomeCounts(){
  const selfEl=$('#homeSelfCount'), otherEl=$('#homeOtherCount');
  if(selfEl) selfEl.textContent = ($('#selfCount')?.textContent||'0件').replace('件','') || '0';
  if(otherEl) otherEl.textContent = ($('#otherCount')?.textContent||'0件').replace('件','') || '0';
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
      return `<article class="member-card new-member-card" data-preview-type="pending" data-preview-index="${item._idx}">${makeAvatar(item.photo_data,item.name)}<div class="card-main"><div class="card-title"><span class="new-prefix">新</span>${escapeHtml(item.name||'未入力')}</div><div class="card-meta">${typeTag(item.member_type)} 紹介者: ${escapeHtml(item.introducer_name||'-')}<br>${escapeHtml([item.region,item.title,item.next_action,item.next_action_date].filter(Boolean).join(' / '))}</div></div><div class="card-actions"><button class="secondary-btn small" data-edit-pending="${item._idx}">編集</button></div></article>`;
    }
    return `<article class="member-card" data-self-id="${item.id}" data-preview-type="self" data-preview-id="${item.id}">${makeAvatar(item.photo_data,item.name)}<div class="card-main"><div class="card-title">${escapeHtml(item.name)}</div><div class="card-meta">${typeTag(item.member_type)} ${escapeHtml(item.profile_region||'')} ${escapeHtml(item.profile_role||'')}<br>${escapeHtml(item.activity_next_action||'')}${item.activity_next_date?' / '+escapeHtml(item.activity_next_date):''}</div></div><div class="card-actions"><button class="secondary-btn small" data-edit-self="${item.id}">編集</button></div></article>`;
  }).join('')||'<p class="notice">該当なし</p>';
}
function renderOther(){const q=($('#otherSearch')?.value||'').trim().toLowerCase(); const base=(state.data?.other_members||[]).map((o,idx)=>({...o,_idx:idx,_memo:otherMemo(o)})); const rows=base.filter(o=>!q||searchText(o,['name','team','team2','team3','role','region','gender','generation','note','memo','_memo']).includes(q)); $('#otherCount').textContent=`${rows.length}件`; $('#otherList').innerHTML=rows.map(o=>`<article class="member-card" data-preview-type="other" data-preview-index="${o._idx}"><div data-preview-wrap>${makeAvatar(o.photo_data,o.name)}</div><div class="card-main"><div class="card-title">${escapeHtml(o.name)}</div><div class="card-meta">${escapeHtml([o.team,o.team2,o.team3].filter(Boolean).join(' / ')||'-')}<br>${escapeHtml([o.role,o.region,o.gender,o.generation].filter(Boolean).join(' / '))}</div></div><div class="card-actions"><button class="secondary-btn small" data-share-other="${o._idx}">共有</button><button class="secondary-btn small" data-edit-other="${o._idx}">編集</button></div></article>`).join('')||'<p class="notice">該当なし</p>'}
function renderPending(){renderSelf()}
function formInput(label,name,value='',type='text'){return `<div class="form-row"><label>${label}</label><input name="${name}" type="${type}" value="${escapeHtml(value)}"></div>`}
function formText(label,name,value=''){return `<div class="form-row"><label>${label}</label><textarea name="${name}">${escapeHtml(value)}</textarea></div>`}
function formSelect(label,name,value='',opts=[]){return `<div class="form-row"><label>${label}</label><select name="${name}">${opts.map(o=>`<option value="${escapeHtml(o)}" ${o===value?'selected':''}>${escapeHtml(o||' ')}</option>`).join('')}</select></div>`}
function progressHtml(obj){return `<div class="form-row"><label>進捗チェック</label><div class="checks">${progressFlags.map(([k,l])=>`<label><input type="checkbox" name="${k}" ${obj?.[k]?'checked':''}> ${l}</label>`).join('')}</div></div>`}
function photoBlock(obj){return `<div class="photo-row">${makeAvatar(obj.photo_data,obj.name,true)}<div class="photo-actions"><button type="button" class="secondary-btn small" id="photoEditBtn">写真登録</button><button type="button" class="danger-btn small" id="photoRemoveBtn">写真削除</button></div></div>`}
function openEdit(type,idOrIndex){state.edit={type,id:null,index:null}; let obj={}; if(type==='self'){state.edit.id=idOrIndex; obj=state.data.members[idOrIndex]||{}} if(type==='other'){state.edit.index=Number(idOrIndex); obj=state.data.other_members[state.edit.index]||{}} if(type==='pending'){state.edit.index=Number(idOrIndex); obj=state.data.pending_self_members[state.edit.index]||{}} if(type==='other-new'){obj={id:uid(),name:''}} if(type==='pending-new'){obj={pending_id:uid(),name:'',member_type:'P',created_at:new Date().toISOString().slice(0,19)}}
  $('#editTitle').textContent= type.includes('other')?'他メンバー':type.includes('pending')?'新メンバー':'自メンバー';
  $('#deleteBtn').classList.toggle('hidden', type==='self' || type.endsWith('new'));
  let html=photoBlock(obj);
  if(type==='self') html += `<div class="self-edit-tabs" role="tablist" aria-label="自メンバー編集切替"><button type="button" class="self-edit-tab active" data-self-edit-tab="activity">活動管理</button><button type="button" class="self-edit-tab" data-self-edit-tab="basic">基本情報</button></div><section class="self-edit-pane active" data-self-edit-pane="activity"><h4>活動管理</h4>${formInput('約束したこと','activity_promise',obj.activity_promise)}${formInput('次回アクション','activity_next_action',obj.activity_next_action)}${formInput('次回予定日','activity_next_date',obj.activity_next_date,'date')}${formInput('参加予定イベント','activity_event',obj.activity_event)}${formInput('温度感','activity_temperature',obj.activity_temperature)}${formText('活動メモ','activity_note',selfMemo(obj))}</section><section class="self-edit-pane" data-self-edit-pane="basic"><h4>基本情報</h4><div class="two-col">${formInput('名前','name',obj.name)}${formSelect('メンバー種類','member_type',obj.member_type,typeLabels)}${formInput('紹介者名','introducer_name',obj.introducer_name)}${formInput('地域','profile_region',obj.profile_region)}${formInput('タイトル','profile_role',obj.profile_role)}</div>${progressHtml(obj)}</section>`;
  else if(type.includes('other')) html += `<div class="edit-quick-actions"><button type="button" class="secondary-btn small" id="otherShareBtn">この人の情報を共有</button></div>${formInput('名前','name',obj.name)}<div class="two-col">${formInput('所属チーム1','team',obj.team)}${formInput('所属チーム2','team2',obj.team2)}${formInput('所属チーム3','team3',obj.team3)}${formSelect('タイトル','role',obj.role,titleOptions)}${formInput('地域','region',obj.region)}${formSelect('性別','gender',obj.gender,genderOptions)}${formSelect('世代','generation',obj.generation,genOptions)}</div>${formText('メモ','note',otherMemo(obj))}`;
  else html += `<div class="two-col">${formInput('名前','name',obj.name)}${formSelect('メンバー種類','member_type',obj.member_type,typeLabels)}${formInput('紹介者名','introducer_name',obj.introducer_name)}${formInput('地域','region',obj.region)}${formInput('タイトル','title',obj.title)}</div>${progressHtml(obj)}<h4>活動管理</h4>${formInput('約束したこと','promise',obj.promise||obj.activity_promise)}${formInput('次回アクション','next_action',obj.next_action)}${formInput('次回予定日','next_action_date',obj.next_action_date,'date')}${formInput('参加予定イベント','event',obj.event)}${formInput('温度感','temperature',obj.temperature)}${formText('活動メモ','activity_memo',obj.activity_memo||obj.memo)}`;
  $('#editBody').innerHTML=html; $('#editSaveTopBtn').classList.toggle('hidden', !type.includes('pending')); $('#editDialog').showModal();
}
function saveEdit(){const fd=new FormData($('#editForm')); const type=state.edit.type; let obj={}; if(type==='self') obj=state.data.members[state.edit.id]; else if(type==='other') obj=state.data.other_members[state.edit.index]; else if(type==='pending') obj=state.data.pending_self_members[state.edit.index]; else obj={};
  for(const [k,v] of fd.entries()) obj[k]=String(v);
  if(type==='self') setAliases(obj,['activity_note','activity_memo','memo'], obj.activity_note||'');
  if(type.includes('other')) setAliases(obj,['note','memo'], obj.note||'');
  if(type.includes('pending')) setAliases(obj,['activity_memo','memo'], obj.activity_memo||'');
  progressFlags.forEach(([k])=>{obj[k]=!!$('#editBody').querySelector(`[name="${k}"]`)?.checked});
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
function askConfirmDelete(name){
  return new Promise(resolve=>{
    const d=$('#confirmDialog');
    $('#confirmTitle').textContent='削除の確認';
    $('#confirmMessage').textContent=`「${name}」を削除してよろしいですか？`;
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
  if(type==='other'){
    const ok=await askConfirmDelete(editTargetName());
    if(!ok)return;
    state.data.other_members.splice(state.edit.index,1);
  }
  if(type==='pending')state.data.pending_self_members.splice(state.edit.index,1);
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

function showInfo(kind){const help=`<p><strong>使い方</strong></p><ol><li>PC版PMMを閉じます</li><li>保存ファイル読込でPMM保存ファイルを読み込みます</li><li>自メンバー活動管理や他メンバー辞書を編集します</li><li>最後に保存ボタンで保存ファイルを作成します</li><li>PC版PMMで保存したファイルを開きます</li></ol><p>このWeb版はデータをサーバーへ保存しません。読み込んだJSONはブラウザ内で処理します。</p>`;
 const about=`<p><strong>PMM Pocket Web</strong><br>${APP_VERSION}</p><p>PC版PMMで作成したJSONをスマホやPCブラウザで確認・編集する補助ツールです。</p><p>お問い合わせ先：兵藤 茂樹<br>LINE: https://line.me/ti/p/XJt7xbeJ1j</p>`;
 const ios=`<p><strong>iPhoneでホーム画面に追加</strong></p><ol><li>Safariでこのページを開きます</li><li>画面下または上の共有ボタンを押します</li><li><strong>ホーム画面に追加</strong>を選びます</li><li>追加を押すとアプリのように開けます</li></ol><p>Safari以外では表示が違う場合があります。</p>`;
 const android=`<p><strong>Androidでホーム画面に追加</strong></p><ol><li>Chromeでこのページを開きます</li><li>右上の︙メニューを押します</li><li><strong>ホーム画面に追加</strong> または <strong>アプリをインストール</strong> を選びます</li><li>追加を押すとアプリのように開けます</li></ol>`;
 const map={help:['ヘルプ',help],about:['このアプリについて',about],'install-ios':['iPhoneホーム追加',ios],'install-android':['Androidホーム追加',android]};
 const item=map[kind]||map.help; $('#infoTitle').textContent=item[0]; $('#infoBody').innerHTML=item[1]; $('#infoDialog').showModal(); }
function init(){ if(localStorage.getItem('pmmPocketDark')==='1')document.body.classList.add('dark'); const toggleDark=()=>{document.body.classList.toggle('dark');localStorage.setItem('pmmPocketDark',document.body.classList.contains('dark')?'1':'0')}; $$('[data-dark-toggle]').forEach(btn=>btn.onclick=toggleDark);
 ['fileInput','fileInput2'].forEach(id=>{$('#'+id).onchange=e=>{const f=e.target.files[0]; if(!f)return; openFileNotice(f.name); readJsonFile(f); e.target.value='';}});
 $('#newDataBtn').onclick=()=>{state.data=emptyData();state.fileName='pmm_data.json';$('#loadedName').textContent=state.fileName;$('#startView').classList.add('hidden');$('#mainView').classList.remove('hidden');renderAll();markDirty(false)}; $('#saveBtn').onclick=writeJson;
 $$('.bottom-tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
 $('#selfSearch').oninput=renderSelf; $('#otherSearch').oninput=renderOther; const ps=$('#pendingSearch'); if(ps) ps.oninput=renderPending; $('#otherAddBtn').onclick=()=>openEdit('other-new'); const pa=$('#pendingAddBtn'); if(pa) pa.onclick=()=>openEdit('pending-new'); const sa=$('#selfAddBtn'); if(sa) sa.onclick=()=>openEdit('pending-new'); const ss=$('#selfSaveBtn'); if(ss) ss.onclick=writeJson; const os=$('#otherSaveBtn'); if(os) os.onclick=writeJson;
 document.body.addEventListener('click',e=>{const st=e.target.closest('[data-self-edit-tab]'); if(st){const name=st.dataset.selfEditTab; $$('.self-edit-tab').forEach(x=>x.classList.toggle('active',x.dataset.selfEditTab===name)); $$('.self-edit-pane').forEach(x=>x.classList.toggle('active',x.dataset.selfEditPane===name)); return;} const u=e.target.closest('[data-update-app]'); if(u) forceUpdateApp(); const p=e.target.closest('[data-preview]'); if(p) preview(p.dataset.preview, p); const s=e.target.closest('[data-edit-self]'); if(s)openEdit('self',s.dataset.editSelf); const sh=e.target.closest('[data-share-other]'); if(sh){shareOther(sh.dataset.shareOther); return;} const o=e.target.closest('[data-edit-other]'); if(o)openEdit('other',o.dataset.editOther); const pn=e.target.closest('[data-edit-pending]'); if(pn)openEdit('pending',pn.dataset.editPending); const j=e.target.closest('[data-tab-jump]'); if(j)switchTab(j.dataset.tabJump); const l=e.target.closest('[data-dialog]'); if(l)showInfo(l.dataset.dialog);});
 $('#closeEditBtn').onclick=()=>$('#editDialog').close(); document.addEventListener('click',e=>{if(e.target?.id==='otherShareBtn' && state.edit.type?.includes('other')) shareOther(state.edit.index);}); $('#editSaveBtn').onclick=saveEdit; $('#editSaveTopBtn').onclick=saveEdit; $('#deleteBtn').onclick=deleteEdit; $('#closeInfoBtn').onclick=()=>$('#infoDialog').close(); $('#saveCloseBtn').onclick=()=>$('#saveDialog').close(); $('#saveSameBtn').onclick=()=>{downloadJsonAs(state.fileName); $('#saveDialog').close();}; $('#saveRenameBtn').onclick=()=>{$('#saveRenameBox').classList.remove('hidden'); $('#saveFileNameInput').focus();}; $('#saveWithNameBtn').onclick=()=>{downloadJsonAs($('#saveFileNameInput').value); $('#saveDialog').close();}; $('#closePreviewBtn').onclick=()=>$('#previewDialog').close(); $('#previewMemoSaveBtn').onclick=savePreviewMemo;
 document.addEventListener('click',e=>{ if(e.target?.id==='photoEditBtn')openPhoto(); if(e.target?.id==='photoRemoveBtn'){setCurrentPhoto(''); $('#editDialog').close(); toast('写真を削除しました。最後に保存してください')}});
 $('#closePhotoBtn').onclick=()=>$('#photoDialog').close(); $('#photoFileInput').onchange=e=>loadCropFile(e.target.files[0]); $('#photoCameraInput').onchange=e=>loadCropFile(e.target.files[0]); $('#rotatePhotoBtn').onclick=()=>{state.crop.rotation=(state.crop.rotation+90)%360;drawCrop()}; $('#clearPhotoBtn').onclick=()=>{setCurrentPhoto('');$('#photoDialog').close();$('#editDialog').close();toast('写真を削除しました。最後に保存してください')}; $('#applyPhotoBtn').onclick=applyPhoto; $('#zoomRange').oninput=e=>{state.crop.scale=Number(e.target.value);drawCrop()};
 const cw=$('.crop-wrap'); cw.addEventListener('pointerdown',e=>{state.crop.drag=true;state.crop.lastX=e.clientX;state.crop.lastY=e.clientY;cw.setPointerCapture(e.pointerId)}); cw.addEventListener('pointermove',e=>{if(!state.crop.drag)return;state.crop.dx+=e.clientX-state.crop.lastX;state.crop.dy+=e.clientY-state.crop.lastY;state.crop.lastX=e.clientX;state.crop.lastY=e.clientY;drawCrop()}); cw.addEventListener('pointerup',()=>state.crop.drag=false);
 if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=015').then(r=>r.update()).catch(()=>{})}
}
document.addEventListener('DOMContentLoaded',init);
