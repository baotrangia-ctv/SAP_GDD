function petDetail(id){
  const row=table("Pet.csv").rows.find(x=>x.ID===String(id));if(!row)return;
  const box=document.createElement("div");box.className="modal-backdrop";box.id="pet-modal";
  box.innerHTML='<section class="modal" role="dialog" aria-modal="true" aria-label="Pet config"><button class="modal-close" data-action="close">Đóng</button><p class="eyebrow">PET CONFIG · ID '+esc(row.ID)+'</p><div class="pet-detail-title">'+petImageHtml(row,'pet-portrait')+'<div><h2>'+esc(row.Name)+'</h2>'+rarity(row.Rarity)+'</div></div><dl>'+Object.keys(row).map(k=>"<dt>"+esc(k)+"</dt><dd>"+esc(row[k]||"—")+"</dd>").join("")+"</dl></section>";
  document.body.appendChild(box);
}
function go(page){if(!pages[page])return;s.page=page;document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));document.getElementById("sidebar").classList.remove("open");root.innerHTML=({overview:overview,progression:progression,economy:economy,cadence:cadence,spawn:spawnPage,config:configPage,changes:changesPage,mutagen:mutagenPage,weatherdrop:weatherDropPage,luckybox:luckyBoxPage,shop:shopPage,missions:missionsPage,pools:poolsPage}[page])();updateMeta();if(page==="config")updateConfig();if(page==="spawn")updateSpawnAnalysis();if(page==="mutagen")updateMutagenPage();if(page==="weatherdrop")updateWeatherDropPage();if(page==="luckybox")updateLuckyBoxPage();if(page==="shop")updateShopPage();if(page==="missions")updateMissionsPage();if(page==="pools")updatePoolsPage()}
async function updateConfig(){
  const file=s.data.tables.find(x=>x.path===s.configFile)||s.data.tables.find(x=>!x.missing);
  const b=document.getElementById("config-rows");if(!b||!file)return;
  if(file.file&&!s.configTableCache?.[file.path]){
    b.innerHTML='<tr><td class="empty" colspan="'+Math.max(1,file.headers.length)+'">Đang tải bảng tách riêng…</td></tr>';
    try{
      const response=await fetch("./data/"+file.file);if(!response.ok)throw new Error("HTTP "+response.status);
      const tableData=await response.json();if(s.page!=="config"||s.configFile!==file.path)return;
      s.configTableCache=s.configTableCache||Object.create(null);s.configTableCache[file.path]=tableData.rows||[];
    }catch(error){b.innerHTML='<tr><td class="empty" colspan="'+Math.max(1,file.headers.length)+'">Không tải được bảng: '+esc(error.message)+"</td></tr>";return}
  }
  const x=configRows();
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
