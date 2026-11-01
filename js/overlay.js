/* =========================================================
   그림 위 글상자 편집기
   - 실제 시험지 그림(학생 대화 장면 등)을 올리고 말풍선 안에 글을 채움
   - 흰 가리개로 원래 글자를 지우고, 그림을 잘라낼 수도 있음
   좌표는 모두 그림 크기에 대한 % 라서 그림 폭을 바꿔도 위치가 유지됨
   ========================================================= */
(function (global) {
  "use strict";
  const { overlaysHtml, esc } = global.ExamMarkup;
  const $ = (s, r) => (r || document).querySelector(s);

  let st = null; // { src, list, widthPx, fontSize, onChange, onCrop, sel, crop, scale }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v) => Math.round(v * 10) / 10;

  function open(opts) {
    st = Object.assign({ sel: -1, crop: false }, opts);
    st.list = (opts.overlays || []).map((o) => Object.assign({}, o));
    const dlg = $("#dlgOv");
    $("#ovTitle").textContent = `그림${opts.key}에 글 넣기`;
    dlg.showModal();
    renderStage();
    renderSide();
  }

  function emit() {
    if (st && st.onChange) st.onChange(st.list.map((o) => Object.assign({}, o)));
  }

  function renderStage() {
    const wrap = $("#ovWrap");
    const scaler = $("#ovScaler");
    const stage = $("#ovStage");
    const W = st.widthPx;
    const avail = Math.max(260, wrap.clientWidth - 24);
    st.scale = clamp(avail / W, 1, 3.2);
    stage.style.cssText = `--fs:${st.fontSize}pt;width:${W}px;height:auto;padding:0;display:block;overflow:visible;box-shadow:none`;
    stage.innerHTML = `<span class="figbox" style="width:${W}px;display:block"><img src="${st.src}" alt="" draggable="false">${st.list
      .map((o, i) => overlaysHtml([o], {}).replace('<div class="ov"', `<div class="ov ove${i === st.sel ? " on" : ""}${o.bg === "white" && !String(o.text || "").trim() ? " eraser" : ""}" data-i="${i}"`).replace(/<\/div>$/, '<span class="rh" title="크기 조절"></span></div>'))
      .join("")}<div class="crop-rect" hidden></div></span>`;
    scaler.style.transform = `scale(${st.scale})`;
    const img = stage.querySelector("img");
    const fit = () => {
      scaler.parentElement.style.height = stage.offsetHeight * st.scale + "px";
      scaler.parentElement.style.width = W * st.scale + "px";
    };
    if (img.complete) fit();
    else img.onload = fit;
    stage.classList.toggle("cropping", st.crop);
  }

  function selected() {
    return st.sel >= 0 ? st.list[st.sel] : null;
  }

  function renderSide() {
    const o = selected();
    const side = $("#ovSide");
    const tools = `
      <div class="row">
        <button type="button" class="sm" data-ov="add">+ 글상자</button>
        <button type="button" class="sm" data-ov="eraser" title="원래 그림의 글자를 흰색으로 덮음">+ 흰 가리개</button>
        <button type="button" class="sm${st.crop ? " primary" : ""}" data-ov="crop">${st.crop ? "자를 영역을 끌어서 선택…" : "그림 자르기"}</button>
      </div>
      <p class="hint" style="margin:8px 0 12px">그림에서 빈 곳을 <b>두 번 클릭</b>하면 그 자리에 글상자가 생김. 상자는 끌어서 옮기고 오른쪽 아래 모서리로 크기 조절.</p>`;
    if (!o) {
      side.innerHTML = tools + `<p class="muted">글상자를 고르면 여기서 글과 모양을 바꿀 수 있음.</p>`;
      return;
    }
    const seg = (key, val, label) => `<button type="button" class="sm${o[key] === val || (!o[key] && val === "center") ? " primary" : ""}" data-set="${key}" data-val="${val}">${label}</button>`;
    side.innerHTML =
      tools +
      `<label class="field"><span>글 (줄바꿈 그대로, $수식$·**굵게**·__밑줄__ 가능)</span><textarea id="ovText" rows="5" spellcheck="false">${esc(o.text || "")}</textarea></label>
      <div class="row">
        <label class="field"><span>글자 크기 (pt)</span><input type="number" id="ovSize" step="0.5" min="4" max="30" value="${esc(o.size || st.fontSize)}"></label>
        <label class="field"><span>줄 간격</span><input type="number" id="ovLh" step="0.05" min="0.9" max="2.5" value="${esc(o.lh || 1.38)}"></label>
      </div>
      <div class="field"><span>가로 정렬</span><div class="row">${seg("align", "left", "왼쪽")}${seg("align", "center", "가운데")}${seg("align", "right", "오른쪽")}</div></div>
      <div class="field"><span>세로 정렬</span><div class="row">${seg("valign", "top", "위")}${seg("valign", "center", "가운데")}${seg("valign", "bottom", "아래")}</div></div>
      <label class="check"><input type="checkbox" id="ovBg" ${o.bg === "white" ? "checked" : ""}> 바탕을 흰색으로 (원래 글자 가리기)</label>
      <div class="row" style="margin-top:10px">
        <button type="button" class="sm" data-ov="dup">복제</button>
        <button type="button" class="sm danger" data-ov="del">삭제</button>
      </div>`;
  }

  function addBox(x, y, eraser) {
    const o = eraser
      ? { x: round(clamp(x - 10, 0, 80)), y: round(clamp(y - 6, 0, 88)), w: 20, h: 12, text: "", bg: "white" }
      : { x: round(clamp(x - 15, 0, 70)), y: round(clamp(y - 8, 0, 84)), w: 30, h: 16, text: "글을 입력", size: st.fontSize, align: "center", valign: "center", bg: "" };
    st.list.push(o);
    st.sel = st.list.length - 1;
    renderStage();
    renderSide();
    emit();
    if (!eraser) {
      const ta = $("#ovText");
      if (ta) {
        ta.focus();
        ta.select();
      }
    }
  }

  function pctFromEvent(e) {
    const r = $("#ovStage .figbox").getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100, r };
  }

  /* ---------- 끌기 ---------- */
  let drag = null;
  function onDown(e) {
    if (!st || e.button !== 0) return;
    const p = pctFromEvent(e);
    if (st.crop) {
      drag = { mode: "crop", x0: clamp(p.x, 0, 100), y0: clamp(p.y, 0, 100) };
      e.target.setPointerCapture && $("#ovStage").setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const box = e.target.closest(".ove");
    if (!box) {
      if (st.sel !== -1) {
        st.sel = -1;
        renderStage();
        renderSide();
      }
      return;
    }
    const i = +box.dataset.i;
    if (st.sel !== i) {
      st.sel = i;
      renderSide();
      document.querySelectorAll("#ovStage .ove").forEach((el) => el.classList.toggle("on", +el.dataset.i === i));
    }
    const o = st.list[i];
    drag = { mode: e.target.classList.contains("rh") ? "resize" : "move", i, px: p.x, py: p.y, o0: Object.assign({}, o), el: box };
    $("#ovStage").setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag) return;
    const p = pctFromEvent(e);
    if (drag.mode === "crop") {
      const cr = $("#ovStage .crop-rect");
      const x1 = clamp(p.x, 0, 100);
      const y1 = clamp(p.y, 0, 100);
      Object.assign(drag, { x1, y1 });
      cr.hidden = false;
      cr.style.cssText = `left:${Math.min(drag.x0, x1)}%;top:${Math.min(drag.y0, y1)}%;width:${Math.abs(x1 - drag.x0)}%;height:${Math.abs(y1 - drag.y0)}%`;
      return;
    }
    const o = st.list[drag.i];
    const dx = p.x - drag.px;
    const dy = p.y - drag.py;
    if (drag.mode === "move") {
      o.x = round(clamp(drag.o0.x + dx, -5, 100 - Math.min(o.w, 100) + 5));
      o.y = round(clamp(drag.o0.y + dy, -5, 100 - Math.min(o.h, 100) + 5));
    } else {
      o.w = round(clamp(drag.o0.w + dx, 2, 105 - o.x));
      o.h = round(clamp(drag.o0.h + dy, 2, 105 - o.y));
    }
    drag.el.style.left = o.x + "%";
    drag.el.style.top = o.y + "%";
    drag.el.style.width = o.w + "%";
    drag.el.style.height = o.h + "%";
    drag.moved = true;
  }
  function onUp() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.mode === "crop") {
      if (d.x1 == null || Math.abs(d.x1 - d.x0) < 2 || Math.abs(d.y1 - d.y0) < 2) {
        $("#ovStage .crop-rect").hidden = true;
        return;
      }
      applyCrop(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      return;
    }
    if (d.moved) emit();
  }

  function applyCrop(cx, cy, cw, ch) {
    const im = new Image();
    im.onload = () => {
      const sx = (im.naturalWidth * cx) / 100;
      const sy = (im.naturalHeight * cy) / 100;
      const sw = (im.naturalWidth * cw) / 100;
      const sh = (im.naturalHeight * ch) / 100;
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(sw));
      c.height = Math.max(1, Math.round(sh));
      const ctx = c.getContext("2d");
      const png = /^data:image\/(png|svg)/.test(st.src);
      if (!png) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
      st.src = png ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.92);
      // 글상자 위치를 잘린 그림 기준으로 다시 계산
      st.list = st.list.map((o) =>
        Object.assign({}, o, {
          x: round(((o.x - cx) / cw) * 100),
          y: round(((o.y - cy) / ch) * 100),
          w: round((o.w / cw) * 100),
          h: round((o.h / ch) * 100),
        })
      );
      st.crop = false;
      if (st.onCrop) st.onCrop(st.src);
      emit();
      renderStage();
      renderSide();
    };
    im.src = st.src;
  }

  function bind() {
    const stage = $("#ovStage");
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    stage.addEventListener("dblclick", (e) => {
      if (!st || st.crop || e.target.closest(".ove")) return;
      const p = pctFromEvent(e);
      addBox(p.x, p.y, false);
    });

    const side = $("#ovSide");
    side.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !st) return;
      const o = selected();
      if (b.dataset.ov === "add") addBox(50, 30, false);
      else if (b.dataset.ov === "eraser") addBox(50, 30, true);
      else if (b.dataset.ov === "crop") {
        st.crop = !st.crop;
        st.sel = -1;
        renderStage();
        renderSide();
      } else if (b.dataset.ov === "del" && o) {
        st.list.splice(st.sel, 1);
        st.sel = -1;
        renderStage();
        renderSide();
        emit();
      } else if (b.dataset.ov === "dup" && o) {
        st.list.push(Object.assign({}, o, { x: round(o.x + 3), y: round(o.y + 3) }));
        st.sel = st.list.length - 1;
        renderStage();
        renderSide();
        emit();
      } else if (b.dataset.set && o) {
        o[b.dataset.set] = b.dataset.val;
        renderStage();
        renderSide();
        emit();
      }
    });
    side.addEventListener("input", (e) => {
      const o = selected();
      if (!o) return;
      const t = e.target;
      if (t.id === "ovText") o.text = t.value;
      else if (t.id === "ovSize") o.size = Number(t.value) || st.fontSize;
      else if (t.id === "ovLh") o.lh = Number(t.value) || 1.38;
      else if (t.id === "ovBg") o.bg = t.checked ? "white" : "";
      else return;
      renderStage();
      emit();
    });
    $("#ovDone").addEventListener("click", () => $("#dlgOv").close());
    $("#dlgOv").addEventListener("close", () => {
      st = null;
      drag = null;
    });
    document.addEventListener("keydown", (e) => {
      if (!st || !$("#dlgOv").open) return;
      const o = selected();
      if (!o || ["TEXTAREA", "INPUT"].includes(document.activeElement.tagName)) return;
      const step = e.shiftKey ? 2 : 0.5;
      const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (mv) {
        o.x = round(o.x + mv[0]);
        o.y = round(o.y + mv[1]);
        renderStage();
        emit();
        e.preventDefault();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        st.list.splice(st.sel, 1);
        st.sel = -1;
        renderStage();
        renderSide();
        emit();
        e.preventDefault();
      }
    });
    window.addEventListener("resize", () => st && $("#dlgOv").open && renderStage());
  }

  bind();
  global.OverlayEditor = { open };
})(window);
