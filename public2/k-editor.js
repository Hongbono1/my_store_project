// public/js/k-editor.js
// 한글 특화 에디터 모듈 (콘솔로그 유지/강화)
// 사용법:
// import { createKEditor } from "/js/k-editor.js";
// const editor = createKEditor({
//   root: document.getElementById("customEditor"),
//   toolbar: { buttons: ..., selects: ... },
//   uploadEndpoint: "/upload/image"
// });
// editor.getHTML();

export function createKEditor(options) {
    console.log("[KEditor] init options:", options);
    const root = options?.root;
    if (!root) throw new Error("[KEditor] root element required");

    const uploadEndpoint = options?.uploadEndpoint || "/upload/image";

    // ===== 상태 =====
    let typingSpan = null;
    const ZWSP = "\u200B";

    // ===== 내부 유틸 =====
    function caretInRoot() {
        const sel = window.getSelection();
        return sel && sel.rangeCount > 0 && root.contains(sel.anchorNode);
    }
    function placeCaretInside(node, atEnd = true) {
        const range = document.createRange();
        const sel = window.getSelection();
        const target = (node.nodeType === Node.TEXT_NODE) ? node : node.firstChild || node;
        if (!target) return;
        range.setStart(target, atEnd ? (target.length ?? 0) : 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    function ensureTypingSpan(styleObj = {}) {
        if (typingSpan && root.contains(typingSpan)) return typingSpan;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        const span = document.createElement("span");
        span.setAttribute("data-typing-span", "true");
        Object.assign(span.style, styleObj);
        const text = document.createTextNode(ZWSP);
        span.appendChild(text);
        range.insertNode(span);
        placeCaretInside(text, true);
        typingSpan = span;
        console.log("[KEditor] ensureTypingSpan created:", span.getAttribute("style"));
        return span;
    }
    function clearTypingSpanIfMoved() {
        if (!typingSpan) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { typingSpan = null; return; }
        const node = sel.anchorNode;
        if (!node || !typingSpan.contains(node)) {
            typingSpan = null;
        }
    }

    // ===== 스타일 미리보기(Toast) =====
    function showStylePreview(text) {
        const prev = document.getElementById("stylePreview");
        if (prev) prev.remove();
        const preview = document.createElement("div");
        preview.id = "stylePreview";
        preview.textContent = text;
        preview.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: #3b82f6; color: white;
      padding: 8px 12px; border-radius: 6px; font-size: 12px;
      z-index: 1000; opacity: 0; transition: opacity .15s;
    `;
        document.body.appendChild(preview);
        requestAnimationFrame(() => preview.style.opacity = "1");
        setTimeout(() => preview.remove(), 1600);
    }

    // ===== 명령(선택 감싸기) =====
    function surroundOrInsertSpan(styleObj) {
        root.focus();
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        if (!sel.isCollapsed) {
            const span = document.createElement("span");
            Object.assign(span.style, styleObj);
            try {
                range.surroundContents(span);
            } catch {
                const frag = range.extractContents();
                span.appendChild(frag);
                range.insertNode(span);
                sel.removeAllRanges();
                const after = document.createRange();
                after.setStartAfter(span);
                after.collapse(true);
                sel.addRange(after);
            }
            return;
        }
        ensureTypingSpan(styleObj);
    }

    // ===== 공개 API: 포맷 =====
    function applyBold() { document.execCommand("bold"); console.log("[KEditor] bold"); }
    function applyItalic() { document.execCommand("italic"); console.log("[KEditor] italic"); }
    function applyUnderline() { document.execCommand("underline"); console.log("[KEditor] underline"); }

    function applyHeading(tag) {
        root.focus();
        const valid = ["h1", "h2", "h3", "p"];
        if (!valid.includes(tag)) tag = "p";
        document.execCommand("formatBlock", false, tag);
        console.log("[KEditor] heading:", tag);
    }
    function clearHeading() { applyHeading("p"); }

    function applyList(type) {
        root.focus();
        if (type === "ul") document.execCommand("insertUnorderedList");
        if (type === "ol") document.execCommand("insertOrderedList");
        console.log("[KEditor] list:", type);
    }

    function applyAlign(alignment) {
        root.focus();
        const map = { left: "justifyLeft", center: "justifyCenter", right: "justifyRight" };
        const cmd = map[alignment] || "justifyLeft";
        document.execCommand(cmd);
        console.log("[KEditor] align:", alignment);
    }

    function setFontSize(size) {
        if (!size || size === "reset") return resetFontSize();
        surroundOrInsertSpan({ fontSize: size });
        console.log("[KEditor] font-size:", size);
        showStylePreview("글자 크기: " + size);
    }
    function resetFontSize() {
        root.focus();
        root.querySelectorAll('span[style*="font-size"]').forEach(s => {
            s.style.fontSize = "";
            if (!s.getAttribute("style")) s.removeAttribute("style");
            if (s.getAttribute("data-typing-span") === "true" && s.textContent === "") s.remove();
        });
        typingSpan = null;
        console.log("[KEditor] font-size reset");
        showStylePreview("글자 크기: 기본");
    }

    function setColor(color) {
        if (!color || color === "reset") return resetColor();
        surroundOrInsertSpan({ color });
        console.log("[KEditor] color:", color);
        showStylePreview("글자색: " + color);
    }
    function resetColor() {
        root.focus();
        root.querySelectorAll('span[style*="color"]').forEach(s => {
            s.style.color = "";
            if (!s.getAttribute("style")) s.removeAttribute("style");
            if (s.getAttribute("data-typing-span") === "true" && s.textContent === "") s.remove();
        });
        typingSpan = null;
        console.log("[KEditor] color reset");
        showStylePreview("글자색: 기본");
    }

    function insertChar(ch) {
        root.focus();
        document.execCommand("insertText", false, ch);
        console.log("[KEditor] insertChar:", ch);
    }

    // ===== 이미지 =====
    async function uploadImage(file) {
        console.log("[KEditor] upload start:", file?.name);
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
        const json = await res.json();
        console.log("[KEditor] upload response:", json);
        if (!json?.success) throw new Error(json?.error || "upload failed");
        return json.imagePath; // e.g. "/uploads/xxx.jpg"
    }

    function openImagePopup(imagePath) {
        console.log("[KEditor] open popup for:", imagePath);
        const popup = document.createElement("div");
        popup.style.cssText = `
      position: fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:#fff; border:1px solid #ddd; border-radius:10px; padding:18px 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,.12); z-index:1000; min-width:320px;
    `;
        popup.innerHTML = `
      <h3 style="margin:0 0 12px 0; font-size:16px; font-weight:700;">이미지 옵션</h3>
      <div style="font-size:12px; color:#555; margin-bottom:6px;">정렬</div>
      <div style="display:flex; gap:8px; margin-bottom:14px;">
        <button data-align="left"   class="opt-btn">← 왼쪽</button>
        <button data-align="center" class="opt-btn">↔ 가운데</button>
        <button data-align="right"  class="opt-btn">→ 오른쪽</button>
      </div>
      <div style="font-size:12px; color:#555; margin-bottom:6px;">크기</div>
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <button data-size="full"  class="opt-btn">본문 가득</button>
        <button data-size="side"  class="opt-btn">사이드</button>
        <button data-size="thumb" class="opt-btn">썸네일</button>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="confirmInsert" class="opt-cta">삽입</button>
        <button id="cancelAlign"   class="opt-ghost">취소</button>
      </div>
    `;
        popup.querySelectorAll(".opt-btn").forEach(b => {
            b.style.cssText = `padding:8px 12px; border:1px solid #ddd; border-radius:6px; cursor:pointer; background:#fff;`;
        });
        popup.querySelectorAll(".opt-cta, .opt-ghost").forEach(b => {
            b.style.cssText = `padding:8px 14px; border-radius:6px; cursor:pointer;`;
        });
        popup.querySelector("#confirmInsert").style.background = "#2563eb";
        popup.querySelector("#confirmInsert").style.color = "#fff";
        popup.querySelector("#confirmInsert").style.border = "1px solid #1d4ed8";
        popup.querySelector("#cancelAlign").style.background = "#fff";
        popup.querySelector("#cancelAlign").style.border = "1px solid #ddd";

        document.body.appendChild(popup);

        let chosen = { align: "left", size: "full" };
        popup.querySelectorAll("[data-align]").forEach(btn => {
            btn.addEventListener("click", () => {
                chosen.align = btn.getAttribute("data-align");
                popup.querySelectorAll("[data-align]").forEach(b => b.style.outline = "none");
                btn.style.outline = "2px solid #2563eb";
                console.log("[KEditor] choose align:", chosen.align);
            });
        });
        popup.querySelectorAll("[data-size]").forEach(btn => {
            btn.addEventListener("click", () => {
                chosen.size = btn.getAttribute("data-size");
                popup.querySelectorAll("[data-size]").forEach(b => b.style.outline = "none");
                btn.style.outline = "2px solid #2563eb";
                console.log("[KEditor] choose size:", chosen.size);
            });
        });

        popup.querySelector("#confirmInsert").onclick = () => {
            insertImage(imagePath, chosen.align, chosen.size);
            document.body.removeChild(popup);
        };
        popup.querySelector("#cancelAlign").onclick = () => {
            console.log("[KEditor] popup cancel");
            document.body.removeChild(popup);
        };
    }

    function insertImage(imagePath, align = "left", size = "full") {
        console.log("[KEditor] insert image:", { imagePath, align, size });
        root.focus();
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        const img = document.createElement("img");
        const imageUrl = (location.host === "localhost:3000")
            ? ("http://localhost:3000" + imagePath)
            : (location.origin + imagePath);
        img.src = imageUrl;

        img.classList.remove("img-full", "img-side", "img-thumb");
        img.classList.add(size === "side" ? "img-side" : (size === "thumb" ? "img-thumb" : "img-full"));

        img.style.margin = "10px 0";
        img.style.borderRadius = "4px";
        img.style.border = "1px solid #ddd";

        img.style.display = "";
        img.style.float = "";
        if (align === "center") {
            img.style.display = "block";
            img.style.marginLeft = "auto";
            img.style.marginRight = "auto";
        } else if (align === "right") {
            img.style.float = "right";
            img.style.marginLeft = "10px";
        } else {
            img.style.float = "left";
            img.style.marginRight = "10px";
        }

        img.onload = () => console.log("[KEditor] image loaded:", img.src);
        img.onerror = () => {
            if (img.dataset.retried !== "1") {
                img.dataset.retried = "1";
                img.src = imagePath;
                console.warn("[KEditor] retry with relative:", imagePath);
            } else {
                console.error("[KEditor] image load failed:", img.src);
            }
        };

        range.insertNode(img);
        range.setStartAfter(img);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // ===== 이벤트: 입력/클릭 이동/Enter 처리 =====
    root.addEventListener("input", () => {
        if (!typingSpan) return;
        const t = typingSpan.firstChild;
        if (t && t.nodeType === Node.TEXT_NODE && t.nodeValue.startsWith(ZWSP)) {
            t.nodeValue = t.nodeValue.replace(ZWSP, "");
        }
    });
    ["mouseup", "keyup"].forEach(ev => {
        document.addEventListener(ev, () => clearTypingSpanIfMoved());
    });

    // 엔터: 줄바꿈 + 타이핑 스타일 유지
    root.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);

            const br = document.createElement("br");
            range.insertNode(br);
            range.setStartAfter(br);
            range.collapse(true);

            if (typingSpan && root.contains(typingSpan) && typingSpan.getAttribute("style")) {
                const newSpan = document.createElement("span");
                newSpan.setAttribute("data-typing-span", "true");
                newSpan.setAttribute("style", typingSpan.getAttribute("style") || "");
                const zw = document.createTextNode(ZWSP);
                newSpan.appendChild(zw);
                range.insertNode(newSpan);
                placeCaretInside(zw, true);
                typingSpan = newSpan;
            } else {
                // 기본 줄바꿈 후 커서만 이동
                const newRange = document.createRange();
                newRange.setStartAfter(br);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
            console.log("[KEditor] Enter handled");
        }
    });

    // ===== 툴바 바인딩(옵션) =====
    const toolbar = options?.toolbar || {};
    // 기본 서식 버튼
    toolbar.buttons?.bold && toolbar.buttons.bold.addEventListener("click", applyBold);
    toolbar.buttons?.italic && toolbar.buttons.italic.addEventListener("click", applyItalic);
    toolbar.buttons?.underline && toolbar.buttons.underline.addEventListener("click", applyUnderline);

    // 목록
    toolbar.buttons?.ul && toolbar.buttons.ul.addEventListener("click", () => applyList("ul"));
    toolbar.buttons?.ol && toolbar.buttons.ol.addEventListener("click", () => applyList("ol"));

    // 헤딩
    toolbar.selects?.heading && toolbar.selects.heading.addEventListener("change", function () {
        if (this.value) applyHeading(this.value); else clearHeading();
        this.blur(); // 선택 직후 닫힘
    });

    // 정렬
    toolbar.buttons?.alignLeft && toolbar.buttons.alignLeft.addEventListener("click", () => applyAlign("left"));
    toolbar.buttons?.alignCenter && toolbar.buttons.alignCenter.addEventListener("click", () => applyAlign("center"));
    toolbar.buttons?.alignRight && toolbar.buttons.alignRight.addEventListener("click", () => applyAlign("right"));

    // 폰트 크기
    toolbar.selects?.fontSize && toolbar.selects.fontSize.addEventListener("change", function () {
        if (this.value) {
            console.log("[KEditor] font-size select:", this.value);
            setFontSize(this.value);
            // reset인 경우에만 기본값으로 되돌리기
            if (this.value === "reset") {
                this.value = "";
            }
            // 다른 크기 선택 시에는 선택된 값 유지
        }
    });

    // 색상
    if (toolbar.colorButtons?.length) {
        toolbar.colorButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const c = btn.getAttribute("data-color");
                console.log("[KEditor] color btn:", c);
                if (c === "reset") resetColor(); else setColor(c);
            });
        });
    }

    // 특수문자
    if (toolbar.charButtons?.length) {
        toolbar.charButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const ch = btn.getAttribute("data-char");
                insertChar(ch);
            });
        });
    }

    // 이미지 업로드
    if (toolbar.imageButton && toolbar.imageInput) {
        toolbar.imageButton.addEventListener("click", () => toolbar.imageInput.click());
        toolbar.imageInput.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const path = await uploadImage(file);
                openImagePopup(path);
            } catch (err) {
                console.error("[KEditor] upload error:", err);
                alert("이미지 업로드 실패: " + err.message);
            }
            toolbar.imageInput.value = "";
        });
    }

    // ===== 공개 API =====
    return {
        getHTML() { return root.innerHTML; },
        setHTML(html) { root.innerHTML = html || ""; },
        focus() { root.focus(); },
        // 노출용 포맷 API (필요 시 사용)
        setFontSize, resetFontSize, setColor, resetColor,
    };
}
