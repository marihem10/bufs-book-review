(function() {
    function changeBackground() {
        const now = new Date();
        const hour = now.getHours(); 
        
        let imageUrl = '';

        // 1. 아침 (06:00 ~ 10:59) 
        if (hour >= 6 && hour < 17) {
            imageUrl = 'images/mainmorning.jpg';
        } 
        // 3. 저녁 (17:00 ~ 20:59) 
        else if (hour >= 17 && hour < 21) {
            imageUrl = 'images/mainimg.png';
        } 
        // 4. 밤/새벽 (21:00 ~ 05:59) 
        else {
            imageUrl = 'images/mainnight.jpg';
        }

        // CSS 변수 적용
        if (document.body) {
            document.body.style.setProperty('--bg-url', `url('${imageUrl}')`);
        }
    }

    // 페이지 로드 즉시 실행
    changeBackground();
    document.addEventListener('DOMContentLoaded', changeBackground);
})();