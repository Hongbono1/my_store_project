// 수정된 insertImageToEditor 함수
function insertImageToEditor(imagePath, alignment = 'left') {
    console.log('🖼️ 이미지 삽입 시작:', imagePath, '정렬:', alignment);
    customEditor.focus();
    
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // img 태그 생성
    const img = document.createElement('img');
    
    // 환경에 따른 이미지 URL 설정
    let imageUrl;
    if (window.location.host === 'localhost:3000') {
        // 로컬 개발 환경
        imageUrl = 'http://localhost:3000' + imagePath;
    } else {
        // 배포 환경 (hongbono1.com)
        imageUrl = window.location.origin + imagePath;
    }
    
    img.src = imageUrl;
    console.log('🔗 설정된 이미지 URL:', imageUrl);
    
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.margin = '10px 0';
    img.style.borderRadius = '4px';
    img.style.border = '1px solid #ddd';
    
    // 정렬 적용
    if (alignment === 'center') {
        img.style.display = 'block';
        img.style.marginLeft = 'auto';
        img.style.marginRight = 'auto';
    } else if (alignment === 'right') {
        img.style.float = 'right';
        img.style.marginLeft = '10px';
    } else { // left
        img.style.float = 'left';
        img.style.marginRight = '10px';
    }
    
    // 이미지 로드 이벤트 추가
    img.onload = function() {
        console.log('✅ 이미지 로드 성공:', imageUrl);
    };
    img.onerror = function() {
        console.error('❌ 이미지 로드 실패:', imageUrl);
        // 상대 경로로 재시도
        if (this.src !== imagePath) {
            console.log('🔄 상대 경로로 재시도:', imagePath);
            this.src = imagePath;
        }
    };
    
    // 현재 위치에 이미지 삽입
    range.insertNode(img);
    
    // 커서를 이미지 뒤로 이동
    range.setStartAfter(img);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    console.log('✅ 이미지가 에디터에 삽입됨');
}