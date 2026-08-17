console.log('插件 content.js 加载成功');

window.addEventListener('message', (event) => {
  console.log('message 事件触发', event.data);
  if (event.data.action === 'publish HRM resume') {
    chrome.runtime.sendMessage(event.data);
  }
});
