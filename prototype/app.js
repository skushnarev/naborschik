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
  var hintEl = $("hint");

  var TEST_IMAGES = window.NABORSCHIK_TEST_IMAGES || {};

  var state = {
    blocks: [],
    outputs: { vc: "", dzen: "", smartlab: "" },
    platform: "vc",
    tab: "blocks",
    error: ""
  };

  var SAMPLE = [
    "---",
    "title: Пример статьи",
    "vc: https://vc.ru/0000000",
    "---",
    "# Заголовок статьи в буфер не входит",
    "",
    "![[BLG016_top.jpg|800]]",
    "",
    "![[star.png|64]]",
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
        return blocks.length === 2 && blocks[1].type === "table" &&
          blocks[1].raw.indexOf("|---|---|") !== -1 && payload.indexOf("[code:") !== -1;
      }
    },
    {
      n: 15,
      name: "Дзен: H2 и H3",
      input: "## Глава\n\n### Раздел",
      expect: "h2 и h3",
      check: function (blocks, payload, outputs) {
        return outputs.dzen === "<h2>Глава</h2>\n<h3>Раздел</h3>";
      }
    },
    {
      n: 16,
      name: "Дзен: код в цитате",
      input: "~~~js\nconst x = 1;\n~~~",
      expect: "blockquote без pre",
      check: function (blocks, payload, outputs) {
        return outputs.dzen.indexOf("<blockquote><p>const x = 1;</p></blockquote>") !== -1 &&
          outputs.dzen.indexOf("<pre") === -1;
      }
    },
    {
      n: 17,
      name: "Дзен: таблица списком",
      input: "| Колонка | Значение |\n|---|---|\n| A | 1 |",
      expect: "ul с парами заголовок: значение",
      check: function (blocks, payload, outputs) {
        return outputs.dzen.indexOf("<ul>") !== -1 &&
          outputs.dzen.indexOf("<b>Колонка:</b> A") !== -1 &&
          outputs.dzen.indexOf("<table") === -1;
      }
    },
    {
      n: 18,
      name: "Дзен: разделитель",
      input: "---",
      expect: "абзац * * *",
      check: function (blocks, payload, outputs) {
        return outputs.dzen === "<p>* * *</p>";
      }
    },
    {
      n: 19,
      name: "Смартлаб: код",
      input: "~~~js\nconst x = 1;\n~~~",
      expect: "pre без code",
      check: function (blocks, payload, outputs) {
        return outputs.smartlab === "<pre>const x = 1;</pre>" &&
          outputs.smartlab.indexOf("<code>") === -1;
      }
    },
    {
      n: 20,
      name: "Смартлаб: таблица",
      input: "| A | B |\n|---|---|\n| 1 | 2 |",
      expect: "table с thead и tbody",
      check: function (blocks, payload, outputs) {
        return outputs.smartlab.indexOf("<table>") === 0 &&
          outputs.smartlab.indexOf("<thead>") !== -1 &&
          outputs.smartlab.indexOf("<tbody>") !== -1 &&
          outputs.smartlab.indexOf("<th>A</th>") !== -1;
      }
    },
    {
      n: 21,
      name: "Смартлаб: разделитель",
      input: "---",
      expect: "hr",
      check: function (blocks, payload, outputs) {
        return outputs.smartlab === "<hr>";
      }
    },
    {
      n: 22,
      name: "Смартлаб: заголовки",
      input: "## Глава\n\n### Раздел",
      expect: "h2 в h3, h3 в h4, без каскада",
      check: function (blocks, payload, outputs) {
        return outputs.smartlab === "<h3>Глава</h3>\n<h4>Раздел</h4>" &&
          outputs.smartlab.indexOf("<h2>") === -1;
      }
    },
    {
      n: 23,
      name: "HTML: экранирование",
      input: "~~~\n<script>alert(1)</script>\n~~~",
      expect: "теги кода экранированы в обоих выходах",
      check: function (blocks, payload, outputs) {
        return outputs.dzen.indexOf("<script>") === -1 &&
          outputs.smartlab.indexOf("<script>") === -1 &&
          outputs.dzen.indexOf("&lt;script&gt;") !== -1 &&
          outputs.smartlab.indexOf("&lt;script&gt;") !== -1;
      }
    },
    {
      n: 24,
      name: "Вики-ссылка как текст",
      input: "См. [[Папка/Заметка|алиас]].",
      expect: "ссылка остаётся целиком во всех выходах",
      check: function (blocks, payload, outputs) {
        var link = "[[Папка/Заметка|алиас]]";
        return payload.indexOf(link) !== -1 &&
          outputs.dzen.indexOf(link) !== -1 &&
          outputs.smartlab.indexOf(link) !== -1;
      }
    },
    {
      n: 25,
      name: "Фото: data URI",
      input: "![[star.png|64]]",
      expect: "vc текстом, Дзен и Смартлаб через img",
      check: function (blocks, payload, outputs) {
        return blocks.length === 1 && blocks[0].type === "image" &&
          payload === "![[star.png|64]]" &&
          outputs.dzen.indexOf('<img src="data:image/png;base64,') === 0 &&
          outputs.smartlab.indexOf('<img src="data:image/png;base64,') === 0 &&
          outputs.dzen.indexOf('alt="star.png"') !== -1 &&
          outputs.smartlab.indexOf('alt="star.png"') !== -1;
      }
    }
  ];

  function convert() {
    try {
      state.blocks = C.toBlocks(input.value, { images: TEST_IMAGES });
      state.outputs = {
        vc: C.toVcruPayload(state.blocks),
        dzen: C.toDzenHtml(state.blocks),
        smartlab: C.toSmartlabHtml(state.blocks)
      };
      state.error = "";
    } catch (error) {
      state.blocks = [];
      state.outputs = { vc: "", dzen: "", smartlab: "" };
      state.error = error.message;
    }
    render();
  }

  function selectedOutput() {
    return state.outputs[state.platform] || "";
  }

  function platformName() {
    if (state.platform === "dzen") return "Дзен";
    if (state.platform === "smartlab") return "Смартлаб";
    return "vc.ru";
  }

  function copyLabel() {
    return "Скопировать для " + platformName();
  }

  function hasSpecialBlocks(blocks) {
    return blocks.some(function (block) {
      return block.type === "code" || block.type === "table" || block.type === "delimiter";
    });
  }

  function hintFor() {
    if (state.platform === "dzen") {
      return "В Дзене вставь HTML в визуальный редактор. Код станет цитатой, таблица списком, разделитель текстом. Картинки и вики-ссылки остаются строками <code>![[...]]</code> и <code>[[...]]</code>, замена ручная.";
    }
    if (state.platform === "smartlab") {
      return "В Смартлабе вставь HTML в визуальный редактор. Санитайзер оставляет pre, table и hr. Картинки и вики-ссылки остаются строками <code>![[...]]</code> и <code>[[...]]</code>, замена ручная.";
    }
    return "В черновике vc.ru поставь курсор в <strong>пустой текстовый блок</strong> и вставь. Если курсор стоит в другом блоке, vc.ru склеит всё в один. Один блок уходит обычным текстом: это ограничение площадки. Картинки и вики-ссылки остаются строками <code>![[...]]</code> и <code>[[...]]</code>, замена ручная.";
  }

  function renderPlatforms() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-platform]"), function (button) {
      button.classList.toggle("active", button.getAttribute("data-platform") === state.platform);
    });
  }

  function render() {
    var blocks = state.blocks;
    var output = selectedOutput();
    var hasFrontmatter = /^\uFEFF?---\r?\n/.test(input.value);

    countBadge.textContent = String(blocks.length);
    payloadEl.textContent = output;
    copyButton.disabled = !output;
    copyButton.textContent = copyLabel();

    stats.innerHTML = "";
    stats.appendChild(pill(blocks.length + " блоков"));
    stats.appendChild(pill(output.length + " символов"));
    if (state.platform === "vc") {
      var mode = blocks.length === 1 ? "plain" : "tool";
      stats.appendChild(pill(mode === "plain" ? "plain: один блок" : "tool: много блоков", mode === "plain" ? "warn" : "ok"));
    } else {
      stats.appendChild(pill("HTML: " + platformName(), "ok"));
    }
    if (hasFrontmatter) stats.appendChild(pill("frontmatter вырезан"));

    var messages = [];
    if (state.error) {
      messages.push("Ошибка конвертера: " + state.error);
    }
    if (state.platform === "vc" && blocks.length === 1) {
      messages.push("Один блок уйдёт обычным текстом. vc.ru не создаёт нативный блок из одиночной строки [tool:...]. Если нужен нативный блок, добавь в выделение второй блок.");
    }
    if (blocks.length === 0) {
      messages.push("Блоков нет. Проверь, что вставился Markdown, а не пустой текст.");
    }
    if (hasFrontmatter) {
      messages.push("Frontmatter в начале вырезан: в статью он не попадает.");
    }
    if (state.platform === "dzen" && hasSpecialBlocks(blocks)) {
      messages.push("Дзен: код станет цитатой, таблица списком, разделитель текстом. Проверь в черновике.");
    }
    if (state.platform === "smartlab" && hasSpecialBlocks(blocks)) {
      messages.push("Смартлаб: код уходит как pre без code. Заголовки в предпросмотре могут выглядеть сломанными, проверь публикацию.");
    }
    if (output.indexOf("[[") !== -1) {
      messages.push("В выходе остались Obsidian-ссылки или картинки. Найди их поиском по [[ и замени руками.");
    }
    if (state.platform !== "vc" && output.indexOf("<img") !== -1) {
      messages.push("Фото уходит через data URI. Проверь в черновике, не вырезал ли его редактор.");
    }
    notice.hidden = messages.length === 0;
    notice.textContent = messages.join(" ");
    hintEl.innerHTML = hintFor();

    renderPlatforms();
    renderBlocks(blocks);
    setTab(state.tab);
  }

  function setPlatform(name) {
    if (!Object.prototype.hasOwnProperty.call(state.outputs, name)) return;
    state.platform = name;
    render();
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
    if (block.type === "table") return "table";
    return block.type;
  }

  function serialize(block) {
    if (block.type === "header") return { text: block.text, style: block.style };
    if (block.type === "text") return { text: block.html };
    if (block.type === "list") return { type: block.listType, items: block.items };
    if (block.type === "quote") return { text: block.html, subline1: block.subline1 || "" };
    if (block.type === "code") return { text: block.text, lang: block.lang || "", lineWrapping: false };
    if (block.type === "table") return { text: block.raw, lang: "", lineWrapping: false };
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
    if (block.type === "table") {
      var table = document.createElement("table");
      var thead = document.createElement("thead");
      var headRow = document.createElement("tr");
      block.headers.forEach(function (header, index) {
        var th = document.createElement("th");
        th.innerHTML = header;
        if (block.align[index]) th.style.textAlign = block.align[index];
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      var tbody = document.createElement("tbody");
      block.rows.forEach(function (row) {
        var tr = document.createElement("tr");
        row.forEach(function (cell, index) {
          var td = document.createElement("td");
          td.innerHTML = cell;
          if (block.align[index]) td.style.textAlign = block.align[index];
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.appendChild(table);
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
        error.textContent = result.error || (
          "vc: " + result.payload +
          "\nДзен: " + result.outputs.dzen +
          "\nСмартлаб: " + result.outputs.smartlab
        );
        row.appendChild(error);
      }

      checksPanel.appendChild(row);
    });

    checksSummary.textContent = passed + "/" + CASES.length;
    checksSummary.className = "tab-count " + (passed === CASES.length ? "tab-count-ok" : "tab-count-fail");
  }

  function runCase(testCase) {
    try {
      var blocks = C.toBlocks(testCase.input, { images: TEST_IMAGES });
      var outputs = {
        vc: C.toVcruPayload(blocks),
        dzen: C.toDzenHtml(blocks),
        smartlab: C.toSmartlabHtml(blocks)
      };
      return {
        ok: Boolean(testCase.check(blocks, outputs.vc, outputs)),
        payload: outputs.vc,
        outputs: outputs
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return "plain";
    } catch (error) {
      return fallbackCopy(text) ? "plain" : false;
    }
  }

  async function copyHtml(html) {
    if (navigator.clipboard && navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
      try {
        var item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([html], { type: "text/plain" })
        });
        await navigator.clipboard.write([item]);
        return "rich";
      } catch (error) {
        // Ниже пробуем текстовый буфер: редактор может вставить HTML как текст.
      }
    }

    return copyText(html);
  }

  async function copyOutput() {
    var text = selectedOutput();
    if (!text) {
      toast("Нечего копировать");
      return;
    }

    var result = state.platform === "vc" ? await copyText(text) : await copyHtml(text);

    if (!result) {
      payloadEl.textContent = text;
      setTab("payload");
      toast("Не удалось скопировать автоматически. Текст открыт во вкладке Payload.");
      return;
    }

    copyButton.textContent = "Скопировано";
    if (state.platform === "vc") {
      toast("В буфере " + text.length + " символов. Вставь в пустой текстовый блок vc.ru.");
    } else if (result === "rich") {
      toast("В буфере HTML для " + platformName() + ". Вставь в визуальный редактор и проверь блоки.");
    } else {
      toast("В буфере исходный HTML для " + platformName() + ". Если редактор вставил теги текстом, скопируй из вкладки Payload.");
    }
    window.setTimeout(function () {
      copyButton.textContent = copyLabel();
    }, 1600);
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
    var platform = event.target.closest ? event.target.closest("[data-platform]") : null;
    if (platform) {
      setPlatform(platform.getAttribute("data-platform"));
      return;
    }

    var tab = event.target.closest ? event.target.closest("[data-tab]") : null;
    if (tab) setTab(tab.getAttribute("data-tab"));
  });

  input.addEventListener("input", convert);
  copyButton.addEventListener("click", copyOutput);

  document.addEventListener("keydown", function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      copyOutput();
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
