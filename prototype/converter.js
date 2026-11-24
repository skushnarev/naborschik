/*
 * naborschik, конвертер Markdown в блоки vc.ru.
 *
 * Это чистый модуль без Obsidian API и без DOM. Его можно поднять в Node,
 * в браузере или позже перенести в src/ плагина.
 *
 * Внешняя зависимость одна: marked (lexer). Он лежит рядом в vendor/.
 */
(function (root) {
  "use strict";

  /** @typedef {{type: "header", style: "h2" | "h3", text: string}} HeaderBlock */
  /** @typedef {{type: "text", html: string}} TextBlock */
  /** @typedef {{type: "list", listType: "UL" | "OL", items: string[]}} ListBlock */
  /** @typedef {{type: "quote", html: string, subline1: string}} QuoteBlock */
  /** @typedef {{type: "code", text: string, lang: string, lineWrapping: boolean}} CodeBlock */
  /** @typedef {{type: "table", headers: string[], rows: string[][], align: Array<string|null>, raw: string}} TableBlock */
  /** @typedef {{type: "delimiter"}} DelimiterBlock */
  /** @typedef {HeaderBlock | TextBlock | ListBlock | QuoteBlock | CodeBlock | TableBlock | DelimiterBlock} Block */

  var LANG_ALIASES = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    yml: "yaml",
    md: "markdown",
    text: "",
    txt: ""
  };

  function normalizeLang(lang) {
    var value = String(lang || "").trim().toLowerCase().split(/\s+/)[0];
    if (!value) return "";
    return Object.prototype.hasOwnProperty.call(LANG_ALIASES, value) ? LANG_ALIASES[value] : value;
  }

  var placeholders = [];

  function resetPlaceholders() {
    placeholders = [];
  }

  function placeholder(value) {
    var index = placeholders.length;
    placeholders.push(value);
    return "@@NABORSCHIK_" + index + "@@";
  }

  function restorePlaceholders(html) {
    return html.replace(/@@NABORSCHIK_(\d+)@@/g, function (_, index) {
      var value = placeholders[Number(index)];
      return value === undefined ? "" : escapeHtml(value);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, "&quot;");
  }

  function decodeEntities(value) {
    return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (match, entity) {
      if (entity === "amp") return "&";
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      if (entity === "quot") return '"';
      if (entity === "apos") return "'";
      if (entity === "nbsp") return "\u00A0";
      if (entity.charAt(0) === "#") {
        var code = entity.charAt(1).toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    });
  }

  function htmlToText(html) {
    return decodeEntities(
      String(html)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
    );
  }

  function stripTags(html) {
    return htmlToText(html).trim();
  }

  function lexer(markdown) {
    if (!root.marked || typeof root.marked.lexer !== "function") {
      throw new Error("marked не загружен: нужен prototype/vendor/marked.umd.js");
    }
    return root.marked.lexer(markdown, { gfm: true });
  }

  function preprocess(markdown) {
    resetPlaceholders();

    var source = String(markdown).replace(/\r\n?/g, "\n");

    // Frontmatter вырезается только в начале документа и только если внутри
    // есть хотя бы один ключ. Иначе первый --- это обычный разделитель.
    var frontmatter = source.match(/^\uFEFF?---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
    if (frontmatter && /^[\w-]+\s*:/m.test(frontmatter[1])) {
      source = source.slice(frontmatter[0].length);
    }

    // Комментарии Obsidian, включая многострочные.
    source = source.replace(/%%[\s\S]*?%%/g, "");

    // Вставки и вики-ссылки остаются текстом как есть: замена ручная,
    // а по [[ пользователь найдёт их поиском, как и картинки.
    source = source.replace(/!\[\[[^\]]*\]\]/g, function (match) {
      return placeholder(match);
    });

    source = source.replace(/\[\[[^\[\]]+\]\]/g, function (match) {
      return placeholder(match);
    });

    // Подсветка: разметку убираем, текст оставляем.
    source = source.replace(/==([^=\n]+)==/g, "$1");

    // Callout: маркер убираем, заголовок делаем жирным.
    source = source
      .split("\n")
      .map(function (line) {
        var match = line.match(/^(\s*(?:>\s*)+)\[!([A-Za-z0-9_-]+)\][+-]?[ \t]*(.*)$/);
        if (!match) return line;
        var prefix = match[1];
        var title = match[3].trim();
        return title ? prefix + "**" + title + "**" : null;
      })
      .filter(function (line) {
        return line !== null;
      })
      .join("\n");

    // Блочные идентификаторы Obsidian.
    source = source.replace(/[ \t]+\^[A-Za-z0-9-]+[ \t]*$/gm, "");

    return source;
  }

  function renderInlineToken(token) {
    switch (token.type) {
      case "text":
        return (token.escaped ? token.text : escapeHtml(token.text)).replace(/\n/g, "<br>");
      case "escape":
        return escapeHtml(token.text);
      case "strong":
        return "<b>" + renderInline(token.tokens) + "</b>";
      case "em":
        return "<i>" + renderInline(token.tokens) + "</i>";
      case "del":
        return renderInline(token.tokens);
      case "link": {
        var label = renderInline(token.tokens);
        var href = token.href || "";
        if (!/^(https?:\/\/|mailto:|\/|#)/i.test(href)) return label;
        return '<a href="' + escapeAttr(href) + '">' + label + "</a>";
      }
      case "image":
        return escapeHtml(token.raw);
      case "codespan":
        return escapeHtml(token.text);
      case "br":
        return "<br>";
      case "html":
        return escapeHtml(token.raw || token.text || "");
      case "checkbox":
        return "";
      default:
        if (token.tokens) return renderInline(token.tokens);
        return escapeHtml(token.text != null ? token.text : token.raw || "");
    }
  }

  function renderInline(tokens) {
    var html = (tokens || []).map(renderInlineToken).join("");
    return restorePlaceholders(html);
  }

  function inlineToPlain(tokens) {
    return htmlToText(renderInline(tokens)).trim();
  }

  function flattenList(token, level) {
    var items = [];
    level = level || 0;

    (token.items || []).forEach(function (item) {
      var parts = [];
      var nested = [];

      (item.tokens || []).forEach(function (child) {
        if (child.type === "list") {
          nested.push(child);
        } else if (child.type === "space" || child.type === "checkbox") {
          return;
        } else if (child.tokens) {
          parts.push(renderInline(child.tokens));
        } else if (child.text != null) {
          parts.push(escapeHtml(child.text).replace(/\n/g, "<br>"));
        }
      });

      var prefix = item.task ? (item.checked ? "☑ " : "☐ ") : "";
      var text = parts.join("<br>").trim();
      if (text) {
        // vc.ru срезает ведущие пробелы и &nbsp; в пунктах списка,
        // поэтому вложенность показываем видимым маркером.
        var indent = level > 0 ? "↳ ".repeat(level) : "";
        items.push(indent + prefix + text);
      }

      nested.forEach(function (child) {
        items = items.concat(flattenList(child, level + 1));
      });
    });

    return items;
  }

  function cellToHtml(cell) {
    if (cell && cell.tokens && cell.tokens.length) return renderInline(cell.tokens).trim();
    return escapeHtml(cell && cell.text != null ? cell.text : "").trim();
  }

  function tableToBlock(token) {
    var headers = (token.header || []).map(cellToHtml);
    var rows = (token.rows || []).map(function (row) {
      return (row || []).map(cellToHtml);
    });
    var align = (token.align || headers.map(function () { return null; })).slice();

    return {
      type: "table",
      headers: headers,
      rows: rows,
      align: align,
      raw: String(token.raw || "").replace(/\n+$/, "")
    };
  }

  function quoteToHtml(token) {
    var parts = [];

    (token.tokens || []).forEach(function (child) {
      if (child.type === "paragraph") {
        parts.push(renderInline(child.tokens).trim());
      } else if (child.type === "text") {
        parts.push(escapeHtml(child.text).replace(/\n/g, "<br>").trim());
      } else if (child.type === "list") {
        parts.push(flattenList(child, 0).join("<br>"));
      }
    });

    return parts.filter(Boolean).join("<br><br>");
  }

  /**
   * Markdown в массив блоков.
   * @param {string} markdown
   * @returns {Block[]}
   */
  function toBlocks(markdown) {
    var source = preprocess(markdown);
    var tokens = lexer(source);
    var blocks = [];

    tokens.forEach(function (token) {
      switch (token.type) {
        case "heading": {
          if (token.depth === 1) break;
          var heading = inlineToPlain(token.tokens);
          if (!heading) break;
          if (token.depth === 2 || token.depth === 3) {
            blocks.push({ type: "header", style: "h" + token.depth, text: heading });
          } else {
            blocks.push({ type: "text", html: "<p><b>" + escapeHtml(heading) + "</b></p>" });
          }
          break;
        }

        case "paragraph": {
          var html = renderInline(token.tokens).trim();
          if (stripTags(html)) blocks.push({ type: "text", html: "<p>" + html + "</p>" });
          break;
        }

        case "list": {
          var items = flattenList(token, 0);
          if (items.length) {
            blocks.push({ type: "list", listType: token.ordered ? "OL" : "UL", items: items });
          }
          break;
        }

        case "blockquote": {
          var quote = quoteToHtml(token);
          if (stripTags(quote)) blocks.push({ type: "quote", html: "<p>" + quote + "</p>", subline1: "" });
          break;
        }

        case "hr":
          blocks.push({ type: "delimiter" });
          break;

        case "code": {
          var code = token.text.replace(/\n$/, "");
          if (code.trim()) {
            blocks.push({
              type: "code",
              text: code,
              lang: normalizeLang(token.lang),
              lineWrapping: false
            });
          }
          break;
        }

        case "table": {
          // Храним таблицу отдельно: vc.ru получает прежний code-блок,
          // а Дзен и Смартлаб могут развернуть её по своим правилам.
          var table = tableToBlock(token);
          if (table.raw.trim()) blocks.push(table);
          break;
        }

        case "html": {
          var raw = token.text != null ? token.text : token.raw;
          var escaped = escapeHtml(raw).trim().replace(/\n/g, "<br>");
          if (stripTags(escaped)) blocks.push({ type: "text", html: "<p>" + escaped + "</p>" });
          break;
        }

        default:
          break;
      }
    });

    return blocks;
  }

  function singleBlockToText(block) {
    if (block.type === "header") return block.text;
    if (block.type === "delimiter") return "***";
    if (block.type === "code") return block.text;
    if (block.type === "table") return block.raw;
    if (block.type === "text") return htmlToText(block.html).trim();
    if (block.type === "quote") {
      return htmlToText(block.html)
        .split("\n")
        .map(function (line) {
          return line ? "> " + line : ">";
        })
        .join("\n")
        .trim();
    }
    if (block.type === "list") {
      return block.items
        .map(function (item) {
          return "- " + htmlToText(item).trim();
        })
        .join("\n");
    }
    return "";
  }

  function serializeBlock(block) {
    if (block.type === "header") {
      return "[header:" + JSON.stringify({ text: block.text, style: block.style }) + "]";
    }
    if (block.type === "text") {
      return "[text:" + JSON.stringify({ text: block.html }) + "]";
    }
    if (block.type === "list") {
      return "[list:" + JSON.stringify({ type: block.listType, items: block.items }) + "]";
    }
    if (block.type === "quote") {
      return "[quote:" + JSON.stringify({ text: block.html, subline1: block.subline1 || "" }) + "]";
    }
    if (block.type === "code") {
      return "[code:" + JSON.stringify({ text: block.text, lang: block.lang || "", lineWrapping: false }) + "]";
    }
    if (block.type === "table") {
      return "[code:" + JSON.stringify({ text: block.raw, lang: "", lineWrapping: false }) + "]";
    }
    if (block.type === "delimiter") {
      return "[delimiter:" + JSON.stringify({ type: "default" }) + "]";
    }
    return "";
  }

  /**
   * Массив блоков в строку text/plain для вставки в vc.ru.
   * Одиночный блок отдаётся читаемым текстом: vc.ru не создаёт
   * нативный блок из одной строки [tool:...].
   * @param {Block[]} blocks
   * @returns {string}
   */
  function toVcruPayload(blocks) {
    if (!blocks || blocks.length === 0) return "";
    if (blocks.length === 1) return singleBlockToText(blocks[0]);
    return blocks.map(serializeBlock).join("\n\n");
  }

  function renderListHtml(block) {
    var tag = block.listType === "OL" ? "ol" : "ul";
    var items = (block.items || []).map(function (item) {
      return "<li>" + item + "</li>";
    });
    if (!items.length) return "";
    return "<" + tag + ">\n" + items.join("\n") + "\n</" + tag + ">";
  }

  function renderTableAsList(block) {
    var headers = block.headers || [];
    var rows = block.rows || [];
    var items = [];

    rows.forEach(function (row) {
      var pairs = [];
      for (var index = 0; index < headers.length; index += 1) {
        var label = headers[index] != null ? headers[index] : "";
        var value = row[index] != null ? row[index] : "";
        pairs.push("<b>" + label + ":</b>" + (value ? " " + value : ""));
      }
      if (pairs.length) items.push("<li>" + pairs.join("; ") + "</li>");
    });

    if (!items.length) return "";
    return "<ul>\n" + items.join("\n") + "\n</ul>";
  }

  function textLinesToHtml(text) {
    return escapeHtml(String(text)).replace(/\n/g, "<br>");
  }

  function dzenBlockToHtml(block) {
    switch (block.type) {
      case "header":
        return "<" + block.style + ">" + escapeHtml(block.text) + "</" + block.style + ">";
      case "text":
        return block.html;
      case "list":
        return renderListHtml(block);
      case "quote":
        return "<blockquote>" + block.html + "</blockquote>";
      case "code":
        return "<blockquote><p>" + textLinesToHtml(block.text) + "</p></blockquote>";
      case "table":
        return renderTableAsList(block);
      case "delimiter":
        return "<p>* * *</p>";
      default:
        return "";
    }
  }

  /**
   * Блоки в HTML для редактора Дзена.
   * @param {Block[]} blocks
   * @returns {string}
   */
  function toDzenHtml(blocks) {
    if (!blocks || !blocks.length) return "";
    return blocks.map(dzenBlockToHtml).filter(Boolean).join("\n");
  }

  function renderTableHtml(block) {
    var headers = block.headers || [];
    var rows = block.rows || [];
    if (!headers.length && !rows.length) return "";

    var head = "<tr>" + headers.map(function (header) {
      return "<th>" + header + "</th>";
    }).join("") + "</tr>";

    var parts = ["<table>", "<thead>", head, "</thead>"];

    if (rows.length) {
      var body = rows.map(function (row) {
        return "<tr>" + row.map(function (cell) {
          return "<td>" + cell + "</td>";
        }).join("") + "</tr>";
      }).join("\n");
      parts.push("<tbody>", body, "</tbody>");
    }

    parts.push("</table>");
    return parts.join("\n");
  }

  function smartlabBlockToHtml(block) {
    switch (block.type) {
      case "header": {
        // Смартлаб вырезает h2, а в редакторе доступны только h3 и h4.
        // Маппинг по исходному стилю блока, без строковых замен: h2→h3, h3→h4.
        var headingTag = block.style === "h3" ? "h4" : "h3";
        return "<" + headingTag + ">" + escapeHtml(block.text) + "</" + headingTag + ">";
      }
      case "text":
        return block.html;
      case "list":
        return renderListHtml(block);
      case "quote":
        return "<blockquote>" + block.html + "</blockquote>";
      case "code":
        // Смартлаб показывает code внутри pre тегами текстом.
        return "<pre>" + escapeHtml(block.text) + "</pre>";
      case "table":
        return renderTableHtml(block);
      case "delimiter":
        return "<hr>";
      default:
        return "";
    }
  }

  /**
   * Блоки в безопасный HTML для редактора Смартлаба.
   * Без классов, id и стилей: санитайзер LiveStreet неизвестен.
   * @param {Block[]} blocks
   * @returns {string}
   */
  function toSmartlabHtml(blocks) {
    if (!blocks || !blocks.length) return "";
    return blocks.map(smartlabBlockToHtml).filter(Boolean).join("\n");
  }

  var api = {
    toBlocks: toBlocks,
    toVcruPayload: toVcruPayload,
    toDzenHtml: toDzenHtml,
    toSmartlabHtml: toSmartlabHtml,
    preprocess: preprocess,
    htmlToText: htmlToText,
    escapeHtml: escapeHtml
  };

  root.NaborschikConverter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
