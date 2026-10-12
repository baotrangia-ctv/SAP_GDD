function configRows(){
  const file=s.data.tables.find(x=>x.path===s.configFile)||s.data.tables.find(x=>!x.missing)||{rows:[],headers:[],path:""};
  const q=s.configSearch.trim().toLowerCase();
  const rows=file.rows.filter(r=>!q||Object.values(r).join(" ").toLowerCase().includes(q));
  const end=Math.min(s.offset+100,rows.length);
  const body=rows.slice(s.offset,end).map(r=>"<tr>"+file.headers.map(k=>{const v=r[k]||"";return'<td title="'+esc(v)+'">'+esc(v.length>90?v.slice(0,88)+"…":v)+"</td>"}).join("")+"</tr>").join("");
  return{file,rows,end,body};
}
function configPage(){
  const files=s.data.tables.filter(x=>!x.missing);
  if(!s.configFile||!files.some(x=>x.path===s.configFile))s.configFile=files[0]?.path||"";
  const x=configRows(),f=x.file;
  return head("SOURCE BROWSER","Config explorer","Tìm trong bảng CSV được mirror từ checkout. Giữ nguyên tên cột, raw value, source path và checksum; trang không ghi ngược vào game config.",pill("44 tables")+pill("Read-only mirror","amber"))+
    '<section class="panel"><div class="filterbar"><div class="search-wrap"><input id="config-search" type="search" value="'+esc(s.configSearch)+'" placeholder="Tìm trong config…" aria-label="Tìm config"></div><select id="config-file" aria-label="Chọn bảng">'+files.map(a=>'<option value="'+esc(a.path)+'"'+(s.configFile===a.path?" selected":"")+'>'+esc(a.path.replace("Assets/CSV/",""))+" · "+a.rowCount+"</option>").join("")+'</select><span class="small-count">'+esc(f.rowCount)+" rows</span></div>"+
    '<div class="table-wrap data-table-view"><table><thead><tr>'+f.headers.map(h=>"<th>"+esc(h)+"</th>").join("")+'</tr></thead><tbody id="config-rows">'+(x.body||'<tr><td class="empty" colspan="'+Math.max(1,f.headers.length)+'">Không có dòng khớp.</td></tr>')+"</tbody></table></div>"+
    '<div class="table-foot"><span id="config-count">Rows '+(x.rows.length? s.offset+1:0)+"–"+x.end+" / "+x.rows.length+" · "+esc(f.path)+'</span><span><button class="panel-link" data-action="prev" id="config-prev">← Trước</button> <button class="panel-link" data-action="next" id="config-next">Tiếp →</button></span></div>'+
    '<div class="table-foot"><span>SHA-256 · '+esc(f.sha256||"—")+"</span><span>"+esc(f.bytes||0)+" bytes</span></div></section>"+
    '<section class="section-grid equal" style="margin-top:14px">'+panel("Data scope","Các bảng balance/progression được sync",'<p class="inline-note">Bao gồm pet, mutation, rebirth, daily activity, reward, weather, shop và event pools.</p>')+panel("Đã loại khỏi site","Dữ liệu vận hành ngoài phạm vi GDD",'<div class="pill-list">'+s.data.excludedSources.map(x=>'<span class="soft-pill">'+esc(x.path)+"</span>").join("")+'</div><p class="inline-note">Google Sheets không đọc được bằng connector hiện có; bản này lấy từ checkout CSV/code.</p>')+"</section>";
}
function changesPage(){
  const cs=s.data.recentCommits||[];
  const summary=c=>{const p=c.files||[];if(p.some(x=>x.includes("TrackingManager.fcg")))return"Ngừng gọi global milestone tracking, bỏ pet IDs 117–119 khỏi danh sách tracking, đổi mốc first-log cho onboarding/purchase tracking.";if(p.some(x=>x.includes("ResourceRegisteration.asset")))return"Dọn bốn icon, thay asset Kakapo/Rainbow và cập nhật resource registration; không thấy thay đổi bảng balance.";if(p.some(x=>x.includes("HudDebug.fcg")))return"Thêm debug skip revival mission và sampling rate Lucky Box / Pet Parade; thêm daily modifier vào parade weights; reset protection khi reconnect/disconnect/teleport.";return"Các file thay đổi được liệt kê bên dưới."};
  return head("CHANGE REVIEW","Ba commit mới nhất","Tóm tắt diff trong checkout để cho biết config và tooling nào vừa đổi. Commit mới không đồng nghĩa balance proposal đã được phê duyệt.",pill("Branch "+s.data.sourceBranch)+pill("As of "+String(s.data.sourceCommit).slice(0,8)))+
    '<section class="section-grid equal">'+panel("Telemetry boundary","Điều code mới nhất cho phép kết luận",note("Không suy ra retention từ tracking code","Commit mới nhất comment lời gọi TrackingGlobalMilestones và thay đổi pet IDs được track. Đây là thay đổi luồng telemetry; snapshot không có analytics export hoặc survival-time data.","TrackingManager.fcg · "+(cs[0]?.shortHash||""),"info"))+panel("Review flags","Tự dựng từ bảng config và runtime code",findings()||'<div class="inline-note">Không có review flags.</div>')+"</section>"+
    '<div class="commit-list">'+cs.map(c=>'<article class="commit-card"><div class="commit-top"><div><div class="commit-title">'+esc(c.subject)+'</div><div class="commit-date">'+esc(c.date)+" · "+(c.files||[]).length+' files</div></div><span class="commit-hash">'+esc(c.shortHash)+"</span></div><p class=\"commit-summary\">"+esc(summary(c))+'</p><div class="path-list">'+(c.files||[]).map(p=>'<span class="path-chip">'+esc(p)+"</span>").join("")+"</div></article>").join("")+"</div>";
}
function petDetail(id){
  const row=table("Pet.csv").rows.find(x=>x.ID===String(id));if(!row)return;
  const box=document.createElement("div");box.className="modal-backdrop";box.id="pet-modal";
  box.innerHTML='<section class="modal" role="dialog" aria-modal="true" aria-label="Pet config"><button class="modal-close" data-action="close">Đóng</button><p class="eyebrow">PET CONFIG · ID '+esc(row.ID)+'</p><div class="pet-detail-title">'+petImageHtml(row,'pet-portrait')+'<div><h2>'+esc(row.Name)+'</h2>'+rarity(row.Rarity)+'</div></div><dl>'+Object.keys(row).map(k=>"<dt>"+esc(k)+"</dt><dd>"+esc(row[k]||"—")+"</dd>").join("")+"</dl></section>";
  document.body.appendChild(box);
}
function go(page){if(!pages[page])return;s.page=page;document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));document.getElementById("sidebar").classList.remove("open");root.innerHTML=({overview:overview,progression:progression,economy:economy,cadence:cadence,spawn:spawnPage,config:configPage,changes:changesPage,mutagen:mutagenPage,weatherdrop:weatherDropPage,luckybox:luckyBoxPage}[page])();updateMeta();if(page==="config")updateConfig();if(page==="spawn")updateSpawnAnalysis();if(page==="mutagen")updateMutagenPage();if(page==="weatherdrop")updateWeatherDropPage();if(page==="luckybox")updateLuckyBoxPage()}
function updateConfig(){
  const x=configRows(),b=document.getElementById("config-rows");if(!b)return;
  b.innerHTML=x.body||'<tr><td class="empty" colspan="'+Math.max(1,x.file.headers.length)+'">Không có dòng khớp.</td></tr>';
  document.getElementById("config-count").textContent="Rows "+(x.rows.length?s.offset+1:0)+"–"+x.end+" / "+x.rows.length+" · "+x.file.path;
  document.getElementById("config-prev").disabled=s.offset<=0;document.getElementById("config-next").disabled=x.end>=x.rows.length;
}
document.addEventListener("click",e=>{
  const nav=e.target.closest("[data-page]");if(nav){e.preventDefault();go(nav.dataset.page);return}
  const act=e.target.closest("[data-action]");if(act){if(act.dataset.action==="close")document.getElementById("pet-modal")?.remove();if(act.dataset.action==="prev"){s.offset=Math.max(0,s.offset-100);updateConfig()}if(act.dataset.action==="next"){s.offset+=100;updateConfig()}}
  const pet=e.target.closest("[data-pet]");if(pet)petDetail(pet.dataset.pet);
  if(e.target.classList.contains("modal-backdrop"))e.target.remove();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.getElementById("pet-modal")?.remove();const r=e.target.closest?.("[data-pet]");if(r&&(e.key==="Enter"||e.key===" ")){e.preventDefault();petDetail(r.dataset.pet)}});
document.addEventListener("input",e=>{if(e.target.id==="pet-search"){s.petSearch=e.target.value;updatePetRows()}if(e.target.id==="config-search"){s.configSearch=e.target.value;s.offset=0;updateConfig()}});
document.addEventListener("change",e=>{
  if(e.target.id==="pet-rarity"){s.rarity=e.target.value;updatePetRows()}
  if(e.target.id==="pet-sort"){s.sort=e.target.value;updatePetRows()}
  if(e.target.id==="config-file"){s.configFile=e.target.value;s.offset=0;go("config")}
  if(e.target.id==="rb-metric"){s.metric=e.target.value;go("progression")}
  if(e.target.id==="day-select"){s.day=Number(e.target.value);go("cadence")}
});
document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
fetch("./data/config-snapshot.json").then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json()}).then(d=>{s.data=d;go("overview")}).catch(err=>{root.innerHTML=note("Không đọc được snapshot",err.message+" · Chạy tools/sync-source-data.mjs rồi serve dist qua HTTP.","","review")});
