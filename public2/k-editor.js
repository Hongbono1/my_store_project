// KEditor v4 — IME(한글) 안전 / 커서 항상 끝 / 실시간 스타일 유지 / 이미지 옆글쓰기
// 사용법은 아래 openregister.html 예시 참고.

export function createKEditor(options) {
    const root = options?.root;
    if (!root) throw new Error("root element required");
    const uploadEndpoint = options?.uploadEndpoint || "/upload/image";

    // 상태
    let isComposing = false;          // IME 조합 중
    let typingSpan = null;            // 현재 타이핑 span
    let activeStyle = {               // 실시간 스타일 상태
        color: "",
        fontSize: "",
        fontWeight: "",                 // "bold" or ""
        fontStyle: "",                  // "italic" or ""
        textDecoration: ""              // "underline" or ""
    };

    // --- 유틸
    function keepFocus(el) {
        if (!el) return;
        el.addEventListener("mousedown", (e) => {
            e.preventDefault();           // selection 깨짐 방지
            root.focus();
        });
    }

    function ensureRootHasBlock() {
        if (!root.firstChild) {
            const div = document.createElement("div");
            div.className = "k-block";
            div.appendChild(document.createTextNode(""));
            root.appendChild(div);
        }
    }

    function selection() {
        const sel = window.getSelection();
        return (sel && sel.rangeCount) ? sel : null;
    }

    function placeCaret(node, offsetAtEnd = true) {
        const sel = selection();
        if (!sel) return;
        const range = document.createRange();
        const target = (node.nodeType === Node.TEXT_NODE) ? node : (node.lastChild || node);
        if (target.nodeType === Node.TEXT_NODE) {
            range.setStart(target, offsetAtEnd ? (target.nodeValue?.length ?? 0) : 0);
        } else {
            range.setStartAfter(target);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function caretInside(el) {
        const sel = selection();
        return !!(sel && el && sel.anchorNode && el.contains(sel.anchorNode));
    }

    function styleEquals(a, b) {
        return a.color === b.color &&
            a.fontSize === b.fontSize &&
            a.fontWeight === b.fontWeight &&
            a.fontStyle === b.fontStyle &&
            a.textDecoration === b.textDecoration;
    }

    function applyStyleToSpan(span, st = activeStyle) {
        span.style.color = st.color || "";
        span.style.fontSize = st.fontSize || "";
        span.style.fontWeight = st.fontWeight || "";
        span.style.fontStyle = st.fontStyle || "";
        span.style.textDecoration = st.textDecoration || "";
    }

    function createTypingSpan(initialText = "") {
        const span = document.createElement("span");
        span.setAttribute("data-typing", "1");
        applyStyleToSpan(span);
        const text = document.createTextNode(initialText);
        span.appendChild(text);
        return { span, text };
    }

    function ensureTypingSpanExists() {
        // selection 앞에 스타일 유지용 span이 없으면 새로 만든 뒤 커서 span 끝으로
        const sel = selection();
        if (!sel) return null;

        // 이미 typingSpan 있고 커서가 그 안이면 그대로 사용
        if (typingSpan && root.contains(typingSpan) && caretInside(typingSpan)) return typingSpan;

        // 커서 위치에 새 span 삽입
        const range = sel.getRangeAt(0);
        const { span, text } = createTypingSpan(""); // 빈 텍스트 노드
        range.insertNode(span);

        // 커서를 span 텍스트 노드 끝으로
        placeCaret(text, true);
        typingSpan = span;
        return typingSpan;
    }

    function updateTypingSpanStyle() {
        if (!typingSpan || !root.contains(typingSpan)) {
            ensureTypingSpanExists();
        }
        if (typingSpan) applyStyleToSpan(typingSpan);
    }

    // 선택 구간이 있을 때: 그 구간을 래핑하고, 커서를 뒤로
    function wrapSelectionWithSpan() {
        const sel = selection();
        if (!sel) return;
        if (sel.isCollapsed) return;

        const range = sel.getRangeAt(0);
        const span = document.createElement("span");
        applyStyleToSpan(span);
        try {
            range.surroundContents(span);
        } catch {
            const frag = range.extractContents();
            span.appendChild(frag);
            range.insertNode(span);
        }
        // 커서를 span 뒤로
        const after = document.createRange();
        after.setStartAfter(span);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);

        // 이후 타이핑은 이 스타일로 계속
        typingSpan = span;
    }

    function mergeAdjacentSpans(node) {
        // 같은 스타일의 인접 span 병합 (단순화)
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        const parent = node.parentNode;
        if (!parent) return;

        // 왼쪽
        const prev = node.previousSibling;
        if (prev && prev.nodeType === Node.ELEMENT_NODE && prev.tagName === "SPAN") {
            const a = {
                color: prev.style.color,
                fontSize: prev.style.fontSize,
                fontWeight: prev.style.fontWeight,
                fontStyle: prev.style.fontStyle,
                textDecoration: prev.style.textDecoration
            };
            const b = {
                color: node.style.color,
                fontSize: node.style.fontSize,
                fontWeight: node.style.fontWeight,
                fontStyle: node.style.fontStyle,
                textDecoration: node.style.textDecoration
            };
            if (styleEquals(a, b)) {
                // 병합
                while (node.firstChild) prev.appendChild(node.firstChild);
                parent.removeChild(node);
                typingSpan = prev; // 참조 갱신
                return;
            }
        }
        // 오른쪽
        const next = node.nextSibling;
        if (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === "SPAN") {
            const a = {
                color: node.style.color,
                fontSize: node.style.fontSize,
                fontWeight: node.style.fontWeight,
                fontStyle: node.style.fontStyle,
                textDecoration: node.style.textDecoration
            };
            const b = {
                color: next.style.color,
                fontSize: next.style.fontSize,
                fontWeight: next.style.fontWeight,
                fontStyle: next.style.fontStyle,
                textDecoration: next.style.textDecoration
            };
            if (styleEquals(a, b)) {
                while (next.firstChild) node.appendChild(next.firstChild);
                parent.removeChild(next);
                typingSpan = node;
            }
        }
    }

    // --- IME 이벤트
    root.addEventListener("compositionstart", () => {
        isComposing = true;
        // 조합 중에는 DOM 조작 금지
    });

    root.addEventListener("compositionend", () => {
        isComposing = false;
        // 조합이 끝났으니 현재 커서를 담는 span이 없으면 만들어 둔다
        ensureTypingSpanExists();
        if (typingSpan) {
            // 빈 텍스트 노드면 하나 보장
            if (!typingSpan.firstChild) typingSpan.appendChild(document.createTextNode(""));
            placeCaret(typingSpan.firstChild, true);
            mergeAdjacentSpans(typingSpan);
        }
    });

    // --- 입력 이벤트 (조합 아님)
    root.addEventListener("beforeinput", (e) => {
        if (isComposing) return; // 조합 중엔 건드리지 않음
        if (e.inputType === "insertFromPaste") return; // 붙여넣기는 input에서 처리

        // 일반 타자/삭제 전에 typingSpan 보장
        ensureTypingSpanExists();
    });

    root.addEventListener("input", (e) => {
        if (isComposing) return;

        // 붙여넣기 텍스트도 typingSpan 안에 있도록 정리
        if (e.inputType === "insertFromPaste") {
            ensureTypingSpanExists();
            // 커서가 typingSpan 밖이면 끝으로 끌어옴
            if (typingSpan && !caretInside(typingSpan)) placeCaret(typingSpan, true);
        }

        // 입력 후 커서를 항상 typingSpan 끝으로
        if (typingSpan && root.contains(typingSpan)) {
            const t = typingSpan.lastChild || typingSpan;
            placeCaret(t, true);
            mergeAdjacentSpans(typingSpan);
        }
    });

    // 엔터: 줄바꿈 + 같은 스타일 새 typingSpan
    root.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const br = document.createElement("br");
            const sel = selection();
            if (!sel) return;
            const range = sel.getRangeAt(0);
            range.insertNode(br);

            // 다음 줄 시작용 같은 스타일 span
            const { span, text } = createTypingSpan("");
            br.parentNode.insertBefore(span, br.nextSibling);
            placeCaret(text, true);
            typingSpan = span;
        }
    });

    // 클릭 이동 시: 클릭한 위치가 기존 span 안이면 그걸 typingSpan으로
    root.addEventListener("mouseup", () => {
        const sel = selection();
        if (!sel) return;
        let node = sel.anchorNode;
        while (node && node !== root) {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "SPAN") {
                typingSpan = node;
                return;
            }
            node = node.parentNode;
        }
        // 못 찾으면 나중 입력 시 새로 생성
        typingSpan = null;
    });

    // --- 포맷(스타일) API
    function setFontSize(size) {
        activeStyle.fontSize = size || "";
        updateTypingSpanStyle();
    }
    function setColor(color) {
        activeStyle.color = color || "";
        updateTypingSpanStyle();
    }
    function toggleBold() {
        activeStyle.fontWeight = activeStyle.fontWeight === "bold" ? "" : "bold";
        updateTypingSpanStyle();
    }
    function toggleItalic() {
        activeStyle.fontStyle = activeStyle.fontStyle === "italic" ? "" : "italic";
        updateTypingSpanStyle();
    }
    function toggleUnderline() {
        activeStyle.textDecoration = activeStyle.textDecoration === "underline" ? "" : "underline";
        updateTypingSpanStyle();
    }

    function applyStyleToSelectionOrTyping(updater) {
        const sel = selection();
        if (sel && !sel.isCollapsed) {
            updater();            // activeStyle 갱신
            wrapSelectionWithSpan();
            return;
        }
        updater();
        ensureTypingSpanExists();
        updateTypingSpanStyle();
        // 커서를 끝으로
        if (typingSpan) placeCaret(typingSpan, true);
    }

    // --- 툴바 바인딩
    const tb = options?.toolbar || {};
    const buttons = tb.buttons || {};
    const selects = tb.selects || {};
    const colorButtons = tb.colorButtons || [];
    [buttons.bold, buttons.italic, buttons.underline,
    buttons.ul, buttons.ol,
    buttons.alignLeft, buttons.alignCenter, buttons.alignRight].forEach(keepFocus);
    Object.values(selects).forEach(keepFocus);
    colorButtons.forEach(keepFocus);
    keepFocus(tb.imageButton);
    keepFocus(tb.imageInput);

    buttons?.bold && buttons.bold.addEventListener("click", () =>
        applyStyleToSelectionOrTyping(toggleBold));
    buttons?.italic && buttons.italic.addEventListener("click", () =>
        applyStyleToSelectionOrTyping(toggleItalic));
    buttons?.underline && buttons.underline.addEventListener("click", () =>
        applyStyleToSelectionOrTyping(toggleUnderline));

    // fontSize select 처리 (단일 또는 배열)
    if (selects?.fontSize) {
        const fontSizeElements = Array.isArray(selects.fontSize) ? selects.fontSize : [selects.fontSize];
        fontSizeElements.forEach(element => {
            if (element) {
                element.addEventListener("change", function () {
                    const val = this.value;
                    applyStyleToSelectionOrTyping(() => setFontSize(val === "reset" ? "" : val));
                    if (val === "reset") this.value = "";
                });
            }
        });
    }

    // 프리셋 색상
    colorButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const c = btn.getAttribute("data-color");
            applyStyleToSelectionOrTyping(() => setColor(c === "reset" ? "" : c));
        });
    });

    // 목록/정렬/헤딩은 execCommand 없이도 가능하지만,
    // 여기선 에디터 본문 구조를 해치지 않기 위해 최소만 사용하거나 별도 처리 권장.
    // 필요시 아래처럼 블록 단위로 처리(간단 버전).
    function wrapCurrentBlock(tagName) {
        const sel = selection();
        if (!sel) return;
        let node = sel.anchorNode;
        while (node && node !== root && node.parentNode !== root) node = node.parentNode;
        if (!node || node === root) return;

        const block = document.createElement(tagName);
        while (node.firstChild) block.appendChild(node.firstChild);
        node.parentNode.replaceChild(block, node);
        const t = block.lastChild || block;
        placeCaret(t, true);
    }
    selects?.heading && selects.heading.addEventListener("change", function () {
        const v = this.value;
        if (!v) return;
        if (["h1", "h2", "h3"].includes(v)) wrapCurrentBlock(v);
        if (v === "p") wrapCurrentBlock("p");
        this.value = "";
    });

    // --- 이미지 업로드/삽입
    async function uploadImage(file) {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
        const json = await res.json();
        if (!json?.success) throw new Error(json?.error || "upload failed");
        return json.imagePath; // e.g. "/uploads/xxx.jpg"
    }

    function insertImage(imagePath, align = "left", size = "full") {
        const sel = selection();
        if (!sel) return;
        const range = sel.getRangeAt(0);

        const figure = document.createElement("figure");
        const img = document.createElement("img");
        const url = (location.host === "localhost:3000")
            ? ("http://localhost:3000" + imagePath)
            : (location.origin + imagePath);
        img.src = url;
        img.style.borderRadius = "6px";
        img.style.border = "1px solid #ddd";
        img.style.display = "block";
        img.style.maxWidth = (size === "thumb") ? "160px" : (size === "side" ? "240px" : "100%");
        img.style.height = "auto";

        figure.appendChild(img);
        figure.style.margin = "8px 0";
        figure.style.display = "block";
        figure.style.clear = (align === "center") ? "both" : "";

        img.style.float = "";
        figure.style.textAlign = "";
        if (align === "left") {
            img.style.float = "left";
            img.style.margin = "0 12px 8px 0";
        } else if (align === "right") {
            img.style.float = "right";
            img.style.margin = "0 0 8px 12px";
        } else {
            figure.style.textAlign = "center";
            img.style.margin = "0 auto 8px";
        }

        range.insertNode(figure);

        // 이미지 뒤에 새 줄 + 같은 스타일 typingSpan
        const br = document.createElement("br");
        figure.parentNode.insertBefore(br, figure.nextSibling);
        const { span, text } = createTypingSpan("");
        br.parentNode.insertBefore(span, br.nextSibling);
        placeCaret(text, true);
        typingSpan = span;
    }

    if (tb.imageButton && tb.imageInput) {
        tb.imageButton.addEventListener("click", () => tb.imageInput.click());
        tb.imageInput.addEventListener("change", async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
                const path = await uploadImage(f);
                // 간단 옵션: 왼쪽/사이드 기본
                insertImage(path, "left", "side");
            } catch (err) {
                alert("이미지 업로드 실패: " + err.message);
            }
            tb.imageInput.value = "";
        });
    }

    // 초기화
    root.setAttribute("contenteditable", "true");
    root.setAttribute("spellcheck", "false");
    ensureRootHasBlock();

    return {
        getHTML() { return root.innerHTML; },
        setHTML(html) { root.innerHTML = html || ""; ensureRootHasBlock(); typingSpan = null; },
        focus() { root.focus(); },

        // 공개 스타일 API (원하면 직접 호출)
        setFontSize, setColor,
        toggleBold, toggleItalic, toggleUnderline
    };
}
