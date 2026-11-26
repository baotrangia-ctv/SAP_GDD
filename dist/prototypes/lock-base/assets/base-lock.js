(() => {
 'use strict';
 const pane = document.getElementById('tab-base-lock');
 pane.innerHTML = `<section class="bl-dialog" aria-labelledby="bl-dialog-title" aria-describedby="bl-dialog-copy"><h2 class="bl-title" id="bl-dialog-title">KHÓA BASE</h2><div class="bl-dialog-body"><div class="bl-token-wallet"><img src="assets/base-lock/lock.png" alt=""><div><strong>Lock Token</strong><small>Có <b class="bl-token-stock"></b> token · 1 token = <span class="bl-token-seconds"></span> giây</small></div></div>
 <div class="bl-token-layout">
 <div class="bl-token-preview" id="bl-dialog-copy"><img src="assets/base-lock/lock.png" alt=""><div><span>Thời gian còn lại</span><div class="bl-time-row"><strong class="bl-current-time">00:00</strong><output class="bl-time-added" aria-label="Thời gian cộng thêm" hidden></output></div></div></div>
 <div class="bl-token-picker" role="group" aria-label="Số Lock Token muốn nạp">
 <input class="bl-token-range" type="range" min="0" max="24" step="1" value="0" aria-label="Số token muốn nạp" aria-orientation="vertical">
 <div class="bl-token-controls"><button class="bl-max">Tối đa</button><button class="bl-plus" aria-label="Tăng 1 token">▲</button><div class="bl-token-amount"><img src="assets/base-lock/lock.png" alt=""><output class="bl-quantity" aria-label="Token đã chọn">0 / 24</output></div><button class="bl-minus" aria-label="Giảm 1 token">▼</button><button class="bl-clear-selection">Đặt lại</button></div></div></div>
 <p class="bl-token-note">Token đã nạp sẽ được tiêu hao và không thể lấy lại.</p>
 <div class="bl-actions bl-token-actions"><button class="bl-use">NẠP TOKEN</button></div>
 <p class="bl-token-feedback" role="status"></p></div></section>`;

 const q = selector => pane.querySelector(selector);
 const SECONDS_PER_TOKEN = 30;
 let inventory = 24;
 let quantity = 0;
 let expires = 0;
 q('.bl-token-seconds').textContent = SECONDS_PER_TOKEN;

 function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
 }

 function updateTimer() {
  const seconds = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
  q('.bl-current-time').textContent = formatTime(seconds);
 }

 function render() {
  q('.bl-token-stock').textContent = inventory;
  q('.bl-quantity').textContent = `${quantity} / ${inventory}`;
  const timeAdded = q('.bl-time-added');
  timeAdded.hidden = quantity === 0;
  timeAdded.textContent = quantity ? `+${formatTime(quantity * SECONDS_PER_TOKEN)}` : '';
  const range = q('.bl-token-range');
  range.max = inventory;
  range.value = quantity;
  range.disabled = inventory === 0;
  range.style.setProperty('--bl-token-fill', `${inventory ? quantity / inventory * 100 : 0}%`);
  q('.bl-clear-selection').disabled = quantity === 0;
  q('.bl-minus').disabled = quantity === 0;
  q('.bl-plus').disabled = quantity >= inventory;
  q('.bl-max').disabled = quantity >= inventory;
  q('.bl-use').disabled = quantity === 0 || quantity > inventory;
  q('.bl-use').textContent = inventory === 0 ? 'HẾT TOKEN' : quantity ? `NẠP ${quantity} TOKEN` : 'NẠP TOKEN';
  updateTimer();
 }

 function chooseQuantity(amount) {
  quantity = Math.max(0, Math.min(inventory, amount));
  render();
 }

 q('.bl-token-range').addEventListener('input', event => chooseQuantity(Number(event.target.value)));
 q('.bl-plus').addEventListener('click', () => chooseQuantity(quantity + 1));
 q('.bl-minus').addEventListener('click', () => chooseQuantity(quantity - 1));
 q('.bl-max').addEventListener('click', () => chooseQuantity(inventory));
 q('.bl-clear-selection').addEventListener('click', () => chooseQuantity(0));
 q('.bl-use').addEventListener('click', () => {
  if (!quantity || quantity > inventory) return;
  const added = quantity * SECONDS_PER_TOKEN;
  expires = Math.max(Date.now(), expires) + added * 1000;
  inventory -= quantity;
  q('.bl-token-feedback').textContent = `Đã nạp ${quantity} token · +${formatTime(added)} bảo vệ`;
  chooseQuantity(0);
 });

 render();
 setInterval(updateTimer, 250);
})();
