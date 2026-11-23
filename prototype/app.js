/*
 * UI прототипа. Логика конвертера живёт в converter.js и ничего не знает про DOM.
 */
(function () {
  "use strict";

  var C = window.NaborschikConverter;
  var $ = function (id) { return document.getElementById(id); };

  var input = $("input");
  var stats = $("stats");
  var notice = $("notice");
  var blocksPanel = $("panel-blocks");
  var payloadEl = $("payload");
  var checksPanel = $("panel-checks");
  var checksSummary = $("checks-summary");
  var countBadge = $("count-badge");
  var copyButton = $("copy");
  var fileInput = $("file");
  var toastEl = $("toast");

  var state = { blocks: [], payload: "", tab: "blocks" };

  var SAMPLE = [
    "---",
    "title: Пример статьи",
    "vc: https://vc.ru/0000000",
    "---",
    "# Заголовок статьи в буфер не входит",
    "",
    "![[BLG016_top.jpg|800]]",
    "",
    "## Глава 1",
    "",
    "Абзац с **жирным**, *курсивом*, [ссылкой](https://ya.ru) и `кодом`. Символы & < > остаются текстом.",
    "",
    "> [!note] Важно",
    "> Callout превращается в цитату, маркер убирается, заголовок остаётся жирным.",
    "",
    "- Первый пункт",
    "- Второй пункт",
    "  - Вложенный пункт станет плоским с отступом",
    "- [x] Готово",
    "- [ ] Не готово",
    "",
    "1. Первый",
    "2. Второй",
    "",
    "> Обычная цитата.",
    "",
    "---",
    "",
    "### Раздел",
    "",
    "| Колонка | Значение |",
    "|---|---|",
    "| A | 1 |",
    "| B | 2 |",
    "",
    "~~~js",
    "const x = 1;",
    "const y = 2;",
    "~~~",
    "",
    "Ссылка на заметку: [[Папка/Заметка|алиас]]."
  ].join("\n");

  var CASES = [
    {
      n: 1,
      name: "Один абзац",
      input: "Просто абзац.",
      expect: "один текстовый блок, одиночный блок уходит текстом",
      check: function (blocks, payload) {
        return blocks.length === 1 && blocks[0].type === "text" && payload === "Просто абзац.";
      }
    },
    {
      n: 2,
      name: "H2 и H3",
      input: "## Глава\n\n### Раздел",
      expect: "два header, h2 и h3",
      check: function (blocks) {
        return blocks.length === 2 &&
          blocks[0].type === "header" && blocks[0].style === "h2" &&
          blocks[1].type === "header" && blocks[1].style === "h3";
      }
    },
    {
      n: 3,
      name: "H4",
      input: "#### Мелкий",
      expect: "текстовый блок, весь жирный",
      check: function (blocks) {
        return blocks.length === 1 && blocks[0].type === "text" && blocks[0].html.indexOf("<b>Мелкий</b>") !== -1;
      }
    },
    {
      n: 4,
      name: "Жирный, курсив, ссылка",
      input: "Абзац с **жирным**, *курсивом* и [ссылкой](https://ya.ru).",
      expect: "b, i и a на месте",
      check: function (blocks) {
        var html = blocks[0] ? blocks[0].html : "";
        return html.indexOf("<b>жирным</b>") !== -1 &&
          html.indexOf("<i>курсивом</i>") !== -1 &&
          html.indexOf('<a href="https://ya.ru">ссылкой</a>') !== -1;
      }
    },
    {
      n: 5,
      name: "Спецсимволы",
      input: "Символы & < >",
      expect: "символы видны, теги не создаются",
      check: function (blocks) {
        var html = blocks[0] ? blocks[0].html : "";
        return html.indexOf("&amp;") !== -1 && html.indexOf("&lt;") !== -1 && html.indexOf("&gt;") !== -1;
      }
    },
    {
      n: 6,
      name: "Список UL",
      input: "- Раз\n- Два",
      expect: "list UL из двух пунктов",
      check: function (blocks) {
        return blocks[0] && blocks[0].type === "list" && blocks[0].listType === "UL" && blocks[0].items.length === 2;
      }
    },
    {
      n: 7,
      name: "Список OL",
      input: "1. Раз\n2. Два",
      expect: "list OL",
      check: function (blocks) {
        return blocks[0] && blocks[0].type === "list" && blocks[0].listType === "OL";
      }
    },
    {
      n: 8,
      name: "Вложенный список",
      input: "- Раз\n  - Вложенный\n- Два",
      expect: "плоский list, вложенный пункт с маркером ↳",
      check: function (blocks) {
        return blocks[0] && blocks[0].type === "list" && blocks[0].items.length === 3 &&
          blocks[0].items.some(function (item) { return item.indexOf("↳ Вложенный") !== -1; });
      }
    },
    {
      n: 9,
      name: "Цитата",
      input: "> Цитата",
      expect: "quote",
      check: function (blocks) {
        return blocks[0] && blocks[0].type === "quote" && blocks[0].html.indexOf("Цитата") !== -1;
      }
    },
    {
      n: 10,
      name: "Callout",
      input: "> [!note] Заголовок\n> Текст",
      expect: "quote без маркера, заголовок жирным",
      check: function (blocks) {
        var html = blocks[0] ? blocks[0].html : "";
        return blocks[0] && blocks[0].type === "quote" &&
          html.indexOf("<b>Заголовок</b>") !== -1 && html.indexOf("[!note]") === -1;
      }
    },
    {
      n: 11,
      name: "Разделитель",
      input: "---",
      expect: "delimiter",
      check: function (blocks) {
        return blocks[0] && blocks[0].type === "delimiter";
      }
    },
    {
      n: 12,
      name: "Картинка как текст",
      input: "![[file.jpg|800]]",
      expect: "текстовый блок, строка как есть",
      check: function (blocks, payload) {
        return blocks.length === 1 && blocks[0].type === "text" && payload === "![[file.jpg|800]]";
      }
    },
    {
      n: 13,
      name: "Блок кода",
      input: "~~~js\nconst x = 1;\n~~~",
      expect: "code-блок с языком javascript",
      check: function (blocks) {
        return blocks.length === 1 && blocks[0].type === "code" &&
          blocks[0].lang === "javascript" && blocks[0].text === "const x = 1;";
      }
    },
    {
      n: 14,
      name: "Таблица как код",
      input: "Текст\n\n| Колонка | Значение |\n|---|---|\n| A | 1 |",
      expect: "code-блок с Markdown-таблицей и lang пустой",
      check: function (blocks, payload) {
        return blocks.length === 2 && blocks[1].type === "code" && blocks[1].lang === "" &&
          blocks[1].text.indexOf("|---|---|") !== -1 && payload.indexOf("[code:") !== -1;
      }
    }
  ];

  function convert() {
    try {
      state.blocks = C.toBlocks(input.value);
      state.payload = C.toVcruPayload(state.blocks);
    } catch (error) {
      state.blocks = [];
      state.payload = "";
      notice.textContent = "Ошибка конвертера: " + error.message;
      notice.hidden = false;
    }
    render();
  }

  function render() {
    var blocks = state.blocks;
    var hasFrontmatter = /^\uFEFF?---\r?\n/.test(input.value);

    countBadge.textContent = String(blocks.length);
    payloadEl.textContent = state.payload;
    copyButton.disabled = !state.payload;

    var mode = blocks.length === 1 ? "plain" : "tool";
    stats.innerHTML = "";
    stats.appendChild(pill(blocks.length + " блоков"));
    stats.appendChild(pill(state.payload.length + " символов"));
    stats.appendChild(pill(mode === "plain" ? "plain: один блок" : "tool: много блоков", mode === "plain" ? "warn" : "ok"));
    if (hasFrontmatter) stats.appendChild(pill("frontmatter вырезан"));

    var messages = [];
    if (blocks.length === 1) {
      messages.push("Один блок уйдёт обычным текстом. vc.ru не создаёт нативный блок из одиночной строки [tool:...]. Если нужен нативный блок, добавь в выделение второй блок.");
    }
    if (blocks.length === 0) {
      messages.push("Блоков нет. Проверь, что вставился Markdown, а не пустой текст.");
    }
    if (hasFrontmatter) {
      messages.push("Frontmatter в начале вырезан: в статью он не попадает.");
    }
    notice.hidden = messages.length === 0;
    notice.textContent = messages.join(" ");

    renderBlocks(blocks);
    setTab(state.tab);
  }

  function pill(text, tone) {
    var span = document.createElement("span");
    span.className = "pill" + (tone ? " pill-" + tone : "");
    span.textContent = text;
    return span;
  }

  function renderBlocks(blocks) {
    blocksPanel.innerHTML = "";

    if (blocks.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Пока пусто. Вставь Markdown слева или нажми «Пример».";
      blocksPanel.appendChild(empty);
      return;
    }

    blocks.forEach(function (block, index) {
      var card = document.createElement("article");
      card.className = "block-card";

      var head = document.createElement("div");
      head.className = "block-head";

      var badge = document.createElement("span");
      badge.className = "badge badge-" + block.type;
      badge.textContent = labelFor(block);
      head.appendChild(badge);

      var number = document.createElement("span");
      number.className = "block-number";
      number.textContent = "#" + (index + 1);
      head.appendChild(number);

      var details = document.createElement("details");
      details.className = "block-json";
      var summary = document.createElement("summary");
      summary.textContent = "payload";
      details.appendChild(summary);
      var pre = document.createElement("pre");
      pre.textContent = JSON.stringify(serialize(block), null, 2);
      details.appendChild(pre);
      head.appendChild(details);

      card.appendChild(head);

      var body = document.createElement("div");
      body.className = "block-body";
      fillPreview(body, block);
      card.appendChild(body);

      blocksPanel.appendChild(card);
    });
  }

  function labelFor(block) {
    if (block.type === "header") return "header " + block.style;
    if (block.type === "list") return "list " + block.listType;
    if (block.type === "code") return block.lang ? "code " + block.lang : "code";
    return block.type;
  }

  function serialize(block) {
    if (block.type === "header") return { text: block.text, style: block.style };
    if (block.type === "text") return { text: block.html };
    if (block.type === "list") return { type: block.listType, items: block.items };
    if (block.type === "quote") return { text: block.html, subline1: block.subline1 || "" };
    if (block.type === "code") return { text: block.text, lang: block.lang || "", lineWrapping: false };
    return { type: "default" };
  }

  function fillPreview(container, block) {
    if (block.type === "text" || block.type === "quote") {
      container.innerHTML = block.html;
      return;
    }
    if (block.type === "header") {
      var heading = document.createElement(block.style === "h3" ? "h3" : "h2");
      heading.textContent = block.text;
      container.appendChild(heading);
      return;
    }
    if (block.type === "list") {
      var list = document.createElement(block.listType === "OL" ? "ol" : "ul");
      block.items.forEach(function (item) {
        var li = document.createElement("li");
        li.innerHTML = item;
        list.appendChild(li);
      });
      container.appendChild(list);
      return;
    }
    if (block.type === "code") {
      var pre = document.createElement("pre");
      pre.className = "code-preview";
      var code = document.createElement("code");
      code.textContent = block.text;
      pre.appendChild(code);
      container.appendChild(pre);
      return;
    }
    if (block.type === "delimiter") {
      container.appendChild(document.createElement("hr"));
    }
  }

  function setTab(name) {
    state.tab = name;
    Array.prototype.forEach.call(document.querySelectorAll("[data-tab]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-tab") === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".panel"), function (panel) {
      panel.classList.toggle("active", panel.id === "panel-" + name);
    });
    if (name === "checks") renderChecks();
  }

  function renderChecks() {
    var passed = 0;
    checksPanel.innerHTML = "";

    CASES.forEach(function (testCase) {
      var result = runCase(testCase);
      if (result.ok) passed += 1;

      var row = document.createElement("div");
      row.className = "check " + (result.ok ? "check-ok" : "check-fail");

      var number = document.createElement("span");
      number.className = "check-number";
      number.textContent = String(testCase.n).padStart(2, "0");
      row.appendChild(number);

      var main = document.createElement("div");
      main.className = "check-main";

      var title = document.createElement("strong");
      title.textContent = testCase.name;
      main.appendChild(title);

      var expectation = document.createElement("div");
      expectation.className = "check-expect";
      expectation.textContent = testCase.expect;
      main.appendChild(expectation);

      var snippet = document.createElement("code");
      snippet.className = "check-input";
      snippet.textContent = testCase.input.replace(/\n/g, "\\n");
      main.appendChild(snippet);

      row.appendChild(main);

      var status = document.createElement("span");
      status.className = "badge " + (result.ok ? "badge-ok" : "badge-fail");
      status.textContent = result.ok ? "ok" : "fail";
      row.appendChild(status);

      var load = document.createElement("button");
      load.type = "button";
      load.className = "ghost small";
      load.textContent = "Вставить";
      load.addEventListener("click", function () {
        input.value = testCase.input;
        convert();
        input.focus();
      });
      row.appendChild(load);

      if (!result.ok) {
        var error = document.createElement("div");
        error.className = "check-error";
        error.textContent = result.error || ("payload: " + result.payload);
        row.appendChild(error);
      }

      checksPanel.appendChild(row);
    });

    checksSummary.textContent = passed + "/" + CASES.length;
    checksSummary.className = "tab-count " + (passed === CASES.length ? "tab-count-ok" : "tab-count-fail");
  }

  function runCase(testCase) {
    try {
      var blocks = C.toBlocks(testCase.input);
      var payload = C.toVcruPayload(blocks);
      return { ok: Boolean(testCase.check(blocks, payload)), payload: payload };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function copyPayload() {
    if (!state.payload) {
      toast("Нечего копировать");
      return;
    }

    var text = state.payload;
    var copied = false;

    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (error) {
      copied = fallbackCopy(text);
    }

    if (copied) {
      var previous = copyButton.textContent;
      copyButton.textContent = "Скопировано";
      toast("В буфере " + text.length + " символов. Вставь в пустой текстовый блок vc.ru.");
      window.setTimeout(function () {
        copyButton.textContent = previous;
      }, 1600);
    } else {
      payloadEl.textContent = text;
      setTab("payload");
      toast("Не удалось скопировать автоматически. Текст открыт во вкладке Payload.");
    }
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  var toastTimer = null;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("visible");
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove("visible");
    }, 3200);
  }

  document.addEventListener("click", function (event) {
    var tab = event.target.closest ? event.target.closest("[data-tab]") : null;
    if (tab) setTab(tab.getAttribute("data-tab"));
  });

  input.addEventListener("input", convert);
  copyButton.addEventListener("click", copyPayload);

  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      copyPayload();
    }
  });

  $("load-sample").addEventListener("click", function () {
    input.value = SAMPLE;
    convert();
  });

  $("clear").addEventListener("click", function () {
    input.value = "";
    convert();
    input.focus();
  });

  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;

    file.text().then(function (text) {
      input.value = text;
      convert();
      toast("Загружено: " + file.name);
    }).catch(function () {
      toast("Не удалось прочитать файл");
    });
  });

  input.value = SAMPLE;
  renderChecks();
  convert();
})();
