// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBLMBPPC_uD02vCdVows-XrFoMpTYzAmoc",
  authDomain: "science-boat-game.firebaseapp.com",
  projectId: "science-boat-game",
  storageBucket: "science-boat-game.firebasestorage.app",
  messagingSenderId: "81751932895",
  appId: "1:81751932895:web:04b1ffdaed5c6fc1284e6a"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// 2. AUDIO SYSTEM (ระบบเสียง)
// ==========================================
const sounds = {
    bgm: new Audio('bgm.mp3'),
    engine: new Audio('engine.mp3'),
    correct: new Audio('correct.mp3'),
    wrong: new Audio('wrong.mp3')
};

// ตั้งค่าเสียง
sounds.bgm.loop = true;    
sounds.bgm.volume = 0.4;   
sounds.engine.loop = true; 
sounds.engine.volume = 0.2; 

function playSound(name) {
    if(sounds[name]) {
        sounds[name].currentTime = 0; 
        sounds[name].play().catch(e => console.log("ยังไม่ได้โหลดเสียง: " + name));
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

// ใช้ตัวแปร car แทนเรือ (เพื่อให้เข้ากับ logic เดิม)
let car = { x: 0, y: 0, w: 0, h: 0 }; 

// ตัวแปรสำหรับผิวน้ำ
let roadOffset = 0; 
let roadSpeed = 8; 

// ==========================================
// 4. INPUT HANDLING (ระบบสัมผัส/เมาส์)
// ==========================================
function startDrag(e) {
    if (!isGameActive) return;
    isDragging = true;
    moveCar(e);
}
function stopDrag() { isDragging = false; }
function drag(e) {
    if (isDragging && isGameActive) moveCar(e);
}

function moveCar(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.clientX;
    if(e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;

    // คำนวณตำแหน่งเรือให้อยู่ตรงกลางนิ้ว/เมาส์
    car.x = clientX - rect.left - (car.w / 2);
    
    // ป้องกันเรือออกนอกจอ
    if (car.x < 0) car.x = 0;
    if (car.x > canvas.width - car.w) car.x = canvas.width - car.w;
}

// Event Listeners
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', drag);
canvas.addEventListener('mouseup', stopDrag);
canvas.addEventListener('mouseleave', stopDrag);
canvas.addEventListener('touchstart', startDrag, {passive: false});
canvas.addEventListener('touchmove', drag, {passive: false});
canvas.addEventListener('touchend', stopDrag);

// ==========================================
// 5. GAME SYSTEM (ระบบเกมหลัก)
// ==========================================

// ฟังก์ชันออกจากเกม
function quitGame() {
    if(confirm("ต้องการออกจากเกมใช่หรือไม่? คะแนนรอบนี้จะไม่ถูกบันทึก")) {
        sounds.bgm.pause();
        sounds.engine.pause();
        location.reload();
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // ปรับขนาดเรือตามหน้าจอ
    car.w = canvas.width * 0.12; 
    if(car.w > 90) car.w = 90; // ไม่ให้ใหญ่เกินไป
    car.h = car.w * 2.0;       // เรือทรงยาว
    
    car.y = canvas.height - car.h - 50;
    
    // จัดตำแหน่งเริ่มต้นตรงกลาง
    if(car.x === 0) car.x = (canvas.width / 2) - (car.w / 2);
}
window.addEventListener('resize', resize);
resize();

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

    playSound('bgm');
    playSound('engine');

    // สร้าง Record คะแนนใหม่
    try {
        const doc = await db.collection("scores").add({
            name: player.name, email: player.email, score: 0, timestamp: new Date()
        });
        player.dbId = doc.id;
    } catch(e) { console.log("Offline Mode"); }

    // โหลดคำถาม
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
    currentLevel = lvl;
    qIndex = 0;
    levelQuestions = allQuestions.filter(q => q.level === currentLevel);
    document.getElementById('level-val').innerText = currentLevel;
    
    // ความเร็วสายน้ำ เพิ่มขึ้นตามเลเวล
    roadSpeed = 8 + (lvl * 2);
    
    showQuestion();
}

function showQuestion() {
    // เช็คว่าหมดคำถามในด่านหรือยัง
    if(qIndex >= levelQuestions.length) {
        if(currentLevel < 5) loadLevel(currentLevel + 1);
        else { 
            sounds.bgm.pause();
            sounds.engine.pause();
            alert("🏆 จบเกม! คะแนนรวม: " + player.score); 
            location.reload(); 
        }
        return;
    }

    const q = levelQuestions[qIndex];
    document.getElementById('question-overlay').style.display = 'flex'; // แสดงแบบ Flex (จัดกลาง)
    
    // อัปเดตเลขข้อและคำถาม
    document.getElementById('q-number').innerText = (qIndex + 1);
    document.getElementById('q-text').innerText = q.question;
    
    // สร้างตัวเลือก (Design ใหม่)
    const container = document.getElementById('options-display');
    container.innerHTML = "";
    const prefix = ["A", "B", "C", "D", "E"];
    
    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-btn'; // ใช้ Class ใหม่จาก CSS
        div.innerHTML = `<span class="option-badge">${prefix[idx]}</span> <span>${opt}</span>`;
        container.appendChild(div);
    });

    // ตั้งเวลา
    timeLeft = 10;
    isGameActive = true;
    updateTimerUI();
    
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        if(timeLeft <= 0) {
            clearInterval(timerInterval);
            checkAnswer();
        }
    }, 1000);
}

function updateTimerUI() {
    const el = document.getElementById('time-val');
    el.innerText = timeLeft;
    // เปลี่ยนสีพื้นหลัง Timer เมื่อใกล้หมดเวลา
    el.parentElement.style.background = timeLeft <= 3 
        ? "linear-gradient(135deg, #ff0000, #990000)" 
        : "linear-gradient(135deg, #ff512f, #dd2476)";
}

function checkAnswer() {
    isGameActive = false; // หยุดการขยับชั่วคราว
    
    const laneWidth = canvas.width / 5;
    const centerCarX = car.x + (car.w / 2);
    
    // คำนวณเลน (0-4) พร้อมป้องกันค่าเกิน
    let selectedLane = Math.floor(centerCarX / laneWidth);
    if (selectedLane < 0) selectedLane = 0;
    if (selectedLane > 4) selectedLane = 4;
    
    const q = levelQuestions[qIndex];
    const correctLane = q.correctIndex;
    const laneNames = ["A", "B", "C", "D", "E"];

    // ตรวจคำตอบ
    if(selectedLane === correctLane) {
        player.score++;
        playSound('correct');
        if(player.dbId) db.collection("scores").doc(player.dbId).update({ score: player.score });
    } else {
        playSound('wrong');
        // แจ้งเตือนเฉลย
        alert(`❌ ผิด! คุณเลือก ${laneNames[selectedLane]}\n\n✅ เฉลย: ${laneNames[correctLane]} (${q.options[correctLane]})\n💡 เหตุผล: ${q.reason}`);
    }

    document.getElementById('score-val').innerText = player.score;
    qIndex++;
    
    // ซ่อนคำถามชั่วคราวเพื่อให้เห็นฉากวิ่ง
    document.getElementById('question-overlay').style.display = 'none';
    
    setTimeout(showQuestion, 1500); // รอ 1.5 วินาทีแล้วขึ้นข้อใหม่
}

// ==========================================
// 6. DRAW LOOP (การวาดกราฟิก)
// ==========================================

function getWaterColor() {
    // ไล่เฉดสีน้ำตามด่าน
    const c = ["#4fc3f7", "#29b6f6", "#039be5", "#0277bd", "#01579b"];
    return c[currentLevel-1] || "#0288d1";
}

function draw() {
    // --- 1. คำนวณการเคลื่อนที่ของน้ำ ---
    if(isGameActive) {
        roadOffset += roadSpeed;
        if(roadOffset > 60) roadOffset = 0; // รีเซ็ต Loop
    }

    // --- 2. วาดผิวน้ำ ---
    ctx.fillStyle = getWaterColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const laneWidth = canvas.width / 5;
    const labels = ["A", "B", "C", "D", "E"];

    ctx.textAlign = "center";
    ctx.font = "bold 50px Kanit";

    for(let i=0; i<5; i++) {
        // วาดเส้นทุ่นแบ่งเลน
        if(i > 0) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 50]); // เส้นปะแบบทุ่นลอย
            ctx.lineDashOffset = -roadOffset; 
            
            ctx.beginPath();
            ctx.moveTo(i*laneWidth, 0);
            ctx.lineTo(i*laneWidth, canvas.height);
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash
        }

        // ตัวอักษรเลน (A, B, C...)
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillText(labels[i], (i*laneWidth) + (laneWidth/2), canvas.height - 150);
    }

    // --- 3. วาดเรือ (Boat) ---
    // ทำให้เรือสั่นเล็กน้อยเวลาวิ่ง
    let shake = isGameActive ? (Math.random() * 3 - 1.5) : 0; 
    let boatX = car.x + shake;
    let boatY = car.y;
    let w = car.w;
    let h = car.h;

    // 3.1 วาดคลื่นท้ายเรือ (Wake Effect)
    if (isGameActive) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.beginPath();
        ctx.moveTo(boatX + w/2, boatY + h);
        // วาดสามเหลี่ยมคลื่นแยกออกไปสองข้าง
        ctx.lineTo(boatX - 20, boatY + h + 80 + (Math.random()*15)); 
        ctx.lineTo(boatX + w + 20, boatY + h + 80 + (Math.random()*15)); 
        ctx.fill();
    }

    // 3.2 ตัวเรือ (Hull)
    ctx.shadowBlur = 15; ctx.shadowColor = "rgba(0,0,0,0.6)";
    
    // สีตัวเรือ (ส้มแดง)
    ctx.fillStyle = "#FF5722"; 
    ctx.beginPath();
    ctx.moveTo(boatX + w/2, boatY); // หัวเรือ
    // เส้นโค้งกาบเรือ
    ctx.bezierCurveTo(boatX + w, boatY + h*0.3, boatX + w, boatY + h*0.9, boatX + w - 10, boatY + h); 
    ctx.lineTo(boatX + 10, boatY + h); // ท้ายเรือ
    ctx.bezierCurveTo(boatX, boatY + h*0.9, boatX, boatY + h*0.3, boatX + w/2, boatY); 
    ctx.fill();

    // 3.3 ห้องคนขับ / รายละเอียด (Cockpit)
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ECEFF1"; // สีขาว/เทาอ่อน
    ctx.beginPath();
    ctx.ellipse(boatX + w/2, boatY + h*0.55, w*0.25, h*0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // ลายคาดเรือ (Stripe)
    ctx.fillStyle = "#FFD600"; // สีเหลืองทอง
    ctx.fillRect(boatX + w/2 - 6, boatY + h * 0.25, 12, h * 0.2);
}

function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}