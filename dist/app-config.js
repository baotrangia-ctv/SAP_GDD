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
