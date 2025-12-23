btnSave?.addEventListener("click", async () => {
  if (!currentSlotKey) {
    alert("먼저 왼쪽에서 슬롯을 선택하세요.");
    return;
  }

  const payload = {
    page: inputPage.value.trim(),        // "index"
    position: inputPosition.value.trim(),// 예: "index_main_top"
    image_url: inputImageUrl.value.trim(),
    link_url: inputLinkUrl.value.trim(),
    text_content: inputTextContent.value,
  };

  try {
    const res = await fetch("/manager/newindex/slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    console.log("[newindexmanager] 저장 결과:", json);

    if (json.success) {
      alert("슬롯이 저장되었습니다.");
    } else {
      alert("저장 중 오류: " + (json.error || "알 수 없는 오류"));
    }
  } catch (err) {
    console.error(err);
    alert("서버 통신 중 오류가 발생했습니다.");
  }
});
