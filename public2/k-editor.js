// public2/k-editor.js
// KEditor v2 — IME(한글) 안전 / 실시간 포맷 / 이미지 좌우배치 + 옆글쓰기
// 로그 토글
const DEBUG = false;
const log = (...a) => DEBUG && console.log("[KEditor]", ...a);

export function createKEditor(options) {
    const root = options?.root;
    if (!root) throw new Error("root element required");
    const uploadEndpoint = options?.uploadEndpoint || "/upload/image";

    // ---- 상태
    let typingSpan = null;            // 현재 타이핑 스타일 span
    let isComposing = false;          // IME 조합 중 여부
    let pendingStyle = null;          // 조합 중 클릭한 스타일 대기
    const ZWSP = "\u200B";            // zero-width space

    // ---- 유틸
    function keepFocus(el) {
        if (!el) return;
        el.addEventListener("mousedown", (e) => {
            // 툴바 클릭 시 selection 파괴 방지
            e.preventDefault();
            root.focus();
        });
    }
    function placeCaretInside(node, atEnd = true) {
        const range = document.createRange();
        const sel = window.getSelection();
        const target = (node.nodeType === Node.TEXT_NODE) ? node : (node.lastChild || node);
        if (!target) return;
        range.setStart(target, atEnd ? (target.nodeValue?.length ?? target.childNodes?.length ?? 0) : 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    function placeCaretAtEndOfRoot() {
        const sel = window.getSelection();
        const range = document.createRange();
        let n = root;
        while (n && n.lastChild) n = n.lastChild;
        if (!n || n === root) {
            const p = createParagraph();
            root.appendChild(p);
            n = p;
        }
        if (n.nodeType === Node.TEXT_NODE) {
            range.setStart(n, n.nodeValue?.length ?? 0);
        } else {
            // 마지막 노드가 엘리먼트면 그 끝
            range.selectNodeContents(n);
            range.collapse(false);
        }
        sel.removeAllRanges();
        sel.addRange(range);
    }
    function forceCaretTail() {
        requestAnimationFrame(() => {
            if (isComposing) return;
            if (typingSpan && root.contains(typingSpan)) {
                const t = typingSpan.lastChild || typingSpan;
                placeCaretInside(t, true);
            } else {
                placeCaretAtEndOfRoot();
            }
        });
    }

    function createParagraph() {
        const p = document.createElement("div");
        p.className = "k-block";
        p.appendChild(document.createElement("br"));
        return p;
    }

    function ensureTypingSpan(styleObj = {}) {
        // 이미 타이핑 중이면 스타일 갱신만
        if (typingSpan && root.contains(typingSpan)) {
            Object.assign(typingSpan.style, styleObj);
            return typingSpan;
        }
        // selection 기준점
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) {
            placeCaretAtEndOfRoot();
        }
        const s2 = window.getSelection();
        const range = s2.getRangeAt(0);

        // 커서 위치에 타이핑 span 삽입
        const span = document.createElement("span");
        span.setAttribute("data-typing-span", "true");
        Object.assign(span.style, styleObj);
        const text = document.createTextNode(ZWSP);
        span.appendChild(text);

        range.insertNode(span);
        // span 뒤를 기준으로 caret
        const r2 = document.createRange();
        r2.setStart(text, text.nodeValue.length);
        r2.collapse(true);
        s2.removeAllRanges();
        s2.addRange(r2);

        typingSpan = span;
        return typingSpan;
    }

    function cleanupZWSP() {
        if (!typingSpan || !root.contains(typingSpan)) return;
        const t = typingSpan.firstChild;
        if (t && t.nodeType === Node.TEXT_NODE) {
            t.nodeValue = (t.nodeValue || "").replace(/\u200B/g, "");
        }
    }

    // ---- 포맷 적용(선택 감싸기 + 타이핑 유지)
    function wrapSelectionOrTyping(styleObj) {
        if (isComposing) {
            // 조합 중엔 DOM 조작 금지: 조합이 끝나면 적용
            pendingStyle = { ...(pendingStyle || {}), ...styleObj };
            return;
        }
        root.focus();
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) {
            ensureTypingSpan(styleObj);
            forceCaretTail();
            return;
        }
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
            }
            // 선택 해제 후 뒤로 커서
            const after = document.createRange();
            after.setStartAfter(span);
            after.collapse(true);
            sel.removeAllRanges();
            sel.addRange(after);
            typingSpan = span;  // 이후 타이핑 이어짐
        } else {
            // 선택 없으면 현재 위치에 타이핑 span 확보
            ensureTypingSpan(styleObj);
        }
        forceCaretTail();
    }

    // ---- 공개 API: 서식
    function applyBold() { document.execCommand("bold"); log("bold"); }
    function applyItalic() { document.execCommand("italic"); log("italic"); }
    function applyUnderline() { document.execCommand("underline"); log("underline"); }
    function applyHeading(tag) {
        const valid = ["h1", "h2", "h3", "p"];
        if (!valid.includes(tag)) tag = "p";
        document.execCommand("formatBlock", false, tag);
        log("heading", tag);
    }
    function applyList(type) {
        if (type === "ul") document.execCommand("insertUnorderedList");
        if (type === "ol") document.execCommand("insertOrderedList");
        log("list", type);
    }
    function applyAlign(al) {
        const map = { left: "justifyLeft", center: "justifyCenter", right: "justifyRight" };
        document.execCommand(map[al] || "justifyLeft");
        log("align", al);
    }
    function setFontSize(size) {
        if (!size || size === "reset") return resetFontSize();
        wrapSelectionOrTyping({ fontSize: size });
    }
    function resetFontSize() {
        root.querySelectorAll('span[style*="font-size"]').forEach(s => {
            s.style.fontSize = "";
            if (!s.getAttribute("style")) s.removeAttribute("style");
        });
        typingSpan = null;
    }
    function setColor(color) {
        if (!color || color === "reset") return resetColor();
        wrapSelectionOrTyping({ color });
    }
    function resetColor() {
        root.querySelectorAll('span[style*="color"]').forEach(s => {
            s.style.color = "";
            if (!s.getAttribute("style")) s.removeAttribute("style");
        });
        typingSpan = null;
    }
    function insertChar(ch) {
        document.execCommand("insertText", false, ch);
    }

    // ---- 이미지: figure로 감싸 float + 옆글쓰기
    function buildFigure(imgURL, align = "left", size = "full") {
        const fig = document.createElement("figure");
        fig.className = `k-figure ${align} ${size}`;
        const img = document.createElement("img");
        img.src = imgURL;
        img.draggable = false;
        fig.appendChild(img);
        return fig;
    }
    function insertImageNode(fig) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) placeCaretAtEndOfRoot();
        const s2 = window.getSelection();
        const range = s2.getRangeAt(0);

        // 현재 커서가 블록 밖이면 새 블록
        let container = sel.anchorNode;
        while (container && container !== root && !(container instanceof HTMLElement && container.classList?.contains("k-block"))) {
            container = container.parentNode;
        }
        if (!container || container === root) {
            container = createParagraph();
            range.insertNode(container);
            // container 뒤에 caret 이동
            const afterContainer = document.createRange();
            afterContainer.setStartAfter(container);
            afterContainer.collapse(true);
            s2.removeAllRanges();
            s2.addRange(afterContainer);
        }

        // figure 삽입
        const r3 = s2.getRangeAt(0);
        r3.insertNode(fig);

        // figure 뒤에 타이핑 앵커(비어있는 인라인) 삽입 → 옆글/다음 타이핑 안정
        const anchor = document.createElement("span");
        anchor.className = "k-caret-anchor";
        anchor.appendChild(document.createTextNode(ZWSP));
        fig.parentNode.insertBefore(anchor, fig.nextSibling);

        placeCaretInside(anchor.firstChild, true);
        forceCaretTail();
    }

    async function uploadImage(file) {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.error || "upload failed");
        return (location.host === "localhost:3000")
            ? ("http://localhost:3000" + json.imagePath)
            : (location.origin + json.imagePath);
    }
    function openImagePopup(imagePath) {
        // 간단화: 바로 왼/오/가운데 선택은 toolbar 쪽에서 넘기는 걸 추천.
        insertImage(imagePath, "left", "full");
    }
    function insertImage(imagePath, align = "left", size = "full") {
        const fig = buildFigure(imagePath, align, size);
        insertImageNode(fig);
    }

    // ---- 이벤트: IME/입력/엔터
    root.addEventListener("compositionstart", () => {
        isComposing = true;
    });
    root.addEventListener("compositionend", () => {
        isComposing = false;
        cleanupZWSP();
        // 조합 끝났고 대기 스타일이 있으면 적용
        if (pendingStyle) {
            wrapSelectionOrTyping(pendingStyle);
            pendingStyle = null;
        } else {
            // caret 유지
            forceCaretTail();
        }
    });

    // 입력 시 ZWSP 정리 (타자 중 계속 정리)
    root.addEventListener("input", () => {
        cleanupZWSP();
    });

    // 커서가 멀어지면 typingSpan 해제
    ["mouseup", "keyup"].forEach(ev => {
        document.addEventListener(ev, () => {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) { typingSpan = null; return; }
            const n = sel.anchorNode;
            if (!typingSpan || !root.contains(typingSpan) || (n && !typingSpan.contains(n))) {
                typingSpan = null;
            }
        });
    });

    // 엔터 → 새 블록
    root.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);

            const p = createParagraph();
            range.insertNode(p);

            // 새 단락 시작점으로 커서
            const r2 = document.createRange();
            r2.selectNodeContents(p);
            r2.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r2);

            // 현재 타이핑 상태 유지(스타일 있는 경우)
            if (typingSpan && root.contains(typingSpan) && typingSpan.getAttribute("style")) {
                const span = document.createElement("span");
                span.setAttribute("data-typing-span", "true");
                span.setAttribute("style", typingSpan.getAttribute("style") || "");
                const t = document.createTextNode(ZWSP);
                span.appendChild(t);
                r2.insertNode(span);
                placeCaretInside(t, true);
                typingSpan = span;
            } else {
                typingSpan = null;
            }
        }
    });

    // ---- 툴바 바인딩
    const toolbar = options?.toolbar || {};
    // 포커스 보호
    Object.values(toolbar.buttons || {}).forEach(keepFocus);
    Object.values(toolbar.selects || {}).forEach(keepFocus);
    (toolbar.colorButtons || []).forEach(keepFocus);
    (toolbar.charButtons || []).forEach(keepFocus);
    keepFocus(toolbar.imageButton);
    keepFocus(toolbar.imageInput);

    // 포맷 버튼
    toolbar.buttons?.bold?.addEventListener("click", applyBold);
    toolbar.buttons?.italic?.addEventListener("click", applyItalic);
    toolbar.buttons?.underline?.addEventListener("click", applyUnderline);
    toolbar.buttons?.ul?.addEventListener("click", () => applyList("ul"));
    toolbar.buttons?.ol?.addEventListener("click", () => applyList("ol"));
    toolbar.buttons?.alignLeft?.addEventListener("click", () => applyAlign("left"));
    toolbar.buttons?.alignCenter?.addEventListener("click", () => applyAlign("center"));
    toolbar.buttons?.alignRight?.addEventListener("click", () => applyAlign("right"));

    toolbar.selects?.heading?.addEventListener("change", function () {
        this.value ? applyHeading(this.value) : applyHeading("p");
        this.blur();
    });
    toolbar.selects?.fontSize?.addEventListener("change", function () {
        if (!this.value) return;
        (this.value === "reset") ? resetFontSize() : setFontSize(this.value);
        // 선택 유지(요청대로)
    });

    (toolbar.colorButtons || []).forEach(btn => {
        btn.addEventListener("click", () => {
            const c = btn.getAttribute("data-color");
            (c === "reset") ? resetColor() : setColor(c);
        });
    });
    (toolbar.charButtons || []).forEach(btn => {
        btn.addEventListener("click", () => {
            insertChar(btn.getAttribute("data-char"));
        });
    });

    if (toolbar.imageButton && toolbar.imageInput) {
        toolbar.imageButton.addEventListener("click", () => toolbar.imageInput.click());
        toolbar.imageInput.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
                const url = await uploadImage(file);
                insertImage(url, "left", "full");
            } catch (err) {
                alert("이미지 업로드 실패: " + err.message);
            }
            toolbar.imageInput.value = "";
        });
    }

    // 초기 내용이 비어있으면 기본 블록
    if (!root.innerHTML.trim()) {
        root.appendChild(createParagraph());
    }

    return {
        getHTML() { return root.innerHTML; },
        setHTML(html) { root.innerHTML = html || ""; if (!root.innerHTML.trim()) root.appendChild(createParagraph()); },
        focus() { root.focus(); },
        // 외부에서 이미지 정렬 바꿀 때 사용 가능
        insertImage,
        setFontSize, resetFontSize, setColor, resetColor,
    };
}
