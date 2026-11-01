/* =========================================================
   문항 본문 마크업 → 시험지 HTML 변환기
   (문법은 README.md 의 "본문 작성 문법" 참고)
   ========================================================= */
(function (global) {
  "use strict";

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function renderTex(tex, opts) {
    if (!global.katex) return `<span class="merr">${esc(tex)}</span>`;
    try {
      const src = opts && opts.display ? "\\displaystyle " + tex : tex;
      return global.katex.renderToString(src, { throwOnError: false, strict: "ignore", output: "html" });
    } catch (e) {
      return `<span class="merr" title="${esc(e.message)}">${esc(tex)}</span>`;
    }
  }

  /** 한 줄 안의 서식: $수식$, **굵게**, __밑줄__, [[네모칸]], [점수] */
  function inline(src, ctx) {
    const holds = [];
    const hold = (html) => "\u0000" + (holds.push(html) - 1) + "\u0000";
    let s = String(src);
    s = s.replace(/\\\$/g, () => hold("$"));
    s = s.replace(/\$([^$]+?)\$/g, (_, tex) => hold(renderTex(tex, { display: ctx.bigInline })));
    s = s.replace(/\[점수\]/g, () => {
      ctx.pointsUsed = true;
      return ctx.points ? hold(`<span class="pts">${esc(ctx.points)}</span>`) : "";
    });
    s = esc(s);
    s = s.replace(/\[\[(.+?)\]\]/g, '<span class="ibox">$1</span>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<span class="b">$1</span>');
    s = s.replace(/__(.+?)__/g, '<span class="u">$1</span>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => holds[+i]);
    return s;
  }

  const HANG_RE = /^(\((?:[가-힣]|\d{1,2}|[A-Za-z])\)|[ㄱ-ㅎ]\.|[①-⑳]|[㉠-㉭]|[◦○•※＊·]|\d{1,2}\))\s+(.*)$/;
  const BOX_RE = /^\[(조건|보기|박스|자료|둥근박스)(?:\s+(.*?))?\]$/;

  function parseOpts(str) {
    const o = { width: null, align: null, header: false, full: false, caption: null, rest: [] };
    (str || "").split(/\s+/).filter(Boolean).forEach((t) => {
      if (/^\d{1,3}%$/.test(t)) o.width = t;
      else if (t === "왼쪽" || t === "가운데" || t === "오른쪽") o.align = t;
      else if (t === "머리") o.header = true;
      else if (t === "전체") o.full = true;
      else o.rest.push(t);
    });
    return o;
  }

  /**
   * 여러 줄을 블록 목록으로 변환.
   * 반환: [{kind:'p'|'other', html}]
   */
  function parseLines(lines, start, endTag, ctx) {
    const out = [];
    let i = start;
    let para = null; // {cls, lines:[]}
    let gapNext = false;

    const flush = () => {
      if (!para) return;
      out.push({ kind: "p", cls: para.cls, parts: para.lines.map((l) => inline(l, ctx)) });
      para = null;
    };
    const pushOther = (html) => {
      flush();
      out.push({ kind: "other", html });
      gapNext = false;
    };

    while (i < lines.length) {
      const raw = lines[i];
      const t = raw.trim();

      if (endTag && t === endTag) {
        flush();
        return { flushed: out, next: i + 1 };
      }

      // 상자: [조건] [보기] [박스 제목] [자료 제목] [둥근박스]
      let m = t.match(BOX_RE);
      if (m) {
        const tag = m[1];
        const r = parseLines(lines, i + 1, `[/${tag}]`, ctx);
        const inner = blocksToHtml(r.flushed);
        const title = (m[2] || "").trim();
        let html;
        if (tag === "보기") {
          html = `<div class="box bogi"><span class="legend">&lt;${esc(title || "보 기")}&gt;</span>${inner}</div>`;
        } else if (tag === "조건") {
          html = `<div class="box cond">${inner}</div>`;
        } else {
          const cls = tag === "둥근박스" ? "box round" : "box data";
          html = `<div class="${cls}">${title ? `<div class="btitle">&lt;${inline(title, ctx)}&gt;</div>` : ""}${inner}</div>`;
        }
        pushOther(html);
        i = r.next;
        continue;
      }

      // 나란히: [나란히] ... [|] ... [/나란히]
      if (t === "[나란히]") {
        const parts = [[]];
        let j = i + 1;
        for (; j < lines.length; j++) {
          const tt = lines[j].trim();
          if (tt === "[/나란히]") break;
          if (tt === "[|]") parts.push([]);
          else parts[parts.length - 1].push(lines[j]);
        }
        const cols = parts.map((pl) => {
          const r = parseLines(pl, 0, null, ctx);
          return `<div>${blocksToHtml(r.flushed)}</div>`;
        });
        pushOther(`<div class="side">${cols.join("")}</div>`);
        i = j + 1;
        continue;
      }

      // 대화: [대화] 갑: … / 을: … [/대화]   ([대화 교대] 는 좌우 번갈아)
      m = t.match(/^\[대화(?:\s+(.*?))?\]$/);
      if (m) {
        const alt = /교대/.test(m[1] || "");
        let j = i + 1;
        let k = 0;
        let rows = "";
        for (; j < lines.length; j++) {
          const tt = lines[j].trim();
          if (tt === "[/대화]") break;
          if (!tt) continue;
          const sm = tt.match(/^([^:：]{1,8})\s*[:：]\s*(.*)$/);
          const who = sm ? sm[1].trim() : "";
          const say = sm ? sm[2] : tt;
          const right = alt && k % 2 === 1;
          rows += `<div class="tk${right ? " rt" : ""}">${who ? `<span class="who">${inline(who, ctx)}</span>` : ""}<div class="bub">${inline(say, ctx)}</div></div>`;
          k++;
        }
        pushOther(`<div class="talk">${rows}</div>`);
        i = j + 1;
        continue;
      }

      // 표
      m = t.match(/^\[표(?:\s+(.*?))?\]$/);
      if (m) {
        const o = parseOpts(m[1]);
        const rows = [];
        let j = i + 1;
        for (; j < lines.length; j++) {
          const tt = lines[j].trim();
          if (tt === "[/표]") break;
          if (tt) rows.push(tt);
        }
        const body = rows
          .map((row, ri) => {
            const cells = splitCells(row);
            return (
              "<tr>" +
              cells
                .map((c) => {
                  let cell = c.trim();
                  let th = o.header && ri === 0;
                  if (cell.startsWith("!")) {
                    th = true;
                    cell = cell.slice(1).trim();
                  }
                  let span = "";
                  const sm = cell.match(/^\{(\d+)(?:x(\d+))?\}\s*/);
                  if (sm) {
                    if (+sm[1] > 1) span += ` colspan="${sm[1]}"`;
                    if (sm[2] && +sm[2] > 1) span += ` rowspan="${sm[2]}"`;
                    cell = cell.slice(sm[0].length);
                  }
                  if (cell === "^") return ""; // 병합된 칸 자리
                  const tag = th ? "th" : "td";
                  return `<${tag}${span}>${inline(cell, ctx)}</${tag}>`;
                })
                .join("") +
              "</tr>"
            );
          })
          .join("");
        const style = o.width ? ` style="width:${o.width}"` : "";
        pushOther(`<div class="tbl-wrap${o.align === "왼쪽" ? " left" : ""}"><table class="t${o.full ? " full" : ""}"${style}>${body}</table></div>`);
        i = j + 1;
        continue;
      }

      // 그림
      m = t.match(/^\[그림\s*(\d+)(?:\s+(.*?))?\]$/);
      if (m) {
        const o = parseOpts(m[2]);
        const src = ctx.images && ctx.images[m[1]];
        const cls = o.align === "왼쪽" ? " left" : o.align === "오른쪽" ? " right" : "";
        const w = o.width || "70%";
        const cap = o.rest.length ? `<div class="cap">${inline(o.rest.join(" "), ctx)}</div>` : "";
        const img = src
          ? `<span class="figbox" style="width:${w}"><img src="${src}" alt="그림 ${m[1]}">${overlaysHtml((ctx.overlays || {})[m[1]], ctx)}</span>`
          : `<span class="missing">그림 ${esc(m[1])} 없음 — 편집기에서 그림을 올려 주세요</span>`;
        pushOther(`<div class="fig${cls}">${img}${cap}</div>`);
        i++;
        continue;
      }

      // 디스플레이 수식 $$ ... $$ (여러 줄 가능)
      if (t.startsWith("$$")) {
        let body = t.slice(2);
        let j = i;
        while (!/\$\$\s*$/.test(body) || (j === i && body.trim() === "")) {
          j++;
          if (j >= lines.length) break;
          body += "\n" + lines[j].trim();
        }
        body = body.replace(/\$\$\s*$/, "");
        let center = false;
        if (body.startsWith("가운데 ")) {
          center = true;
          body = body.slice(4);
        }
        pushOther(`<div class="dmath${center ? " center" : ""}">${renderTex(body.trim(), { display: true })}</div>`);
        i = j + 1;
        continue;
      }

      // 빈 줄 → 문단 나눔
      if (t === "") {
        flush();
        gapNext = out.length > 0;
        i++;
        continue;
      }

      // 머리 기호 문단: (가) ㄱ. ① ㉠ ◦ ...
      m = t.match(HANG_RE);
      if (m) {
        flush();
        out.push({ kind: "other", html: `<div class="hang"><span class="hl">${esc(m[1])}</span><span class="ht">${inline(m[2], ctx)}</span></div>` });
        gapNext = false;
        i++;
        continue;
      }

      // 정렬 지시어
      let cls = "";
      let text = raw.replace(/^\s+/, "");
      const am = text.match(/^\[(가운데|오른쪽|들여)\]\s*/);
      if (am) {
        cls = { 가운데: "center", 오른쪽: "right", 들여: "indent" }[am[1]];
        text = text.slice(am[0].length);
      }
      if (ctx.passage) {
        // 지문: 한 줄 = 한 문단 (첫 줄 들여쓰기, 양쪽 정렬)
        flush();
        const pc = cls || (ctx.indent ? "pp" : "pp noind");
        out.push({ kind: "p", cls: (pc + (gapNext ? " gap" : "")).trim(), parts: [inline(text, ctx)] });
        gapNext = false;
        i++;
        continue;
      }
      if (para && para.baseCls !== cls) flush();
      if (!para) {
        para = { cls: (cls + (gapNext ? " gap" : "")).trim(), lines: [], baseCls: cls };
        gapNext = false;
      }
      para.lines.push(text);
      i++;
    }
    flush();
    return { flushed: out, next: i };
  }

  function splitCells(row) {
    // 수식 안의 | 는 나누지 않음
    const cells = [];
    let cur = "";
    let inMath = false;
    for (let k = 0; k < row.length; k++) {
      const ch = row[k];
      if (ch === "\\" && row[k + 1] === "$") {
        cur += "\\$";
        k++;
        continue;
      }
      if (ch === "$") inMath = !inMath;
      if (ch === "|" && !inMath) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    if (cells.length > 1 && cells[0].trim() === "") cells.shift();
    if (cells.length > 1 && cells[cells.length - 1].trim() === "") cells.pop();
    return cells;
  }

  /** 그림 위 글상자(말풍선 채우기·가리개) */
  function overlaysHtml(list, ctx) {
    if (!Array.isArray(list) || !list.length) return "";
    return list
      .map((o) => {
        const st = [
          `left:${+o.x || 0}%`,
          `top:${+o.y || 0}%`,
          `width:${+o.w || 20}%`,
          `height:${+o.h || 10}%`,
          `font-size:${+o.size || 8}pt`,
          `text-align:${o.align === "left" ? "left" : o.align === "right" ? "right" : "center"}`,
          `justify-content:${o.valign === "top" ? "flex-start" : o.valign === "bottom" ? "flex-end" : "center"}`,
          o.bg === "white" ? "background:#fff" : "",
          o.lh ? `line-height:${+o.lh}` : "",
        ]
          .filter(Boolean)
          .join(";");
        const body = String(o.text || "")
          .split("\n")
          .map((l) => inline(l, ctx))
          .join("<br>");
        return `<div class="ov" style="${st}"><div>${body}</div></div>`;
      })
      .join("");
  }

  function pHtml(b) {
    return `<div class="p${b.cls ? " " + b.cls : ""}">${b.parts.join("<br>")}</div>`;
  }

  function blocksToHtml(blocks) {
    return blocks.map((b) => (b.kind === "p" ? pHtml(b) : b.html)).join("");
  }

  /**
   * 문항 본문 전체 렌더링
   * opts: { number, points, images, bigInline }
   */
  function makeCtx(opts) {
    return { points: opts.points || "", images: opts.images || {}, overlays: opts.overlays || {}, bigInline: !!opts.bigInline, pointsUsed: false, passage: !!opts.passage, indent: opts.indent !== false };
  }

  /** 지문: 최상위 블록마다 따로 돌려줌 (단·쪽 사이에서 나눠 싣기 위해) */
  function renderPassage(text, opts) {
    const ctx = makeCtx(Object.assign({}, opts, { passage: true }));
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    return parseLines(lines, 0, null, ctx).flushed.map((b) => ({ html: b.kind === "p" ? pHtml(b) : b.html, text: b.kind === "p" }));
  }

  function renderBody(text, opts) {
    const ctx = makeCtx(opts);
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const r = parseLines(lines, 0, null, ctx);
    const blocks = r.flushed;

    if (!ctx.pointsUsed && ctx.points) {
      let last = -1;
      blocks.forEach((b, k) => {
        if (b.kind === "p") last = k;
      });
      const pts = `<span class="pts">${esc(ctx.points)}</span>`;
      if (last >= 0) {
        const p = blocks[last];
        p.parts[p.parts.length - 1] += " " + pts;
      } else blocks.push({ kind: "p", cls: "", parts: [pts] });
    }
    if (opts.number != null) {
      const no = `<span class="qno">${esc(opts.number)}.</span>`;
      if (blocks.length && blocks[0].kind === "p" && !blocks[0].cls.includes("center")) {
        blocks[0].parts[0] = no + blocks[0].parts[0];
      } else {
        blocks.unshift({ kind: "p", cls: "", parts: [no] });
      }
    }
    return blocksToHtml(blocks);
  }

  global.ExamMarkup = { renderBody, renderPassage, overlaysHtml, inline: (s, o) => inline(s, Object.assign({ points: "", images: {}, bigInline: false }, o || {})), renderTex, esc };
})(window);
