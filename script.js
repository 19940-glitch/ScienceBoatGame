const firebaseConfig = {
  apiKey: "AIzaSyBLMBPPC_uD02vCdVows-XrFoMpTYzAmoc",
  authDomain: "science-boat-game.firebaseapp.com",
  projectId: "science-boat-game",
  storageBucket: "science-boat-game.firebasestorage.app",
  messagingSenderId: "81751932895",
  appId: "1:81751932895:web:04b1ffdaed5c6fc1284e6a"
};


// ==========================================
// 2. AUDIO SYSTEM
// ==========================================
const sounds = {
    bgm: new Audio('bgm.mp3'),
    engine: new Audio('engine.mp3'), // หาเสียงเรือยนต์มาใส่จะดีมาก
    correct: new Audio('correct.mp3'),
    wrong: new Audio('wrong.mp3')
};
sounds.bgm.loop = true; sounds.bgm.volume = 0.4;
sounds.engine.loop = true; sounds.engine.volume = 0.2;

function playSound(name) {
    if(sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(() => {});
    }
}

// ==========================================
// 3. GAME VARIABLES
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let player = { name: "", email: "", score: 0, dbId: null };
let currentLevel = 1;
let allQuestions = [];
let levelQuestions = [];
let qIndex = 0;

let timeLeft = 10;
let timerInterval = null;
let isDragging = false;
let isGameActive = false;

// ตัวแปรเรือ (Boat Physics)
let boat = { x: 0, y: 0, w: 0, h: 0, tilt: 0 }; 
let waterOffset = 0;
let waterSpeed = 5;

// ==========================================
// 4. INPUT HANDLING (อิสระ 100%)
// ==========================================
function startDrag(e) {
    if (!isGameActive) return;
    isDragging = true;
    moveBoat(e);
}
function stopDrag() { 
    isDragging = false; 
    boat.tilt = 0; // คืนค่าเรือตรงเมื่อหยุดลาก
}
function drag(e) {
    if (isDragging && isGameActive) moveBoat(e);
}

function moveBoat(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    if(e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;

    let targetX = clientX - rect.left - (boat.w / 2);
    
    // คำนวณการเอียง (Tilt) ตามทิศทางที่ลาก
    let diff = targetX - boat.x;
    boat.tilt = diff * 0.5; // ยิ่งลากเร็ว ยิ่งเอียงมาก
    if(boat.tilt > 20) boat.tilt = 20;   // จำกัดมุมเอียง
    if(boat.tilt < -20) boat.tilt = -20;

    boat.x = targetX;
    
    // ชนขอบจอ
    if (boat.x < 0) boat.x = 0;
    if (boat.x > canvas.width - boat.w) boat.x = canvas.width - boat.w;
}

canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', drag);
canvas.addEventListener('mouseup', stopDrag);
canvas.addEventListener('mouseleave', stopDrag);
canvas.addEventListener('touchstart', startDrag, {passive: false});
canvas.addEventListener('touchmove', drag, {passive: false});
canvas.addEventListener('touchend', stopDrag);

// ==========================================
// 5. GAME SYSTEM
// ==========================================
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    boat.w = canvas.width * 0.12; 
    if(boat.w > 80) boat.w = 80;
    boat.h = boat.w * 2.2; // เรือจะทรงยาวกว่ารถ
    boat.y = canvas.height - boat.h - 50;
    if(boat.x === 0) boat.x = (canvas.width / 2) - (boat.w / 2);
}
window.addEventListener('resize', resize);
resize();

// ... (Load Leaderboard & StartGame ใช้โค้ดเดิมได้เลยครับ หรือก๊อปจากอันก่อนหน้า) ...
function initLeaderboard() {
    const list = document.getElementById('top-players-list');
    db.collection("scores").orderBy("score", "desc").limit(5)
      .onSnapshot(snapshot => {
          list.innerHTML = "";
          snapshot.forEach(doc => {
              const d = doc.data();
              const li = document.createElement("li");
              li.innerHTML = `<span>${d.name}</span> <span>${d.score} ⭐</span>`;
              list.appendChild(li);
          });
      });
}
initLeaderboard();

async function startGame() {
    const name = document.getElementById('player-name').value;
    const email = document.getElementById('player-email').value;
    if(!name || !email) { alert("กรุณากรอกข้อมูลให้ครบ"); return; }
    player.name = name; player.email = email;
    playSound('bgm'); playSound('engine');

    try {
        const doc = await db.collection("scores").add({
            name: player.name, email: player.email, score: 0, timestamp: new Date()
        });
        player.dbId = doc.id;
    } catch(e) {}

    try {
        const res = await fetch('questions.json');
        allQuestions = await res.json();
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        loadLevel(1);
        gameLoop();
    } catch(e) { alert("Error loading JSON"); }
}

function loadLevel(lvl) {
    currentLevel = lvl; qIndex = 0;
    levelQuestions = allQuestions.filter(q => q.level === currentLevel);
    document.getElementById('level-val').innerText = currentLevel;
    waterSpeed = 4 + (lvl * 1.5);
    showQuestion();
}

function showQuestion() {
    if(qIndex >= levelQuestions.length) {
        if(currentLevel < 5) loadLevel(currentLevel + 1);
        else { 
            sounds.bgm.pause(); sounds.engine.pause();
            alert("🏆 จบการผจญภัย! คะแนนรวม: " + player.score); 
            location.reload(); 
        }
        return;
    }
    const q = levelQuestions[qIndex];
    document.getElementById('question-overlay').style.display = 'block';
    document.getElementById('q-text').innerText = `${qIndex+1}. ${q.question}`;
    
    const container = document.getElementById('options-display');
    container.innerHTML = "";
    const prefix = ["A", "B", "C", "D", "E"];
    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-text';
        div.innerHTML = `<b>${prefix[idx]}</b> ${opt}`;
        container.appendChild(div);
    });

    timeLeft = 10; isGameActive = true; updateTimerUI();
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--; updateTimerUI();
        if(timeLeft <= 0) { clearInterval(timerInterval); checkAnswer(); }
    }, 1000);
}

function updateTimerUI() {
    const el = document.getElementById('time-val');
    el.innerText = timeLeft;
    el.parentElement.style.background = timeLeft <= 3 ? "red" : "#ff4500";
}

// ==========================================
// 6. CHECK ANSWER (ตรวจสอบโซน)
// ==========================================
function checkAnswer() {
    isGameActive = false; boat.tilt = 0;

    // คำนวณโซน (แบ่งหน้าจอเป็น 5 ส่วน แม้ขับอิสระแต่ต้องจอดให้ถูกโซน)
    const zoneWidth = canvas.width / 5;
    const centerBoatX = boat.x + (boat.w / 2);
    const selectedZone = Math.floor(centerBoatX / zoneWidth);
    
    const q = levelQuestions[qIndex];
    const correctZone = q.correctIndex;
    const zoneNames = ["A", "B", "C", "D", "E"];

    if(selectedZone === correctZone) {
        player.score++;
        playSound('correct');
        if(player.dbId) db.collection("scores").doc(player.dbId).update({ score: player.score });
    } else {
        playSound('wrong');
        alert(`❌ ผิด! เรือคุณอยู่โซน ${zoneNames[selectedZone] || '?'}\nเฉลย: โซน ${zoneNames[correctZone]}\n(${q.reason})`);
    }

    document.getElementById('score-val').innerText = player.score;
    qIndex++;
    setTimeout(showQuestion, 1500);
}

// ==========================================
// 7. DRAW LOOP (วาดทะเลและเรือ)
// ==========================================
function getWaterColor() {
    // สีน้ำทะเลแต่ละด่าน (ลึกขึ้นเรื่อยๆ)
    const c = ["#0077b6", "#023e8a", "#0096c7", "#03045e", "#001219"];
    return c[currentLevel-1] || "#0077b6";
}

function draw() {
    if(isGameActive) waterOffset += waterSpeed;
    if(waterOffset > 50) waterOffset = 0;

    // 1. วาดพื้นน้ำ
    ctx.fillStyle = getWaterColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. วาดคลื่น (Waves)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    for(let i=0; i<canvas.height; i+=50) {
        let y = i + waterOffset; 
        if(y > canvas.height) y -= canvas.height; // วนลูปคลื่น
        
        ctx.beginPath();
        ctx.moveTo(0, y);
        // วาดเส้นหยักๆ
        for(let x=0; x<canvas.width; x+=30) {
            ctx.lineTo(x, y + Math.sin(x)*5);
        }
        ctx.stroke();
    }

    // 3. วาดเส้นแบ่งโซนคำตอบ (แบบจางๆ บนน้ำ)
    const zoneWidth = canvas.width / 5;
    const labels = ["A", "B", "C", "D", "E"];
    ctx.textAlign = "center";
    ctx.font = "bold 40px Kanit";
    
    for(let i=0; i<5; i++) {
        // วาดทุ่นลอยน้ำ (Buoy) แทนเส้นถนน
        let buoyY = (canvas.height - 150) + Math.sin(Date.now()/300 + i)*10; // ทุ่นลอยขึ้นลง
        
        // วาดตัวทุ่น
        ctx.fillStyle = "#ff9f1c"; // สีส้ม
        ctx.beginPath();
        ctx.arc((i*zoneWidth) + (zoneWidth/2), buoyY, 20, 0, Math.PI*2);
        ctx.fill();
        
        // วาดตัวอักษรบนทุ่น
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Arial";
        ctx.fillText(labels[i], (i*zoneWidth) + (zoneWidth/2), buoyY + 7);
        
        // เส้นแบ่งโซนจางๆ
        if(i > 0) {
            ctx.strokeStyle = "rgba(255,255,255,0.1)";
            ctx.setLineDash([10, 20]);
            ctx.beginPath();
            ctx.moveTo(i*zoneWidth, 0);
            ctx.lineTo(i*zoneWidth, canvas.height);
            ctx.stroke();
        }
    }

    // 4. วาดเรือ (Boat)
    ctx.save(); // บันทึกสถานะ Canvas
    
    // ย้ายจุดหมุนไปที่กลางลำเรือ
    ctx.trans