/* =========================================================
   편집기 UI
   ========================================================= */
(function () {
  "use strict";
  const T = window.ExamTemplates;
  const L = window.ExamLayout;
  const { esc } = window.ExamMarkup;
  const KEY = "exam-maker:v1";
  const CIRC = ["①", "②", "③", "④", "⑤"];
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- 상태 ---------- */
  function normalize(d) {
    if (!d || !Array.isArray(d.sections)) throw new Error("시험지 파일 형식이 아닙니다.");
    d.version = 1;
    d.meta = Object.assign({}, T.baseMeta, d.meta || {});
    d.sections.forEach((s) => {
      const base = T.newSection();
      Object.keys(base).forEach((k) => {
        if (s[k] === undefined) s[k] = k === "questions" ? [] : base[k];
      });
      s.id = s.id || T.uid("s");
      s.questions = (s.questions || []).map((q) => {
        const nq = Object.assign(q.kind === "passage" ? T.newPassage() : T.newQuestion(), q);
        nq.id = q.id || T.uid("q");
        nq.overlays = nq.overlays || {};
        if (!Array.isArray(nq.choices)) nq.choices = ["", "", "", "", ""];
        while (nq.choices.length < 5) nq.choices.push("");
        nq.images = nq.images || {};
        return nq;
      });
    });
    return d;
  }

  function loadLocal() {
    try {
      const s = localStorage.getItem(KEY);
      return s ? normalize(JSON.parse(s)) : null;
    } catch (e) {
      return null;
    }
  }

  let state = loadLocal() || T.fromTemplate("sample-math");
  let selId = (state.sections[0] && state.sections[0].questions[0] && state.sections[0].questions[0].id) || null;
  let saveTimer = null;

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        setStatus("브라우저에 자동 저장됨 · " + new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
      } catch (e) {
        setStatus("브라우저 저장 공간이 부족해 자동 저장을 못 했습니다. [저장(.json)]으로 파일에 저장하세요.");
      }
    }, 400);
  }
  function setStatus(t) {
    $("#status").textContent = t;
  }

  function find(qid) {
    for (const sec of state.sections) {
      const idx = sec.questions.findIndex((q) => q.id === qid);
      if (idx >= 0) return { sec, idx, q: sec.questions[idx] };
    }
    return null;
  }

  function changed(opts) {
    persist();
    if (!opts || opts.list !== false) renderList();
    schedulePreview();
  }

  /* ---------- 문항 목록 ---------- */
  function snippet(text) {
    const first = String(text || "")
      .split("\n")
      .find((l) => l.trim() && !/^\[\/?[^\]]+\]$/.test(l.trim()));
    if (!first) return "";
    return first.replace(/\$/g, "").slice(0, 60);
  }

  function renderList() {
    const nums = L.numbering(state.sections);
    const ranges = L.passageRanges(state.sections, nums);
    let total = 0;
    const cards = state.sections
      .map((sec, si) => {
        const qs = sec.questions.filter(L.isQ);
        const sum = qs.reduce((s, q) => s + (Number(q.points) || 0), 0);
        if (sec.include !== false) total += sum;
        const items = sec.questions
          .map((q) => {
            const sn = snippet(q.text);
            if (!L.isQ(q)) {
              const r = ranges[q.id];
              return `<div class="qitem psg${q.id === selId ? " on" : ""}" data-qid="${q.id}" tabindex="0">
                <span class="n">지문</span>
                <span class="t${sn ? "" : " empty"}">${sn ? esc(sn) : "(비어 있음)"}</span>
                <span class="badges"><span class="badge psg">${r ? (r[0] === r[1] ? r[0] : r[0] + "~" + r[1]) : "문항 없음"}</span></span>
              </div>`;
            }
            const noAns = q.answer === "" || q.answer == null;
            return `<div class="qitem${q.id === selId ? " on" : ""}" data-qid="${q.id}" tabindex="0">
              <span class="n">${nums[q.id]}</span>
              <span class="t${sn ? "" : " empty"}">${sn ? esc(sn) : "(비어 있음)"}</span>
              <span class="badges"><span class="badge${q.type === "short" ? " short" : ""}">${q.type === "mc" ? "객관" : "단답"}</span><span class="badge">${esc(q.points)}점</span>${
                noAns ? '<span class="badge noans" title="정답 미입력">정답?</span>' : ""
              }</span>
            </div>`;
          })
          .join("");
        const nm = esc(sec.name || "묶음") + (sec.subtitle ? ` (${esc(sec.subtitle)})` : "");
        return `<div class="sec-card" data-si="${si}">
          <div class="sec-head"><span class="nm" title="${nm}">${nm}${sec.include === false ? ' <span class="badge">인쇄 제외</span>' : ""}</span><span class="sum">${qs.length}문항 · ${+sum.toFixed(2)}점</span></div>
          ${items}
          <div class="sec-foot"><button class="sm" data-add="mc" data-si="${si}" type="button">+ 객관식</button><button class="sm" data-add="short" data-si="${si}" type="button">+ 단답형</button><button class="sm" data-add="passage" data-si="${si}" type="button" title="국어처럼 여러 문항이 함께 보는 글">+ 지문</button></div>
        </div>`;
      })
      .join("");
    $("#pane-list").innerHTML =
      `<div class="total-line">인쇄 포함 묶음 총점 <b>${+total.toFixed(2)}점</b> <span class="muted">(선택과목 묶음이 여러 개면 함께 더해집니다)</span></div>` +
      cards +
      `<button type="button" id="btnAddSec" class="sm">+ 묶음(선택과목) 추가</button>`;
  }

  $("#pane-list").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      const sec = state.sections[+add.dataset.si];
      const last = sec.questions.filter(L.isQ).pop();
      const nq = add.dataset.add === "passage" ? T.newPassage() : T.newQuestion({ type: add.dataset.add, points: last ? last.points : 3 });
      sec.questions.push(nq);
      select(nq.id);
      changed();
      return;
    }
    if (e.target.id === "btnAddSec") {
      state.sections.push(T.newSection({ name: "선택", subtitle: "과목명", questions: [T.newQuestion()] }));
      changed();
      switchTab("meta");
      return;
    }
    const it = e.target.closest(".qitem");
    if (it) select(it.dataset.qid, { scrollPreview: true });
  });
  $("#pane-list").addEventListener("keydown", (e) => {
    const it = e.target.closest(".qitem");
    if (it && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      select(it.dataset.qid, { scrollPreview: true });
    }
  });

  function select(qid, opts) {
    selId = qid;
    $$(".qitem").forEach((el) => el.classList.toggle("on", el.dataset.qid === qid));
    $$("#pages .blk.sel").forEach((el) => el.classList.remove("sel"));
    const blk = $(`#pages .blk[data-qid="${qid}"]`);
    if (blk) {
      blk.classList.add("sel");
      if (opts && opts.scrollPreview) blk.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    const li = $(`.qitem[data-qid="${qid}"]`);
    if (li && opts && opts.scrollList) li.scrollIntoView({ block: "nearest" });
    renderEditor();
  }

  /* ---------- 문항 편집기 ---------- */
  const SNIPPETS = [
    ["분수", "\\frac{a}{b}"],
    ["루트", "\\sqrt{x}"],
    ["n제곱근", "\\sqrt[3]{x}"],
    ["극한", "\\lim_{x\\to 1}"],
    ["시그마", "\\sum_{k=1}^{n}"],
    ["적분", "\\int_{0}^{1} f(x)\\,dx"],
    ["로그", "\\log_{2}"],
    ["선분", "\\overline{AB}"],
    ["벡터", "\\overrightarrow{OP}"],
    ["절댓값", "\\left| x \\right|"],
    ["큰괄호", "\\left( \\right)"],
    ["경우나눔", "\\begin{cases} a_n+1 & (a_n\\le 0) \\\\ a_n-1 & (a_n>0) \\end{cases}"],
    ["≤", "\\le "],
    ["≥", "\\ge "],
    ["≠", "\\ne "],
    ["×", "\\times "],
    ["π", "\\pi"],
    ["θ", "\\theta"],
    ["∞", "\\infty"],
    ["→", "\\to "],
    ["각", "\\angle "],
    ["P(A)", "\\mathrm{P}(A)"],
    ["E(X)", "\\mathrm{E}(X)"],
    ["로마체", "\\mathrm{A}"],
  ];
  const SYMBOLS = ["㉠", "㉡", "㉢", "㉣", "㉤", "(가)", "(나)", "(다)", "(라)", "ㄱ.", "ㄴ.", "ㄷ.", "◦", "※", "①", "②", "③", "④", "⑤", "□", "△", "∼", "·", "…"];

  function renderEditor() {
    const ed = $("#editor");
    const f = selId && find(selId);
    if (!f) {
      ed.innerHTML = `<div class="empty-ed">왼쪽 목록에서 문항을 고르거나 [+ 객관식]으로 문항을 추가하세요.</div>`;
      return;
    }
    const { sec, q } = f;
    if (!L.isQ(q)) return renderPassageEditor(f);
    const nums = L.numbering(state.sections);
    const slotMode = state.meta.layout === "slots";
    const secName = esc(sec.name || "") + (sec.subtitle ? ` · ${esc(sec.subtitle)}` : "");
    const choiceRows = q.choices
      .slice(0, 5)
      .map(
        (c, i) => `<div class="choice-row"><span class="cn">${CIRC[i]}</span><input type="text" id="ch${i}" data-ch="${i}" value="${esc(c)}" placeholder="$\\frac{1}{2}$ 처럼 수식 가능"><input type="radio" name="ans" id="ans${i}" value="${i + 1}" ${
          Number(q.answer) === i + 1 ? "checked" : ""
        } title="정답으로 지정"></div>`
      )
      .join("");
    const imgs = imagesHtml(q);

    ed.innerHTML = `
      <div class="ed-head">
        <h2>${nums[q.id]}번<small>${secName}</small></h2>
        <button type="button" class="sm" data-act="up" title="위로">▲</button>
        <button type="button" class="sm" data-act="down" title="아래로">▼</button>
        <button type="button" class="sm" data-act="dup">복제</button>
        <button type="button" class="sm" data-act="insert">아래에 새 문항</button>
        <button type="button" class="sm danger" data-act="del">삭제</button>
      </div>
      <div class="row">
        <label class="field"><span>유형</span><select id="qType"><option value="mc"${q.type === "mc" ? " selected" : ""}>5지선다형</option><option value="short"${q.type === "short" ? " selected" : ""}>단답형</option></select></label>
        <label class="field"><span>배점</span><input id="qPts" type="number" min="0" step="0.5" value="${esc(q.points)}"></label>
        <label class="field"><span>시작 위치</span><select id="qBreak">
          <option value="">자동</option><option value="column"${q.breakBefore === "column" ? " selected" : ""}>다음 단에서</option><option value="page"${q.breakBefore === "page" ? " selected" : ""}>다음 쪽에서</option></select></label>
        ${
          slotMode
            ? `<label class="field"><span>차지하는 칸</span><select id="qSlots"><option value="">자동(높이 기준)</option>${Array.from({ length: Number(state.meta.slotsPerCol) || 2 }, (_, k) => `<option value="${k + 1}"${String(q.slots) === String(k + 1) ? " selected" : ""}>${k + 1}칸</option>`).join("")}<option value="all"${q.slots === "all" ? " selected" : ""}>단 전체</option></select></label>`
            : ""
        }
      </div>

      <div class="field"><span>문제 본문 <span class="muted" style="font-weight:400">— 배점 [n점]은 마지막 문장 끝에 자동으로 붙음</span></span></div>
      ${toolbarHtml(false)}
      <textarea id="qText" spellcheck="false">${esc(q.text)}</textarea>

      ${
        q.type === "mc"
          ? `<div class="field" style="margin-top:12px"><span>선택지 · 정답 (오른쪽 동그라미)</span></div>
             <div class="choice-grid">${choiceRows}</div>
             <div class="row" style="margin-top:6px">
               <button type="button" class="sm" id="fillBogi">ㄱㄴㄷ 조합 채우기</button>
               <button type="button" class="sm" id="fillNum">연속 정수 채우기</button>
               <button type="button" class="sm" id="wrapMath">모두 수식으로 감싸기</button>
             </div>`
          : `<label class="field" style="margin-top:12px"><span>정답</span><input type="text" id="qAns" value="${esc(q.answer)}" placeholder="예: 24"></label>`
      }

      <div class="field" style="margin-top:14px"><span>그림 <span class="muted" style="font-weight:400">— 본문에 [그림1 60%] [그림1 50% 오른쪽] 처럼 씀</span></span></div>
      <div class="imgs">${imgs || '<span class="muted">올린 그림 없음</span>'}</div>

      <label class="field" style="margin-top:14px"><span>해설 (해설지 페이지에 들어감)</span><textarea id="qSol" spellcheck="false">${esc(q.solution || "")}</textarea></label>
    `;
  }

  function toolbarHtml(passage) {
    return `<div class="toolbar" id="tb">
        <button type="button" data-w="$|$" title="선택한 글자를 수식으로">$수식$</button>
        <button type="button" data-blk="$$ | $$" title="한 줄 들여쓴 수식">줄 수식</button>
        <select id="snip" title="수식 조각 넣기"><option value="">수식 조각…</option>${SNIPPETS.map((s, i) => `<option value="${i}">${esc(s[0])}  ${esc(s[1])}</option>`).join("")}</select>
        <span class="sep"></span>
        <button type="button" data-blk="[조건]\n(가) |\n(나) \n[/조건]">조건 상자</button>
        <button type="button" data-blk="[보기]\nㄱ. |\nㄴ. \nㄷ. \n[/보기]">&lt;보기&gt;</button>
        <button type="button" data-blk="[박스 자료 제목]\n|\n[/박스]">자료 상자</button>
        <button type="button" data-blk="[표 머리]\n구분 | A | B\n| 1 | 2\n[/표]">표</button>
        <button type="button" data-blk="[나란히]\n|\n[|]\n\n[/나란히]">나란히</button>
        <button type="button" data-blk="[대화]\n갑: |\n을: \n[/대화]" title="갑·을 말풍선 대화">대화</button>
        <button type="button" id="btnImg" title="Ctrl+V로 캡처 이미지를 바로 붙여넣어도 됨">그림 올리기</button>
        <input type="file" id="imgFile" accept="image/*" hidden>
        <span class="sep"></span>
        <button type="button" data-w="**|**"><b>굵게</b></button>
        <button type="button" data-w="__|__"><u>밑줄</u></button>
        <button type="button" data-w="[[|]]" title="네모 칸 (빈칸 (가) 등)">[네모]</button>
        <button type="button" data-line="[가운데] ">가운데</button>
        <button type="button" data-line="[들여] ">들여쓰기</button>
        ${passage ? "" : `<button type="button" data-ins="[점수]" title="배점이 들어갈 위치를 직접 지정">배점 위치</button>`}
        <select id="sym" title="기호 넣기"><option value="">기호…</option>${SYMBOLS.map((s) => `<option>${esc(s)}</option>`).join("")}</select>
      </div>`;
  }

  function imagesHtml(q) {
    return Object.keys(q.images || {})
      .sort((a, b) => a - b)
      .map(
        (k) => `<div class="imgcard"><img src="${q.images[k]}" alt="그림 ${k}"><code>[그림${k}]</code><div class="row"><button class="sm" type="button" data-imgins="${k}">넣기</button><button class="sm" type="button" data-imgov="${k}" title="말풍선 채우기·글자 가리기·자르기">글 넣기</button><button class="sm danger" type="button" data-imgdel="${k}">삭제</button></div>${
          (q.overlays && q.overlays[k] && q.overlays[k].length) ? `<span class="muted">글상자 ${q.overlays[k].length}개</span>` : ""
        }</div>`
      )
      .join("");
  }

  function renderPassageEditor(f) {
    const { sec, q } = f;
    const nums = L.numbering(state.sections);
    const r = L.passageRanges(state.sections, nums)[q.id];
    const secName = esc(sec.name || "") + (sec.subtitle ? ` · ${esc(sec.subtitle)}` : "");
    const imgs = imagesHtml(q);
    $("#editor").innerHTML = `
      <div class="ed-head">
        <h2>지문 ${r ? (r[0] === r[1] ? `[${r[0]}]` : `[${r[0]}~${r[1]}]`) : ""}<small>${secName}</small></h2>
        <button type="button" class="sm" data-act="up" title="위로">▲</button>
        <button type="button" class="sm" data-act="down" title="아래로">▼</button>
        <button type="button" class="sm" data-act="dup">복제</button>
        <button type="button" class="sm" data-act="insert">아래에 새 문항</button>
        <button type="button" class="sm danger" data-act="del">삭제</button>
      </div>
      <p class="hint">지문은 번호 없이 바로 아래 문항들과 묶임. 목록에서 지문 뒤에 문항을 두면 머리말의 [1~3] 범위가 자동으로 계산됨. 단·쪽이 모자라면 글줄 단위로 끊어서 다음 단에 이어 실림 (밀집형 배치일 때).</p>
      <label class="field"><span>머리말 — {범위} 자리에 [1~3]이 들어감</span><input type="text" id="pHead" value="${esc(q.heading || "")}" placeholder="{범위} 다음 글을 읽고 물음에 답하시오."></label>
      <div class="row">
        <label class="field"><span>묶을 문항 수</span><input type="number" id="pCount" min="1" value="${esc(q.count)}" placeholder="다음 지문 전까지"></label>
        <label class="field"><span>시작 위치</span><select id="qBreak">
          <option value="">자동</option><option value="column"${q.breakBefore === "column" ? " selected" : ""}>다음 단에서</option><option value="page"${q.breakBefore === "page" ? " selected" : ""}>다음 쪽에서</option></select></label>
        <div class="field"><label class="check"><input type="checkbox" id="pIndent" ${q.indent !== false ? "checked" : ""}> 문단 첫 줄 들여쓰기</label><label class="check"><input type="checkbox" id="pBox" ${q.box ? "checked" : ""}> 지문을 상자로 감싸기</label></div>
      </div>
      <div class="field"><span>지문 <span class="muted" style="font-weight:400">— 한 줄 = 한 문단, 빈 줄 = 문단 사이 띄움(시의 연 구분 등). 시는 들여쓰기를 끄셈</span></span></div>
      ${toolbarHtml(true)}
      <textarea id="qText" spellcheck="false" style="min-height:360px">${esc(q.text)}</textarea>
      <div class="field" style="margin-top:14px"><span>그림</span></div>
      <div class="imgs">${imgs || '<span class="muted">올린 그림 없음</span>'}</div>
    `;
  }

  function insertText(ta, before, after, placeholder) {
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || placeholder || "";
    ta.setRangeText(before + sel + after, s, e, "end");
    if (!ta.value.slice(s, e) && placeholder !== undefined) {
      const pos = s + before.length;
      ta.setSelectionRange(pos, pos + sel.length);
    } else if (!sel) {
      const pos = s + before.length;
      ta.setSelectionRange(pos, pos);
    }
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function insideMath(ta) {
    const before = ta.value.slice(0, ta.selectionStart).replace(/\\\$/g, "");
    return (before.match(/\$/g) || []).length % 2 === 1;
  }

  const editor = $("#editor");
  editor.addEventListener("input", (e) => {
    const f = selId && find(selId);
    if (!f) return;
    const q = f.q;
    const t = e.target;
    if (t.id === "qText") q.text = t.value;
    else if (t.id === "qSol") q.solution = t.value;
    else if (t.id === "qPts") q.points = t.value === "" ? "" : Number(t.value);
    else if (t.id === "qAns") q.answer = t.value;
    else if (t.dataset.ch != null) q.choices[+t.dataset.ch] = t.value;
    else if (t.name === "ans") q.answer = Number(t.value);
    else if (t.id === "pHead") q.heading = t.value;
    else if (t.id === "pCount") q.count = t.value === "" ? "" : Number(t.value);
    else if (t.id === "pIndent") q.indent = t.checked;
    else if (t.id === "pBox") q.box = t.checked;
    else return;
    changed();
  });
  editor.addEventListener("change", (e) => {
    const f = selId && find(selId);
    if (!f) return;
    const q = f.q;
    const t = e.target;
    if (t.id === "qType") {
      q.type = t.value;
      if (q.type === "short" && typeof q.answer === "number") q.answer = "";
      renderEditor();
      changed();
    } else if (t.id === "qBreak") {
      q.breakBefore = t.value;
      changed();
    } else if (t.id === "qSlots") {
      q.slots = t.value;
      changed();
    } else if (t.id === "snip" && t.value !== "") {
      const ta = $("#qText");
      const sn = SNIPPETS[+t.value][1];
      if (insideMath(ta)) insertText(ta, sn, "");
      else insertText(ta, "$" + sn, "$");
      t.value = "";
    } else if (t.id === "sym" && t.value) {
      insertText($("#qText"), t.value, "");
      t.value = "";
    } else if (t.id === "imgFile" && t.files[0]) {
      addImage(q, t.files[0]);
    }
  });
  editor.addEventListener("click", (e) => {
    const f = selId && find(selId);
    if (!f) return;
    const { sec, idx, q } = f;
    const b = e.target.closest("button");
    if (!b) return;
    const ta = $("#qText");
    if (b.dataset.w) {
      const [a, c] = b.dataset.w.split("|");
      insertText(ta, a, c, "");
    } else if (b.dataset.blk) {
      const [a, c] = b.dataset.blk.split("|");
      const s = ta.selectionStart;
      const atLineStart = s === 0 || ta.value[s - 1] === "\n";
      insertText(ta, (atLineStart ? "" : "\n") + a, c + "\n", "");
    } else if (b.dataset.line) {
      const s = ta.selectionStart;
      const ls = ta.value.lastIndexOf("\n", s - 1) + 1;
      ta.setSelectionRange(ls, ls);
      insertText(ta, b.dataset.line, "");
    } else if (b.dataset.ins) {
      insertText(ta, b.dataset.ins, "");
    } else if (b.id === "btnImg") {
      $("#imgFile").click();
    } else if (b.dataset.imgins) {
      const s = ta.selectionStart;
      const atLineStart = s === 0 || ta.value[s - 1] === "\n";
      insertText(ta, (atLineStart ? "" : "\n") + `[그림${b.dataset.imgins} 60%]\n`, "");
    } else if (b.dataset.imgov) {
      openOverlay(q, b.dataset.imgov);
    } else if (b.dataset.imgdel) {
      delete q.images[b.dataset.imgdel];
      if (q.overlays) delete q.overlays[b.dataset.imgdel];
      renderEditor();
      changed();
    } else if (b.id === "fillBogi") {
      q.choices = ["ㄱ", "ㄴ", "ㄱ, ㄷ", "ㄴ, ㄷ", "ㄱ, ㄴ, ㄷ"];
      renderEditor();
      changed();
    } else if (b.id === "fillNum") {
      const first = parseInt(String(q.choices[0]).replace(/[^\d-]/g, ""), 10);
      const start = isFinite(first) ? first : 1;
      const second = parseInt(String(q.choices[1]).replace(/[^\d-]/g, ""), 10);
      const step = isFinite(second) && second !== start ? second - start : 1;
      q.choices = q.choices.map((_, i) => `$${start + step * i}$`);
      renderEditor();
      changed();
    } else if (b.id === "wrapMath") {
      q.choices = q.choices.map((c) => {
        const s = String(c).trim();
        return !s || s.includes("$") ? s : `$${s}$`;
      });
      renderEditor();
      changed();
    } else if (b.dataset.act) {
      const act = b.dataset.act;
      if (act === "up" || act === "down") {
        const j = act === "up" ? idx - 1 : idx + 1;
        if (j >= 0 && j < sec.questions.length) {
          sec.questions.splice(idx, 1);
          sec.questions.splice(j, 0, q);
        } else {
          // 묶음 경계를 넘어 이동
          const si = state.sections.indexOf(sec);
          const tsi = act === "up" ? si - 1 : si + 1;
          if (tsi < 0 || tsi >= state.sections.length) return;
          sec.questions.splice(idx, 1);
          const ts = state.sections[tsi];
          if (act === "up") ts.questions.push(q);
          else ts.questions.unshift(q);
        }
        renderEditor();
        changed();
      } else if (act === "dup" || act === "insert") {
        const nq = act === "dup" ? JSON.parse(JSON.stringify(q)) : T.newQuestion(L.isQ(q) ? { type: q.type, points: q.points } : {});
        nq.id = T.uid("q");
        sec.questions.splice(idx + 1, 0, nq);
        selId = nq.id;
        renderEditor();
        changed();
      } else if (act === "del") {
        if (b.dataset.armed !== "1") {
          b.dataset.armed = "1";
          b.textContent = "정말 삭제?";
          setTimeout(() => {
            if (b.isConnected) {
              b.dataset.armed = "";
              b.textContent = "삭제";
            }
          }, 2500);
          return;
        }
        sec.questions.splice(idx, 1);
        const nb = sec.questions[idx] || sec.questions[idx - 1];
        selId = nb ? nb.id : null;
        renderEditor();
        changed();
      }
    }
  });

  // 캡처한 그림을 Ctrl+V로 바로 붙여넣기
  editor.addEventListener("paste", (e) => {
    const f = selId && find(selId);
    if (!f || !e.clipboardData) return;
    const file = Array.from(e.clipboardData.files || []).find((x) => x.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    addImage(f.q, file);
  });

  function figWidthPct(q, k) {
    const m = String(q.text || "").match(new RegExp("\\[그림\\s*" + k + "(?:\\s+[^\\]]*?)?(\\d{1,3})%"));
    return m ? Number(m[1]) : 70;
  }

  function openOverlay(q, k) {
    const geo = L.geo();
    const colW = geo ? geo.w : 300;
    window.OverlayEditor.open({
      key: k,
      src: q.images[k],
      overlays: (q.overlays && q.overlays[k]) || [],
      widthPx: (colW * figWidthPct(q, k)) / 100,
      fontSize: Number(state.meta.fontSize) || 8.5,
      onChange: (list) => {
        q.overlays = q.overlays || {};
        q.overlays[k] = list;
        changed({ list: false });
      },
      onCrop: (src) => {
        q.images[k] = src;
        renderEditor();
        changed({ list: false });
      },
    });
  }

  function addImage(q, file) {
    const reader = new FileReader();
    reader.onload = () => {
      shrinkImage(reader.result, 1400).then((url) => {
        const keys = Object.keys(q.images || {}).map(Number);
        const k = keys.length ? Math.max(...keys) + 1 : 1;
        q.images[k] = url;
        const ta = $("#qText");
        const s = ta ? ta.selectionStart : 0;
        renderEditor();
        const ta2 = $("#qText");
        ta2.setSelectionRange(s, s);
        const atLineStart = s === 0 || ta2.value[s - 1] === "\n";
        insertText(ta2, (atLineStart ? "" : "\n") + `[그림${k} 60%]\n`, "");
        changed();
      });
    };
    reader.readAsDataURL(file);
  }

  // 너무 큰 사진은 줄여서 저장 (PNG 투명 배경 유지, 사진은 JPEG)
  function shrinkImage(url, maxW) {
    return new Promise((res) => {
      const im = new Image();
      im.onload = () => {
        if (im.naturalWidth <= maxW) return res(url);
        const c = document.createElement("canvas");
        c.width = maxW;
        c.height = Math.round((im.naturalHeight * maxW) / im.naturalWidth);
        const ctx = c.getContext("2d");
        const png = url.startsWith("data:image/png");
        if (!png) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.drawImage(im, 0, 0, c.width, c.height);
        res(png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.9));
      };
      im.onerror = () => res(url);
      im.src = url;
    });
  }

  /* ---------- 시험 정보 ---------- */
  function renderMeta() {
    const m = state.meta;
    const txt = (k, label, ph) => `<label class="field"><span>${label}</span><input type="text" data-k="${k}" value="${esc(m[k] ?? "")}" placeholder="${esc(ph || "")}"></label>`;
    const num = (k, label, step, min, max) => `<label class="field"><span>${label}</span><input type="number" data-k="${k}" data-num="1" value="${esc(m[k])}" step="${step}" min="${min}" max="${max}"></label>`;
    const chk = (k, label) => `<label class="check"><input type="checkbox" data-k="${k}" ${m[k] ? "checked" : ""}> ${label}</label>`;
    const secs = state.sections
      .map(
        (s, si) => `<fieldset data-si="${si}"><legend>묶음 ${si + 1}</legend>
        <div class="row">
          <label class="field"><span>이름(목록용)</span><input type="text" data-sk="name" value="${esc(s.name)}"></label>
          <label class="field"><span>선택과목명</span><input type="text" data-sk="subtitle" value="${esc(s.subtitle)}" placeholder="예: 확률과 통계"></label>
        </div>
        <div class="row">
          <label class="field"><span>시작 번호</span><input type="number" data-sk="startNo" value="${esc(s.startNo)}" placeholder="이어서" min="1"></label>
          <div class="field" style="flex:2">
            <label class="check"><input type="checkbox" data-sk="include" ${s.include !== false ? "checked" : ""}> 인쇄에 포함</label>
            <label class="check"><input type="checkbox" data-sk="restartPage" ${s.restartPage !== false ? "checked" : ""}> 쪽 번호 1부터</label>
          </div>
        </div>
        <div class="row" style="margin-bottom:6px">
          <button type="button" class="sm" data-smove="-1">▲</button><button type="button" class="sm" data-smove="1">▼</button>
          <button type="button" class="sm danger" data-sdel="1">묶음 삭제</button>
        </div>
      </fieldset>`
      )
      .join("");

    $("#pane-meta").innerHTML = `
      <fieldset><legend>머리글</legend>
        ${txt("examTitle", "시험 이름 (맨 위 한 줄)", "2027학년도 대학수학능력시험 6월 모의평가 문제지")}
        <div class="row">${txt("period", "교시", "제 2 교시")}${txt("typeMark", "형(선택)", "홀수형")}</div>
        ${txt("subject", "영역 이름", "수학 영역")}
        <p class="hint">선택과목명은 아래 묶음 설정에 쓰면 "수학 영역(확률과 통계)" 처럼 붙습니다.</p>
        ${chk("showNameRow", "성명 · 수험번호 칸 표시 (학평 스타일)")}
        <div class="row">${num("idDigits", "수험번호 칸 수", 1, 0, 14)}${num("idDash", "몇 번째 칸 뒤에 '-'", 1, 0, 14)}</div>
        ${chk("showSelectBox", "'제 [ ] 선택' 칸 표시")}
      </fieldset>
      <fieldset><legend>배치</legend>
        <label class="field"><span>문항 배치 방식</span><select data-k="layout">
          <option value="slots"${m.layout === "slots" ? " selected" : ""}>풀이 공간형 (수학 · 단을 칸으로 나눔)</option>
          <option value="flow"${m.layout === "flow" ? " selected" : ""}>밀집형 (탐구 · 국어 · 이어서 채움)</option></select></label>
        ${m.layout === "slots" ? num("slotsPerCol", "한 단의 칸 수 (평가원 수학은 2)", 1, 1, 6) : `${num("flowGap", "문항 사이 최소 간격 (mm)", 1, 0, 40)}${chk("justify", "꽉 찬 단은 남는 공간을 문항 사이에 고르게 나눔")}`}
        <label class="field"><span>인쇄 용지</span><select data-k="paper">${["A4", "B4", "A3"].map((p) => `<option${m.paper === p ? " selected" : ""}>${p}</option>`).join("")}</select></label>
        <p class="hint">조판은 A4 기준으로 하고, B4·A3을 고르면 같은 배치를 그대로 확대해서 인쇄합니다. 평가원 배포 PDF는 A3 크기.</p>
        <div class="row">${num("fontSize", "본문 글자 크기 (pt, A4 기준)", 0.5, 6, 14)}${num("lineHeight", "줄 간격 (배)", 0.02, 1.2, 2.4)}</div>
        ${chk("bigInline", "본문 안 수식도 크게 (분수·시그마를 평가원처럼 크게)")}
      </fieldset>
      <fieldset><legend>표기</legend>
        ${chk("showTwoPoint", "2점 문항에도 [2점] 표시 (수학은 표시, 탐구는 보통 생략)")}
        ${chk("autoTypeLabel", "유형이 바뀌는 곳에 '5지선다형 / 단답형' 표시")}
        <div class="row">${txt("mcLabel", "객관식 라벨")}${txt("shortLabel", "단답형 라벨")}</div>
        ${chk("showNotice", "묶음 끝에 '＊ 확인 사항' 상자")}
        ${chk("answerPage", "맨 뒤에 정답표 쪽 추가")}
        ${chk("solutionPages", "맨 뒤에 해설 쪽 추가")}
      </fieldset>
      <h3 style="font-size:13px;margin:4px 0 8px">묶음 (공통 / 선택과목)</h3>
      ${secs}
      <button type="button" class="sm" id="btnAddSec2">+ 묶음 추가</button>
    `;
  }

  $("#pane-meta").addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.k) {
      const k = t.dataset.k;
      if (t.type === "checkbox") state.meta[k] = t.checked;
      else if (t.dataset.num) state.meta[k] = t.value === "" ? "" : Number(t.value);
      else state.meta[k] = t.value;
      if (k === "paper") applyPaper();
      if (k === "layout") {
        renderMeta();
        renderEditor();
      }
      changed({ list: false });
      return;
    }
    if (t.dataset.sk) {
      const sec = state.sections[+t.closest("fieldset").dataset.si];
      const k = t.dataset.sk;
      if (t.type === "checkbox") sec[k] = t.checked;
      else if (k === "startNo") sec[k] = t.value === "" ? "" : Number(t.value);
      else sec[k] = t.value;
      changed();
      if (k === "startNo") renderEditor();
    }
  });
  $("#pane-meta").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "btnAddSec2") {
      state.sections.push(T.newSection({ name: "선택", subtitle: "과목명", questions: [T.newQuestion()] }));
      renderMeta();
      changed();
      return;
    }
    const fs = b.closest("fieldset");
    if (!fs) return;
    const si = +fs.dataset.si;
    if (b.dataset.smove) {
      const j = si + Number(b.dataset.smove);
      if (j < 0 || j >= state.sections.length) return;
      const [s] = state.sections.splice(si, 1);
      state.sections.splice(j, 0, s);
    } else if (b.dataset.sdel) {
      if (b.dataset.armed !== "1") {
        b.dataset.armed = "1";
        b.textContent = `${state.sections[si].questions.length}문항까지 삭제?`;
        return;
      }
      state.sections.splice(si, 1);
      if (!state.sections.length) state.sections.push(T.newSection({ questions: [T.newQuestion()] }));
      if (!find(selId)) selId = state.sections[0].questions[0] ? state.sections[0].questions[0].id : null;
      renderEditor();
    }
    renderMeta();
    changed();
  });

  /* ---------- 문법 도움말 ---------- */
  function renderHelp() {
    const rows = [
      ["$x^2+1$", "수식 (LaTeX). 달러 자체는 \\$"],
      ["$$ \\lim_{x\\to 1}f(x)=3 $$", "한 줄 들여쓴 수식. '$$가운데 ...$$' 는 가운데"],
      ["줄바꿈", "엔터 한 번 = 시험지에서도 줄바꿈. 빈 줄 = 문단 간격"],
      ["**굵게**  __밑줄__", "예: 옳지 __않은__ 것은?"],
      ["[[(가)]]", "네모 칸 안 글자 (빈칸 표시)"],
      ["(가) …  ㄱ. …  ㉠ …  ◦ …", "줄 맨 앞에 쓰면 내어쓰기 정렬"],
      ["[가운데] …  [오른쪽] …  [들여] …", "그 줄 정렬"],
      ["[조건] … [/조건]", "조건 상자 (가)(나)"],
      ["[보기] … [/보기]", "&lt;보 기&gt; 상자. [보기 자료] 처럼 제목 변경"],
      ["[박스 제목] … [/박스]", "자료 상자. 제목 생략 가능. [둥근박스]도 있음"],
      ["[표 머리 전체] … [/표]", "칸은 | 로 구분. 머리=첫 줄 음영, 전체=폭 100%, !칸=음영, {2}칸=2칸 병합, {1x2}=세로 2칸 병합, ^=병합된 자리"],
      ["[그림1 60% 오른쪽 설명]", "올린 그림. 폭%, 정렬(왼쪽/가운데/오른쪽), 뒤 글자는 캡션"],
      ["[나란히] A [|] B [/나란히]", "그림·표·상자를 옆으로 나란히"],
      ["[대화] 갑: … / 을: … [/대화]", "말풍선 대화. [대화 교대]는 좌우 번갈아"],
      ["그림 → [글 넣기]", "실제 시험지 그림의 말풍선에 글상자 채우기, 흰 가리개로 원래 글 지우기, 자르기. 캡처는 Ctrl+V로 바로 붙여넣기"],
      ["[+ 지문]", "국어식 지문. 한 줄 = 한 문단, 뒤 문항 번호로 [1~3] 자동, 단이 모자라면 줄 단위로 이어 실음"],
      ["[점수]", "배점 [3점]이 들어갈 자리 직접 지정 (안 쓰면 마지막 문장 끝)"],
    ];
    $("#pane-help").innerHTML = `
      <h3>본문 작성 문법</h3>
      <table>${rows.map((r) => `<tr><td><code>${esc(r[0])}</code></td><td>${r[1]}</td></tr>`).join("")}</table>
      <h3>예시</h3>
<pre>최고차항의 계수가 $1$인 이차함수 $f(x)$가
다음 조건을 만족시킬 때, $f(4)$의 값을 구하시오.
[조건]
(가) $f(1)=f(3)$
(나) $f(0)=5$
[/조건]</pre>
      <h3>인쇄 · PDF</h3>
      <p class="hint" style="margin:0">[인쇄 · PDF] → 대상 'PDF로 저장', 용지 A4, 여백 '없음', 배율 100%, '배경 그래픽' 켜기. 한글(HWP)이 설치된 PC면 한양신명조·HY견고딕 글꼴이 자동으로 쓰여서 실제 시험지와 더 비슷해짐.</p>
      <h3>단축키</h3>
      <p class="hint" style="margin:0">Ctrl+S 파일로 저장 · Alt+↑/↓ 이전/다음 문항</p>
    `;
  }

  /* ---------- 미리보기 ---------- */
  let pvTimer = null;
  let buildSeq = 0;
  let building = null;
  function schedulePreview(delay) {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(buildPreview, delay == null ? 280 : delay);
  }
  // 실측용 숨은 영역을 같이 쓰므로 조판은 한 번에 하나씩만 돌림
  let chain = Promise.resolve();
  function buildPreview() {
    const my = ++buildSeq;
    chain = chain.then(async () => {
      if (my !== buildSeq) return; // 더 새로운 요청이 대기 중이면 건너뜀
      try {
        const preview = $("#preview");
        const st = preview.scrollTop;
        const res = await L.build(state, $("#measure"), selId);
        $("#pages").innerHTML = res.html;
        preview.scrollTop = st;
        $("#pvInfo").textContent = `시험지 ${res.total}쪽` + (state.meta.answerPage || state.meta.solutionPages ? " + 정답/해설" : "");
        const w = $("#warnings");
        const uniq = Array.from(new Set(res.warnings));
        w.hidden = !uniq.length;
        w.innerHTML = uniq.map((x) => `<div>⚠ ${esc(x)}</div>`).join("");
      } catch (err) {
        console.error(err);
        setStatus("미리보기 오류: " + err.message);
      }
    });
    building = chain;
    return chain;
  }

  $("#pages").addEventListener("click", (e) => {
    const blk = e.target.closest(".blk[data-qid]");
    if (blk) {
      switchTab("list");
      select(blk.dataset.qid, { scrollList: true });
    }
  });

  const zoom = $("#zoom");
  function applyZoom() {
    $("#pages").style.zoom = zoom.value / 100;
    $("#zoomVal").textContent = zoom.value + "%";
    try {
      localStorage.setItem(KEY + ":zoom", zoom.value);
    } catch (e) {}
  }
  try {
    const z = localStorage.getItem(KEY + ":zoom");
    if (z) zoom.value = z;
  } catch (e) {}
  zoom.addEventListener("input", applyZoom);
  applyZoom();

  /* ---------- 탭 ---------- */
  function switchTab(name) {
    $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
    $$(".tabpane").forEach((p) => (p.hidden = p.id !== "pane-" + name));
    if (name === "meta") renderMeta();
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

  /* ---------- 파일 ---------- */
  function download(name, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }
  function saveFile() {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const name = `${(state.meta.subject || "시험지").replace(/[\\/:*?"<>|\s]+/g, "_")}_${stamp}.json`;
    download(name, JSON.stringify(state, null, 1));
    setStatus(name + " 저장");
  }
  $("#btnSave").addEventListener("click", saveFile);
  $("#btnOpen").addEventListener("click", () => $("#fileOpen").click());
  $("#fileOpen").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        state = normalize(JSON.parse(r.result));
        selId = state.sections[0] && state.sections[0].questions[0] ? state.sections[0].questions[0].id : null;
        refreshAll();
        setStatus(f.name + " 불러옴");
      } catch (err) {
        setStatus("불러오기 실패: " + err.message);
      }
      e.target.value = "";
    };
    r.readAsText(f);
  });
  $("#btnPrint").addEventListener("click", async () => {
    clearTimeout(pvTimer);
    await buildPreview();
    window.print();
  });

  $("#btnNew").addEventListener("click", () => {
    $("#tplList").innerHTML = T.TEMPLATES.map((t) => `<button type="button" class="tpl" data-tpl="${t.id}"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join("");
    $("#dlgNew").showModal();
  });
  $("#tplList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tpl]");
    if (!b) return;
    state = T.fromTemplate(b.dataset.tpl);
    selId = state.sections[0].questions[0] ? state.sections[0].questions[0].id : null;
    $("#dlgNew").close();
    refreshAll();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveFile();
    }
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      const ids = state.sections.flatMap((s) => s.questions.map((q) => q.id));
      const i = ids.indexOf(selId);
      const j = e.key === "ArrowUp" ? i - 1 : i + 1;
      if (j >= 0 && j < ids.length) {
        e.preventDefault();
        select(ids[j], { scrollPreview: true, scrollList: true });
      }
    }
  });

  // 글꼴이 늦게 도착하면 다시 조판
  if (document.fonts) document.fonts.addEventListener("loadingdone", () => schedulePreview(150));

  const PAPER = { A4: 1, B4: 257 / 210, A3: 297 / 210 };
  function applyPaper() {
    let el = document.getElementById("paperStyle");
    if (!el) {
      el = document.createElement("style");
      el.id = "paperStyle";
      document.head.appendChild(el);
    }
    const p = PAPER[state.meta.paper] ? state.meta.paper : "A4";
    el.textContent = `@page { size: ${p}; margin: 0; } @media print { #pages .page { zoom: ${PAPER[p]}; } }`;
  }

  function refreshAll() {
    applyPaper();
    renderList();
    renderEditor();
    if (!$("#pane-meta").hidden) renderMeta();
    persist();
    schedulePreview(0);
  }

  renderHelp();
  refreshAll();
  window.__examMaker = { get state() { return state; }, buildPreview, whenBuilt: () => building };
})();
