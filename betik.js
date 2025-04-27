document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elementleri ---
    const screens = {
        nameInput: document.getElementById('name-input-screen'),
        mainMenu: document.getElementById('main-menu-screen'),
        game: document.getElementById('game-screen'),
        leaderboard: document.getElementById('leaderboard-screen'),
    };
    const nameForm = document.getElementById('name-form');
    const playerNameInput = document.getElementById('player-name');
    const productButtons = document.querySelectorAll('.product-button');
    const gameArea = document.getElementById('game-area');
    const character = document.getElementById('character');
    const timerDisplay = document.getElementById('timer-display');
    const themeInfoSpan = document.querySelector('#theme-info span');
    const leaderboardList = document.getElementById('leaderboard-list');
    const playAgainButton = document.getElementById('play-again-button');
    const backToMenuButton = document.getElementById('back-to-menu-button');

    // --- Oyun Değişkenleri ---
    let playerName = '';
    let selectedTheme = '';
    let gameInterval;
    let obstacleInterval;
    let startTime;
    let elapsedTime = 0;
    let characterBottom = 10; // Karakterin zeminden yüksekliği (px)
    let isJumping = false;
    let jumpHeight = 120; // Zıplama yüksekliği (px)
    let gravity = 5; // Yerçekimi etkisi
    let obstacles = []; // Aktif engellerin listesi
    let obstacleSpeed = 5; // Engellerin hareket hızı (px/frame)
    let obstacleSpawnRate = 2000; // Yeni engel oluşturma sıklığı (ms)
    let score = 0; // Skor veya ceza için kullanılabilir
    let gameDuration = 75; // Ortalama oyun süresi (saniye) - 60-90 arası
    let timePenalty = 0; // Engellere çarpınca eklenecek ceza süresi (saniye)
    let gameFinished = false;

    // --- Yardımcı Fonksiyonlar ---

    // Belirli bir ekranı göster, diğerlerini gizle
    function showScreen(screenId) {
        Object.values(screens).forEach(screen => screen.classList.remove('active-screen'));
        screens[screenId].classList.add('active-screen');
    }

    // Skorları localStorage'dan al
    function getScores() {
        const scores = localStorage.getItem('tabelaScores');
        return scores ? JSON.parse(scores) : [];
    }

    // Skorları localStorage'a kaydet
    function saveScores(scores) {
        localStorage.setItem('tabelaScores', JSON.stringify(scores));
    }

    // Liderlik tablosunu güncelle
    function updateLeaderboard() {
        leaderboardList.innerHTML = ''; // Listeyi temizle
        const scores = getScores();
        // Süreye göre sırala (düşükten yükseğe)
        scores.sort((a, b) => a.time - b.time);
        // İlk 10 skoru al
        const topScores = scores.slice(0, 10);

        topScores.forEach((score, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}) ${score.name} - `;
            const timeSpan = document.createElement('span');
            timeSpan.textContent = `${score.time.toFixed(1)}s`;
            li.appendChild(timeSpan);
            leaderboardList.appendChild(li);
        });
    }

    // Oyunu sıfırla
    function resetGame() {
        clearInterval(gameInterval);
        clearInterval(obstacleInterval);
        gameInterval = null;
        obstacleInterval = null;
        obstacles.forEach(obstacle => obstacle.element.remove()); // Eski engelleri kaldır
        obstacles = [];
        characterBottom = 10;
        character.style.bottom = `${characterBottom}px`;
        isJumping = false;
        character.classList.remove('jumping');
        elapsedTime = 0;
        timerDisplay.textContent = 'Süre: 0.0s';
        obstacleSpeed = 5; // Hızı sıfırla
        obstacleSpawnRate = 2000; // Sıklığı sıfırla
        timePenalty = 0; // Cezayı sıfırla
        gameFinished = false;
        // Bitiş çizgisini kaldır (varsa)
        const finishLine = document.getElementById('finish-line');
        if (finishLine) finishLine.remove();
    }

    // --- Oyun Mekanikleri ---

    function jump() {
        if (!isJumping) {
            isJumping = true;
            character.classList.add('jumping');
            // Zıplama sesi çalınabilir
            // playSound('jump');

            let currentBottom = characterBottom;
            let targetBottom = currentBottom + jumpHeight;
            let upSpeed = 15; // Yukarı çıkış hızı

            function rise() {
                if (characterBottom < targetBottom && isJumping) { // Hala zıplıyor olmalı
                    characterBottom += upSpeed;
                     // Hızı biraz azaltarak daha yumuşak bir tepe noktası
                    upSpeed = Math.max(5, upSpeed - 1);
                    character.style.bottom = `${characterBottom}px`;
                    requestAnimationFrame(rise); // Daha akıcı animasyon
                } else if (!isJumping) {
                    // Zıplama yarıda kesildi (örneğin oyun bitti), düşmeye başla
                    fall();
                } else {
                     // Tepeye ulaşıldı, düşmeye başla (gameLoop'ta yerçekimi zaten hallediyor)
                    // Ama daha yumuşak geçiş için burada da başlatılabilir
                    // fall();
                }
            }
             requestAnimationFrame(rise); // Yükselmeyi başlat
        }
    }

     function fall() {
         // Bu fonksiyon artık gameLoop içindeki yerçekimi tarafından yönetiliyor.
         // Eğer zıplama yarıda kesilirse, gameLoop'taki yerçekimi devreye girecek.
         // Bu fonksiyonu şimdilik boş bırakabiliriz veya kaldırabiliriz.
     }


    function createObstacle() {
        if (gameFinished) return; // Oyun bittiyse engel oluşturma

        const obstacleElem = document.createElement('div');
        obstacleElem.classList.add('obstacle');
        const obstacleType = Math.random(); // Engel türünü rastgele belirle

        let width, height, typeClass;
        let bottomPos = 10; // Varsayılan zemin pozisyonu

        if (obstacleType < 0.4) { // Normal blok
            width = Math.random() * 30 + 20; // 20-50px genişlik
            height = Math.random() * 40 + 30; // 30-70px yükseklik
        } else if (obstacleType < 0.6) { // POS cihazı
            width = 40; height = 35; typeClass = 'pos';
        } else if (obstacleType < 0.8) { // Çek defteri
            width = 50; height = 25; typeClass = 'check';
        } else { // Çukur
             width = 50; height = 15; typeClass = 'pit'; bottomPos = 0; // Çukur tam zeminde
        }

        obstacleElem.style.width = `${width}px`;
        obstacleElem.style.height = `${height}px`;
        if (typeClass) {
             obstacleElem.classList.add(typeClass);
        }
        obstacleElem.style.bottom = `${bottomPos}px`;
        obstacleElem.style.left = `${gameArea.offsetWidth}px`; // Ekranın sağından başla

        gameArea.appendChild(obstacleElem);
        obstacles.push({
            element: obstacleElem,
            width: width,
            height: height,
            isPit: typeClass === 'pit',
            isFinish: false // Bu normal bir engel
        });
    }

    // Bitiş çizgisini oluştur
    function createFinishLine() {
         if (gameFinished || document.getElementById('finish-line')) return; // Zaten varsa veya oyun bittiyse oluşturma

        const finishLine = document.createElement('div');
        finishLine.id = 'finish-line'; // ID atayalım ki kolayca bulalım
        finishLine.classList.add('obstacle'); // Engeller gibi hareket etsin diye class ekle
        finishLine.textContent = "BITIŞ";
        // Stilini CSS'den alacak ama başlangıç pozisyonunu ayarlayalım
        finishLine.style.left = `${gameArea.offsetWidth}px`; // Sağdan başla

        gameArea.appendChild(finishLine);
        obstacles.push({
            element: finishLine,
            width: parseFloat(getComputedStyle(finishLine).width), // Gerçek genişliği al
            height: parseFloat(getComputedStyle(finishLine).height), // Gerçek yüksekliği al
            isPit: false,
            isFinish: true // Bu bitiş çizgisi
        });
        console.log("Bitiş çizgisi oluşturuldu.");
    }


    function checkCollision(obstacleData) {
        const charRect = character.getBoundingClientRect();
        const obsRect = obstacleData.element.getBoundingClientRect();

        // Daha hassas kontrol için karakterin alt orta noktasını alalım
        const charFeetX = charRect.left + charRect.width / 2;
        const charFeetY = charRect.bottom; // Karakterin en altı

        // Çukur kontrolü: Karakterin ayağı çukurun içinde mi VE zıplamıyor mu?
        if (obstacleData.isPit) {
            // Çukurun üst kenarı (oyun alanının altı ile aynı hizada)
            const pitTopY = gameArea.getBoundingClientRect().bottom - obstacleData.height;
            // Karakterin ayağı çukurun yatay sınırları içinde mi?
            const withinPitX = charFeetX > obsRect.left && charFeetX < obsRect.right;
            // Karakter çukurun üzerindeyse veya içindeyse (veya çok yakınsa) VE zemindeyse (zıplamıyorsa)
            const overPit = withinPitX && charFeetY >= pitTopY - 5 && characterBottom <= 15 ; // 5px tolerans
            if (overPit) {
                console.log("Çukura düştü!");
                return true;
            }
        }
        // Normal engel kontrolü (Bounding Box)
        else {
            const collision = !(
                charRect.right < obsRect.left + 5 || // Biraz tolerans
                charRect.left > obsRect.right - 5 ||
                charRect.bottom < obsRect.top + 5 ||
                charRect.top > obsRect.bottom - 5
            );
             if (collision) {
                 console.log("Engele çarptı!");
                 return true;
             }
        }

        return false;
    }


    function gameLoop(timestamp) { // timestamp requestAnimationFrame'den gelir
        if (gameFinished) return;

        // Geçen süreyi hesapla ve göster
        elapsedTime = (Date.now() - startTime) / 1000;
        timerDisplay.textContent = `Süre: ${elapsedTime.toFixed(1)}s`;

        // Yerçekimi uygula (eğer karakter zeminde değilse)
        if (characterBottom > 10) {
            characterBottom -= gravity;
            if (characterBottom <= 10) { // Zemine indi
                characterBottom = 10;
                isJumping = false; // Zıplama bitti
                character.classList.remove('jumping');
            }
            character.style.bottom = `${characterBottom}px`;
        } else {
             isJumping = false; // Zemindeyse kesinlikle zıplamıyor
             character.classList.remove('jumping');
        }

        // Engelleri hareket ettir ve kontrol et
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacleData = obstacles[i];
            const obstacle = obstacleData.element;
            let currentLeft = parseFloat(obstacle.style.left);
            currentLeft -= obstacleSpeed;
            obstacle.style.left = `${currentLeft}px`;

            // Çarpışma kontrolü (Karakterin mevcut pozisyonuna göre)
            // Sadece karakterin yakınındaki engelleri kontrol etmek performansı artırır
            const charPos = parseFloat(character.style.left);
            if (currentLeft < charPos + character.offsetWidth + 50 && currentLeft + obstacleData.width > charPos - 50) {
                if (checkCollision(obstacleData)) {
                    if (obstacleData.isFinish) {
                        // Bitiş çizgisine ulaşıldı!
                        endGame(true); // Oyunu bitir (başarıyla)
                        return; // Döngüden çık
                    } else {
                        // Engel çarpışması sesi çalınabilir
                        // playSound('hit');
                        timePenalty += 0.5; // Her çarpışmada yarım saniye ceza
                        // Görsel geri bildirim
                        character.style.backgroundColor = 'red';
                        setTimeout(() => {
                             // Eğer oyun hala bitmediyse eski rengine dön
                             if (!gameFinished) character.style.backgroundColor = '#ff4500';
                        }, 200);
                        // Çarpılan engeli hemen kaldır
                        obstacle.remove();
                        obstacles.splice(i, 1);
                        // Kısa bir süre dokunulmazlık verilebilir (isteğe bağlı)
                    }
                }
            }

            // Ekran dışına çıkan engelleri kaldır
            if (currentLeft < -obstacleData.width - 20) { // Biraz pay bırakalım
                obstacle.remove();
                obstacles.splice(i, 1);
            }
        }

         // Oyun süresi dolunca bitiş çizgisini oluştur (eğer henüz oluşmadıysa)
        if (elapsedTime >= gameDuration && !obstacles.some(o => o.isFinish)) {
            createFinishLine();
        }

        // Zorluk Artışı (Daha stabil kontrol)
        const difficultyCheckTime = 15; // Her 15 saniyede bir kontrol
        const currentLevel = Math.floor(elapsedTime / difficultyCheckTime);
        const difficultyKey = `level_${currentLevel}_increased`;

        if (currentLevel > 0 && !window[difficultyKey]) {
            obstacleSpeed += 0.5; // Hızı artır
            obstacleSpawnRate = Math.max(600, obstacleSpawnRate - 200); // Sıklığı artır (min 600ms)
            console.log(`Zorluk arttı (Seviye ${currentLevel}): Hız=${obstacleSpeed.toFixed(1)}, Sıklık=${obstacleSpawnRate}ms`);

            // Engel oluşturma interval'ini yeni sıklıkla yeniden başlat
            clearInterval(obstacleInterval);
            obstacleInterval = setInterval(createObstacle, obstacleSpawnRate);

            window[difficultyKey] = true; // Bu seviye için artış yapıldı işareti
        }

        // Oyun bitmediyse bir sonraki frame'i iste
        if (!gameFinished) {
             gameInterval = requestAnimationFrame(gameLoop); // setInterval yerine bunu kullan
        }
    }

    function startGame(theme) {
        resetGame(); // Önceki oyundan kalanları temizle
        selectedTheme = theme;
        gameArea.className = 'theme-' + theme; // Tema classını set et
        themeInfoSpan.textContent = theme.replace('-', ' '); // Tema bilgisini göster

        // İsim ve tema seçildiğine göre oyun başlayabilir
        startTime = Date.now();
        gameFinished = false;
        // Zorluk artışı için seviye işaretlerini temizle
        Object.keys(window).forEach(key => {
             if (key.startsWith('level_') && key.endsWith('_increased')) {
                 delete window[key];
             }
        });

        // Engel oluşturmayı başlat
        clearInterval(obstacleInterval); // Öncekini temizle (varsa)
        obstacleInterval = setInterval(createObstacle, obstacleSpawnRate);

        // Oyun döngüsünü başlat
        cancelAnimationFrame(gameInterval); // Önceki animasyonu durdur (varsa)
        gameInterval = requestAnimationFrame(gameLoop);

        showScreen('game');

        // Zıplama için olay dinleyici ekle
        document.removeEventListener('keydown', handleKeyPress); // Öncekini kaldır (varsa)
        document.addEventListener('keydown', handleKeyPress);
        // gameArea.removeEventListener('touchstart', handleTouch); // Öncekini kaldır (varsa)
        // gameArea.addEventListener('touchstart', handleTouch);
    }

    function handleKeyPress(event) {
        if (screens.game.classList.contains('active-screen') && !gameFinished) {
            if (event.code === 'Space' || event.code === 'ArrowUp' || event.key === ' ') {
                 event.preventDefault();
                 jump();
            }
        }
    }
    // function handleTouch(event) {
    //      if (screens.game.classList.contains('active-screen') && !gameFinished) {
    //          event.preventDefault(); // Dokunma ile kaydırmayı engelle
    //          jump();
    //      }
    // }

    function endGame(success) {
        if (gameFinished) return; // Zaten bittiyse tekrar bitirme
        gameFinished = true;

        cancelAnimationFrame(gameInterval); // Oyun döngüsünü durdur
        clearInterval(obstacleInterval); // Engel üretimini durdur

        // Klavye/Dokunma dinleyicilerini kaldır
        document.removeEventListener('keydown', handleKeyPress);
        // gameArea.removeEventListener('touchstart', handleTouch);

        console.log("Oyun Bitti!");
        // Bitiş sesi çalınabilir
        // playSound('gameOver');

        const finalTime = elapsedTime + timePenalty; // Ceza süresini ekle
        console.log(`Final Süre: ${finalTime.toFixed(1)}s (Ceza: ${timePenalty.toFixed(1)}s)`);

        // Skoru kaydet
        const scores = getScores();
        scores.push({ name: playerName, time: finalTime });
        saveScores(scores);

        // Liderlik tablosunu güncelle ve göster
        updateLeaderboard();
        showScreen('leaderboard');
    }

    // --- Olay Dinleyicileri ---

    nameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        playerName = playerNameInput.value.trim();
        if (playerName && playerName.length >= 3) {
            console.log(`Oyuncu: ${playerName}`);
            localStorage.setItem('lastPlayerName', playerName);
            showScreen('mainMenu');
        } else {
            alert("Lütfen geçerli bir Ad Soyad girin (en az 3 karakter).");
            playerNameInput.focus();
        }
    });

    const lastPlayer = localStorage.getItem('lastPlayerName');
    if (lastPlayer) {
        playerNameInput.value = lastPlayer;
    }

    productButtons.forEach(button => {
        button.addEventListener('click', () => {
            const theme = button.getAttribute('data-theme');
            console.log(`Tema Seçildi: ${theme}`);
            startGame(theme);
        });
    });

    playAgainButton.addEventListener('click', () => {
        // Son seçilen tema ile tekrar başlat
        if (selectedTheme) {
            startGame(selectedTheme);
        } else {
            // Eğer tema seçilmemişse (bir hata durumu), menüye dön
            showScreen('mainMenu');
        }
    });

    backToMenuButton.addEventListener('click', () => {
        showScreen('mainMenu');
    });

    // --- Başlangıç ---
    showScreen('nameInput'); // Oyunu isim giriş ekranıyla başlat

});