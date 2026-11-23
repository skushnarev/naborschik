
```js
// ==UserScript==
// @name         vc.ru Windows CRLF Paste Fix
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Чинит вставку блоков в редакторе vc.ru на Windows (заменяет \r\n на \n)
// @match        https://vc.ru/*
// @match        https://dtf.ru/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  document.addEventListener('paste', (e) => {
    if (!e.isTrusted) return;
    const plain = e.clipboardData?.getData('text/plain');
    if (!plain || !plain.includes('\r')) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const dt = new DataTransfer();
    dt.setData('text/plain', plain.replace(/\r\n?/g, '\n'));
    const html = e.clipboardData.getData('text/html');
    if (html) dt.setData('text/html', html);

    e.target.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    }));
  }, true);
})();
```
