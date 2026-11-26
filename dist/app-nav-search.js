(() => {
  const input = document.getElementById('nav-search-input');
  const status = document.getElementById('nav-search-status');
  const sidebar = document.getElementById('sidebar');
  const items = [...sidebar.querySelectorAll('.nav-item')];
  const groups = [...sidebar.querySelectorAll('.nav-list')];
  const previewItem = items.find(item => item.dataset.page === 'uipreview');
  const previewResults = [];
  const dataResults = [];
  let eventIndex = [];
  const screenAliases = {
    'lock-base': 'base lock khóa nhà khóa base lock token',
    'permanent-event': 'đào câu cá fishing digging',
    collection: 'bộ sưu tập thú cưng',
    storage: 'kho lưu trữ'
  };
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const aliases = {
    overview: 'tổng quan', progression: 'tiến trình tái sinh rebirth',
    economy: 'kinh tế cân bằng danh sách pet', cadence: 'nhịp thế giới thời tiết sự kiện',
    spawn: 'sinh pet', config: 'cấu hình dữ liệu', changes: 'thay đổi gần đây',
    rewardid: 'quà phần thưởng mã id', shop: 'cửa hàng', missions: 'nhiệm vụ',
    chase: 'bảo đảm bảo hiểm pity chase', pools: 'bể pool phần thưởng',
    weatherdrop: 'thời tiết', luckybox: 'hộp may mắn',
    uipreview: 'xem trước giao diện', uiproposal: 'đề xuất giao diện',
    uicomponents: 'thành phần giao diện',
    revival: 'quay lại phần thưởng đăng nhập', snowball: 'winterland lăn cầu tuyết',
    fishing: 'câu cá gen'
  };
  function filter() {
    const words = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    let count = 0;
    for (const item of [...items, ...previewResults]) {
      const screen = item.dataset.previewScreen;
      if (screen) {
        const text = normalize(`UI Preview ${item.textContent} ${screen} ${screenAliases[screen] || ''}`);
        item.hidden = !words.length || !words.every(word => text.includes(word));
        if (!item.hidden) count++;
        continue;
      }
      const text = normalize(item.textContent + ' ' + item.dataset.page + ' ' + (aliases[item.dataset.page] || ''));
      item.hidden = !words.every(word => text.includes(word));
      if (!item.hidden) count++;
    }
    dataResults.splice(0).forEach(result => result.remove());
    const matches = words.length ? eventIndex.filter(entry => words.every(word => entry.search.includes(word))) : [];
    for (const entry of matches.slice(0, 8)) {
      const result = document.createElement('button');
      result.type = 'button';
      result.className = 'nav-item';
      result.textContent = entry.label;
      result.addEventListener('click', () => {
        if (!s.data) return;
        history.replaceState(null, '', entry.hash);
        go(entry.page);
        document.getElementById('content').focus({ preventScroll: true });
      });
      const parent = items.find(item => item.dataset.page === entry.page);
      parent.parentElement.append(result);
      dataResults.push(result);
      count++;
    }
    for (const group of groups) {
      group.hidden = ![...group.querySelectorAll('.nav-item')].some(item => !item.hidden);
      if (group.previousElementSibling?.classList.contains('nav-label')) group.previousElementSibling.hidden = group.hidden;
    }
    status.textContent = words.length ? (count ? `${count} đề mục · Enter để mở` : 'Không tìm thấy đề mục phù hợp.') : '';
  }
  loadEventDesign().then(data => {
    eventIndex = Object.entries(data).flatMap(([page, sources]) => sources.flatMap(source =>
      source.sections.flatMap(section => {
        const anchor = eventTableAnchor(source, section);
        return section.rows.map((row, index) => ({
          page,
          hash: '#' + page + '/' + anchor + '-' + (index + 1),
          label: pages[page] + ' / ' + section.title + ' / ' + row.slice(0, 2).filter(Boolean).join(' · '),
          search: normalize([pages[page], source.tab, section.title, ...row].join(' '))
        }));
      })
    ));
    filter();
  }).catch(error => console.warn('Could not load event search entries', error));
  fetchUiResource('./data/ui/registry.json').then(checkUiJson).then(registry => {
    let previous = previewItem;
    for (const screen of registry.screens.filter(screen => screen.status === 'ready')) {
      const result = document.createElement('button');
      result.type = 'button';
      result.className = 'nav-item';
      result.dataset.previewScreen = screen.id;
      result.textContent = `↳ ${screen.name}`;
      result.addEventListener('click', () => {
        if (!s.data) return;
        history.replaceState(null, '', `#uipreview/${encodeURIComponent(screen.id)}`);
        go('uipreview');
        document.getElementById('content').focus();
      });
      previous.after(result);
      previous = result;
      previewResults.push(result);
    }
    filter();
  }).catch(error => console.warn('Could not load UI Preview search entries', error));
  input.addEventListener('input', filter);
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      input.value = ''; filter();
    }
    if (event.key === 'Enter') {
      const first = items.find(item => !item.hidden) || previewResults.find(item => !item.hidden) || dataResults[0];
      if (!first || !s.data) return;
      event.preventDefault();
      first.click();
      document.getElementById('content').focus();
    }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); sidebar.classList.add('open'); input.focus(); input.select();
    }
  });
})();
