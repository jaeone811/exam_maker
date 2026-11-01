/* =========================================================
   조판 엔진: 문항 높이를 실측해서 A4 2단 페이지로 배치
   ========================================================= */
(function (global) {
  "use strict";
  const { renderBody, renderPassage, inline, esc } = global.ExamMarkup;
  const isQ = (q) => q.kind !== "passage";
  let lastGeo = null;
  const MM = 96 / 25.4;
  const CIRC = ["①", "②", "③", "④", "⑤", "⑥", "⑦"];

  function fmtPoints(p, meta) {
    if (p === "" || p == null) return "";
    const n = Number(p);
    if (!isFinite(n) || n <= 0) return "";
    if (n === 2 && !meta.showTwoPoint) return "";
    return `[${n}점]`;
  }

  function choiceList(q) {
    const arr = (q.choices || []).slice(0, 5);
    while (arr.length < 5) arr.push("");
    if (!arr.some((c) => String(c || "").trim())) return arr; // 아직 비어 있으면 5칸 그대로
    while (arr.length > 2 && !String(arr[arr.length - 1] || "").trim()) arr.pop(); // 4지선다 등
    return arr;
  }

  function questionHtml(q, no, meta, label) {
    const body = renderBody(q.text, { number: no, points: fmtPoints(q.points, meta), images: q.images || {}, overlays: q.overlays || {}, bigInline: meta.bigInline });
    let choices = "";
    if (q.type === "mc") {
      const opts = { images: q.images || {}, overlays: q.overlays || {}, bigInline: meta.bigInline };
      choices =
        `<div class="choices measuring">` +
        choiceList(q)
          .map((c, i) => `<div class="ch"><span class="cn">${CIRC[i]}</span><span class="ct">${inline(c || "", opts)}</span></div>`)
          .join("") +
        `</div>`;
    }
    const lab = label ? `<div class="qlabel">${esc(label)}</div>` : "";
    return `<div class="q">${lab}<div class="qbody">${body}</div>${choices}</div>`;
  }

  /** '5지선다형 / 단답형' 상자는 수능·모평에서 수학 영역에만 있음 */
  function showTypeLabels(meta) {
    const v = meta.autoTypeLabel;
    if (v === "on" || v === true) return true;
    if (v === "off" || v === false) return false;
    return /수학/.test(meta.subject || "");
  }

  function titleHtml(meta, sec) {
    return esc(meta.subject || "") + (sec && sec.subtitle ? `<small>(${esc(sec.subtitle)})</small>` : "");
  }

  function nameRowHtml(meta) {
    if (!meta.showNameRow) return "";
    const n = Math.max(0, Math.min(14, Number(meta.idDigits) || 0));
    const dashAt = Number(meta.idDash) || 0;
    let digits = "";
    for (let k = 0; k < n; k++) {
      digits += "<span></span>";
      if (dashAt && k === dashAt - 1 && k < n - 1) digits += '<span class="dash">-</span>';
    }
    const sel = meta.showSelectBox ? `<div class="cell"><span class="sel">제 [ &nbsp; &nbsp; ] 선택</span></div>` : "";
    return `<div class="namerow"><div class="cell"><span class="lab">성명</span><span class="blank"></span></div><div class="cell"><span class="lab">수험번호</span><span class="digits">${digits}</span></div>${sel}</div>`;
  }

  function headerFirst(meta, sec, pno) {
    return (
      `<div class="hdr hdr-first">` +
      `<div class="top"><div class="exam-name">${esc(meta.examTitle || "")}</div>${pno != null ? `<div class="pno r">${pno}</div>` : ""}</div>` +
      `<div class="main">${meta.period ? `<div class="period">${esc(meta.period)}</div>` : "<div></div>"}<div class="title-big">${titleHtml(meta, sec)}</div>${
        meta.typeMark ? `<div class="type-mark">${esc(meta.typeMark)}</div>` : "<div></div>"
      }</div>` +
      nameRowHtml(meta) +
      `<div class="rule"></div></div>`
    );
  }

  function headerNormal(titleInner, pno) {
    let num = "";
    if (pno != null) num = `<div class="pno ${pno % 2 === 0 ? "l" : "r"}">${pno}</div>`;
    return `<div class="hdr hdr-normal"><div class="bar">${num}<div class="title-small">${titleInner}</div></div><div class="rule"></div></div>`;
  }

  function footer(n, total) {
    return `<div class="ftr"><span class="a">${n}</span><span class="b">${total}</span></div>`;
  }

  function pageStyle(meta) {
    return `--fs:${Number(meta.fontSize) || 10}pt;--lh:${Number(meta.lineHeight) || 1.72}`;
  }

  function shell(meta, header, colsInner, foot, single) {
    return `<div class="page" style="${pageStyle(meta)}">${header}<div class="cols${single ? " single" : ""}">${colsInner}</div>${foot || ""}</div>`;
  }

  function emptyCols(single) {
    return single
      ? `<div class="col l"><div class="col-in"></div></div>`
      : `<div class="col l"><div class="col-in"></div></div><div class="col r"><div class="col-in"></div></div>`;
  }

  function noticeHtml(meta, nextSec) {
    let items = `<div class="ni"><span>○</span><span>답안지의 해당란에 필요한 내용을 정확히 기입(표기)했는지 확인하시오.</span></div>`;
    if (nextSec) {
      const nm = nextSec.subtitle ? `선택과목(${esc(nextSec.subtitle)})` : esc(meta.subject || "다음");
      items += `<div class="ni"><span>○</span><span>이어서, <b>「${nm}」</b> 문제가 제시되오니, 자신이 선택한 과목인지 확인하시오.</span></div>`;
    }
    return `<div class="notice"><div class="nt">＊ 확인 사항</div>${items}</div>`;
  }

  /* ---------- 실측 ---------- */
  async function waitAssets(root) {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
    if (document.fonts && document.fonts.ready) {
      void root.offsetHeight;
      await document.fonts.ready;
    }
  }

  async function geometry(host, meta) {
    host.innerHTML =
      shell(meta, headerFirst(meta, { subtitle: "가" }, 1), emptyCols(false), footer(1, 1)) +
      shell(meta, headerNormal(titleHtml(meta, { subtitle: "가" }), 2), emptyCols(false), footer(2, 2)) +
      shell(meta, headerNormal("정답 및 해설", null), emptyCols(false), "");
    await waitAssets(host);
    const cins = host.querySelectorAll(".col-in");
    // clientWidth는 정수로 반올림돼서 실제 단보다 넓게 잴 수 있음 → 소수점까지 재고 살짝 좁게
    const rw = (el) => el.getBoundingClientRect().width;
    const rh = (el) => el.getBoundingClientRect().height;
    const g = {
      h1: rh(cins[0]),
      h2: rh(cins[2]),
      h3: rh(cins[4]),
      w: Math.min(rw(cins[0]), rw(cins[1])) - 0.05,
    };
    host.innerHTML = "";
    return g;
  }

  async function measureBlocks(host, meta, w, htmls) {
    host.innerHTML = `<div class="page" style="${pageStyle(meta)};height:auto;width:auto;padding:0;display:block"><div class="mcol" style="width:${w}px">${htmls
      .map((h) => `<div class="blk" style="position:static;display:flow-root">${h}</div>`)
      .join("")}</div></div>`;
    await waitAssets(host);
    const gap = 2 * MM;
    host.querySelectorAll(".choices.measuring").forEach((el) => {
      const items = Array.from(el.querySelectorAll(".ch"));
      const maxW = Math.max(0, ...items.map((it) => it.getBoundingClientRect().width));
      const pl = parseFloat(getComputedStyle(el).paddingLeft) || 0;
      const avail = el.clientWidth - pl;
      const n = items.length;
      let cls = "c1";
      if (maxW * n + gap * (n - 1) <= avail && n <= 5) cls = "c" + n;
      else if (n >= 4 && maxW * 3 + gap * 2 <= avail) cls = "c3";
      else if (maxW * 2 + gap <= avail) cls = "c2";
      if (cls === "c2" && n === 5) cls = "c1"; // 5지선다는 2열 대신 세로 배열
      el.classList.remove("measuring");
      el.classList.add(cls);
    });
    const blks = Array.from(host.querySelectorAll(".mcol > .blk"));
    const res = blks.map((b) => ({ h: b.getBoundingClientRect().height, html: b.innerHTML, cuts: lineCuts(b) }));
    host.innerHTML = "";
    return res;
  }

  /** 블록 안 글줄 사이의 자를 수 있는 위치(px). 지문을 단 사이에서 나눌 때 씀 */
  function lineCuts(el) {
    const base = el.getBoundingClientRect().top;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rects = [];
    const range = document.createRange();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.height > 0 && r.width > 0) rects.push({ t: r.top - base, b: r.bottom - base });
    }
    // 그림·표 같은 통째 요소는 자르면 안 되므로 그 영역은 한 덩어리로 취급
    el.querySelectorAll("img, table, .box, .fig, .side, .talk, .dmath").forEach((x) => {
      const r = x.getBoundingClientRect();
      rects.push({ t: r.top - base, b: r.bottom - base });
    });
    rects.sort((a, b) => a.t - b.t);
    const lines = [];
    rects.forEach((r) => {
      const last = lines[lines.length - 1];
      if (last && r.t < last.b - 1.5) last.b = Math.max(last.b, r.b);
      else lines.push({ t: r.t, b: r.b });
    });
    const cuts = [];
    for (let k = 0; k < lines.length - 1; k++) cuts.push((lines[k].b + lines[k + 1].t) / 2);
    return cuts;
  }

  /* ---------- 배치 ---------- */
  function paginate(items, geo, meta, opts) {
    const K = Math.max(1, Number(meta.slotsPerCol) || 2);
    const slotMode = meta.layout === "slots" && !opts.forceFlow;
    const gap = (Number(meta.flowGap) || 7) * MM;
    const pages = [];
    let page, col, y, slot;

    const colH = () => (page.first ? geo.h1 : opts.hNormal || geo.h2);
    const newPage = (first) => {
      page = { first: !!first, cols: [[], []], full: [false, false] };
      pages.push(page);
      col = 0;
      y = 0;
      slot = 0;
    };
    const nextCol = () => {
      page.full[col] = true;
      if (col === 0 && !opts.single) {
        col = 1;
        y = 0;
        slot = 0;
      } else newPage(false);
    };
    newPage(opts.firstHeader !== false);
    const empty = () => y === 0 && slot === 0;

    items.forEach((it, idx) => {
      if (it.breakBefore === "page" && !(empty() && col === 0)) newPage(false);
      else if (it.breakBefore === "column" && !empty()) nextCol();

      if (slotMode) {
        let H = colH();
        let sH = H / K;
        const need = () => {
          if (it.slots === "all") return K;
          if (Number(it.slots) > 0) return Math.min(K, Number(it.slots));
          return Math.max(1, Math.min(K, Math.ceil((it.h + 4 * MM) / sH)));
        };
        let n = need();
        if (slot + n > K) {
          nextCol();
          H = colH();
          sH = H / K;
          n = need();
        }
        page.cols[col].push({ it, top: slot * sH, over: it.h > H + 1 });
        slot += n;
        y = slot * sH;
      } else {
        const gapOf = it.gapAfter != null ? it.gapAfter : gap;
        // 지문 머리말은 다음 내용 두어 줄과 같은 단에
        if (it.keepNext && y > 0) {
          const nx = items[idx + 1];
          const need = it.h + (nx ? Math.min(nx.h, (nx.cuts && nx.cuts[1]) || nx.h) : 0);
          if (y + need > colH() + 0.5) nextCol();
        }
        if (it.split && it.cuts && it.cuts.length && y + it.h > colH() + 0.5) {
          // 글줄 단위로 잘라서 다음 단·쪽에 이어 싣기
          let off = 0;
          for (let guard = 0; guard < 200; guard++) {
            const room = colH() - y;
            const rest = it.h - off;
            if (rest <= room + 0.5) {
              page.cols[col].push({ it, top: y, clipTop: off, clipH: rest });
              y += rest + gapOf;
              break;
            }
            let c = null;
            it.cuts.forEach((cut) => {
              if (cut > off + 1 && cut - off <= room) c = cut;
            });
            if (c == null) {
              if (y === 0) {
                page.cols[col].push({ it, top: 0, clipTop: off, clipH: rest, over: true });
                y = rest + gapOf;
                break;
              }
              nextCol();
              continue;
            }
            page.cols[col].push({ it, top: y, clipTop: off, clipH: c - off });
            off = c;
            nextCol();
          }
          slot = 1;
          return;
        }
        if (y > 0 && y + it.h > colH() + 0.5) nextCol();
        const H2 = colH();
        page.cols[col].push({ it, top: y, over: it.h > H2 + 1 });
        y += it.h + gapOf;
        slot = 1;
      }
    });

    // 밀집형: 꽉 찬 단은 남는 공간을 문항 사이에 고르게 분배
    if (!slotMode && meta.justify !== false) {
      pages.forEach((pg) => {
        pg.cols.forEach((list, ci) => {
          if (!pg.full[ci] || list.length < 2 || list.some((e) => e.it.psg)) return;
          const H = pg.first ? geo.h1 : opts.hNormal || geo.h2;
          const used = list.reduce((s, e) => s + e.it.h, 0) + gap * (list.length - 1);
          const extra = Math.min((H - used) / (list.length - 1), 30 * MM);
          if (extra <= 0) return;
          let yy = 0;
          list.forEach((e) => {
            e.top = yy;
            yy += e.it.h + gap + extra;
          });
        });
      });
    }

    // 확인 사항 박스: 마지막 쪽 오른쪽 단 맨 아래
    if (opts.notice) {
      const last = pages[pages.length - 1];
      const H = last.first ? geo.h1 : opts.hNormal || geo.h2;
      const ci = opts.single ? 0 : 1;
      const used = last.cols[ci].reduce((m, e) => Math.max(m, e.top + e.it.h), 0);
      if (used + 5 * MM + opts.notice.h > H) {
        newPage(false);
        page.notice = opts.notice;
      } else last.notice = opts.notice;
    }
    return pages;
  }

  function colsHtml(pg, single, selId) {
    const colInner = (list) =>
      list
        .map(
          (e) =>
            e.clipH != null
              ? `<div class="blk frag${e.over ? " overflow" : ""}${e.it.id && e.it.id === selId ? " sel" : ""}"${e.it.id ? ` data-qid="${e.it.id}"` : ""} style="top:${e.top.toFixed(2)}px;height:${e.clipH.toFixed(2)}px"><div style="margin-top:${(-e.clipTop).toFixed(2)}px">${e.it.html}</div></div>`
              : `<div class="blk${e.over ? " overflow" : ""}${e.it.id && e.it.id === selId ? " sel" : ""}"${e.it.id ? ` data-qid="${e.it.id}"` : ""} style="top:${e.top.toFixed(2)}px">${e.it.html}</div>`
        )
        .join("");
    // 상자 지문: 단마다 이어지는 덩어리를 하나의 테두리로 감쌈 (단이 바뀌면 거기서 닫고 다시 엶)
    const frames = (list) => {
      let html = "";
      const pad = 1.2 * MM;
      for (let i = 0; i < list.length; i++) {
        if (!list[i].it.boxed) continue;
        let j = i;
        while (j + 1 < list.length && list[j + 1].it.boxed && list[j + 1].it.id === list[i].it.id) j++;
        const a = list[i];
        const z = list[j];
        let top = a.top;
        if (a.clipTop || !/bx-first/.test(a.it.html)) top -= pad; // 이어지는 부분은 위를 살짝 띄움
        let bottom = z.top + (z.clipH != null ? z.clipH : z.it.h);
        const ended = /bx-last/.test(z.it.html) && (z.clipH == null || z.clipTop + z.clipH >= z.it.h - 0.5);
        if (!ended) bottom += pad;
        html += `<div class="bxframe" style="top:${top.toFixed(2)}px;height:${(bottom - top).toFixed(2)}px"></div>`;
        i = j;
      }
      return html;
    };
    const notice = pg.notice ? `<div class="blk" style="top:auto;bottom:0">${pg.notice.html}</div>` : "";
    if (single) return `<div class="col l"><div class="col-in">${colInner(pg.cols[0])}${frames(pg.cols[0])}${notice}</div></div>`;
    return `<div class="col l"><div class="col-in">${colInner(pg.cols[0])}${frames(pg.cols[0])}</div></div><div class="col r"><div class="col-in">${colInner(pg.cols[1])}${frames(pg.cols[1])}${notice}</div></div>`;
  }

  /* ---------- 번호 매기기 ---------- */
  function numbering(sections) {
    const map = {};
    let n = 0;
    sections.forEach((sec) => {
      const start = Number(sec.startNo) > 0 ? Number(sec.startNo) : n + 1;
      let i = 0;
      sec.questions.forEach((q) => {
        if (isQ(q)) map[q.id] = start + i++;
      });
      n = start + i - 1;
    });
    return map;
  }

  /** 지문마다 묶인 문항 번호 범위 {지문id: [처음, 끝]} */
  function passageRanges(sections, nums) {
    const out = {};
    sections.forEach((sec) => {
      sec.questions.forEach((p, i) => {
        if (isQ(p)) return;
        const limit = Number(p.count) > 0 ? Number(p.count) : Infinity;
        const got = [];
        for (let j = i + 1; j < sec.questions.length && got.length < limit; j++) {
          const q = sec.questions[j];
          if (!isQ(q)) break;
          got.push(nums[q.id]);
        }
        out[p.id] = got.length ? [got[0], got[got.length - 1]] : null;
      });
    });
    return out;
  }

  function passageHeading(p, range) {
    const r = range ? (range[0] === range[1] ? `[${range[0]}]` : `[${range[0]}～${range[1]}]`) : "[ ]";
    const tpl = (p.heading || "").trim() || "{범위} 다음 글을 읽고 물음에 답하시오.";
    return tpl.includes("{범위}") ? tpl.replace("{범위}", r) : tpl;
  }

  function answerText(q) {
    if (q.type === "mc") {
      const a = Number(q.answer);
      return a >= 1 && a <= 7 ? CIRC[a - 1] : "";
    }
    return q.answer == null ? "" : String(q.answer);
  }

  /* ---------- 전체 조판 ---------- */
  async function build(state, host, selId) {
    const meta = state.meta;
    const secs = state.sections.filter((s) => s.include !== false);
    const nums = numbering(state.sections);
    const ranges = passageRanges(state.sections, nums);
    const geo = await geometry(host, meta);
    lastGeo = geo;
    const warnings = [];

    // 1) 문항 HTML 생성 + 실측
    const all = [];
    secs.forEach((sec, si) => {
      let prevType = null;
      sec.questions.forEach((q) => {
        if (!isQ(q)) {
          const head = `<div class="psg-head">${inline(passageHeading(q, ranges[q.id]), { bigInline: meta.bigInline })}</div>`;
          const chunks = renderPassage(q.text, { images: q.images || {}, overlays: q.overlays || {}, bigInline: meta.bigInline, indent: q.indent !== false });
          if (meta.layout === "slots") {
            const body = chunks.map((c) => c.html).join("");
            all.push({ si, q, html: `<div class="psg">${head}${q.box ? `<div class="psgbox">${body}</div>` : body}</div>` });
          } else {
            all.push({ si, q, html: `<div class="psg">${head}</div>`, keepNext: true, gapAfter: 0, psg: true });
            chunks.forEach((c, k) => {
              const cls = q.box ? ` bxd${k === 0 ? " bx-first" : ""}${k === chunks.length - 1 ? " bx-last" : ""}` : "";
              all.push({ si, q, html: `<div class="psg${cls}">${c.html}</div>`, split: true, gapAfter: k === chunks.length - 1 ? null : 0, psg: true, boxed: !!q.box });
            });
          }
          return;
        }
        let label = null;
        if (showTypeLabels(meta) && q.type !== prevType) label = q.type === "mc" ? meta.mcLabel || "5지선다형" : meta.shortLabel || "단답형";
        prevType = q.type;
        all.push({ si, q, html: questionHtml(q, nums[q.id], meta, label) });
      });
    });
    const noticeH = [];
    const noticeHtmls = secs.map((sec, si) => noticeHtml(meta, secs[si + 1]));
    const measured = await measureBlocks(host, meta, geo.w, all.map((a) => a.html).concat(meta.showNotice ? noticeHtmls : []));
    if (meta.showNotice) noticeHtmls.forEach((h, k) => (noticeH[k] = measured[all.length + k]));

    // 2) 섹션별 배치
    const secPages = secs.map((sec, si) => {
      const items = [];
      all.forEach((a, k) => {
        if (a.si !== si) return;
        const first = k === 0 || all[k - 1].q !== a.q;
        items.push({
          id: a.q.id,
          h: measured[k].h,
          html: measured[k].html,
          cuts: measured[k].cuts,
          breakBefore: first ? a.q.breakBefore || "" : "",
          slots: a.q.slots || "",
          keepNext: a.keepNext,
          gapAfter: a.gapAfter,
          split: a.split,
          psg: a.psg,
          boxed: a.boxed,
        });
      });
      const pages = paginate(items, geo, meta, { notice: meta.showNotice ? noticeH[si] : null });
      pages.forEach((pg) =>
        pg.cols.forEach((l) =>
          l.forEach((e) => {
            if (e.over) warnings.push(nums[e.it.id] ? `${nums[e.it.id]}번 문항이 한 단보다 길어서 잘립니다. 그림을 줄이거나 내용을 나눠 주세요.` : `지문 안의 그림·표가 한 단보다 커서 잘립니다. 크기를 줄여 주세요.`);
          })
        )
      );
      return { sec, pages };
    });

    const total = secPages.reduce((s, x) => s + x.pages.length, 0);
    let g = 0;
    let lastLocal = 0;
    const out = [];
    secPages.forEach(({ sec, pages }, si) => {
      const restart = si === 0 || sec.restartPage !== false;
      let local = restart ? 0 : lastLocal;
      pages.forEach((pg) => {
        g++;
        local++;
        const hdr = pg.first ? headerFirst(meta, sec, local) : headerNormal(titleHtml(meta, sec), local);
        out.push(shell(meta, hdr, colsHtml(pg, false, selId), footer(g, total)));
      });
      lastLocal = local;
    });

    // 3) 정답표
    if (meta.answerPage) out.push(answerKeyPage(state, nums, secs));

    // 4) 해설
    if (meta.solutionPages) {
      const solItems = [];
      const solHtml = [];
      secs.forEach((sec) =>
        sec.questions.filter(isQ).forEach((q) => {
          const body = q.solution ? renderBody(q.solution, { images: q.images || {}, overlays: q.overlays || {}, bigInline: meta.bigInline }) : '<div class="p" style="color:#888">(해설 없음)</div>';
          solHtml.push(`<div class="sol"><div class="solhd">${nums[q.id]}. <span class="ans">[정답] ${esc(answerText(q)) || "—"}</span></div>${body}</div>`);
          solItems.push(q.id);
        })
      );
      if (solHtml.length) {
        const ms = await measureBlocks(host, meta, geo.w, solHtml);
        const items = ms.map((m, k) => ({ id: solItems[k], h: m.h, html: m.html }));
        const pages = paginate(items, geo, Object.assign({}, meta, { flowGap: 6 }), { forceFlow: true, firstHeader: false, hNormal: geo.h3 });
        const t = esc(meta.subject || "") + " 정답 및 해설";
        pages.forEach((pg) => out.push(shell(meta, headerNormal(t, null), colsHtml(pg, false, selId), "")));
      }
    }
    return { html: out.join(""), warnings, total, nums };
  }

  function answerKeyPage(state, nums, secs) {
    const meta = state.meta;
    let html = `<div class="key-title">정답 및 배점</div>`;
    secs.forEach((sec0) => {
      const sec = Object.assign({}, sec0, { questions: sec0.questions.filter(isQ) });
      if (!sec.questions.length) return;
      const name = sec.subtitle ? `${sec.name || ""} (${sec.subtitle})` : sec.name || "";
      const rows = [];
      for (let k = 0; k < sec.questions.length; k += 10) rows.push(sec.questions.slice(k, k + 10));
      const table = rows
        .map((r) => {
          const pad = (arr, f) => arr.map(f).concat(Array(10 - arr.length).fill("<td></td>")).join("");
          return (
            `<tr>${pad(r, (q) => `<th>${nums[q.id]}</th>`)}</tr>` +
            `<tr>${pad(r, (q) => `<td>${esc(answerText(q)) || "&nbsp;"}</td>`)}</tr>` +
            `<tr>${pad(r, (q) => `<td class="pt">${q.points ? esc(q.points) + "점" : ""}</td>`)}</tr>`
          );
        })
        .join("");
      const sum = sec.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
      html += `<div class="key-sec"><h3>${esc(name)} <span style="font-weight:400;font-size:10pt">· ${sec.questions.length}문항 · ${+sum.toFixed(2)}점</span></h3><table class="key">${table}</table></div>`;
    });
    return `<div class="page" style="${pageStyle(meta)}">${headerNormal(esc(meta.subject || "정답표"), null)}<div style="padding-top:4mm">${html}</div></div>`;
  }

  global.ExamLayout = { showTypeLabels, build, numbering, passageRanges, passageHeading, answerText, fmtPoints, isQ, geo: () => lastGeo };
})(window);
