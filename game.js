const CONFIG = {
    startingCash: 10000, monthlyIncome: 9000, fixedMonthlyExpense: 6500, maxStress: 100, winCash: 100000, maxDebt: 50000, debtInterestRate: 0.05,
    savingsInterestRate: 0.02, weeksPerMonth: 4, maxTurnActions: 2, maxHistoryItems: 10
};

let gameState = {
    cash: CONFIG.startingCash, savings: 0, debt: 0, assets: 0, fatigue: 18,
    happiness: 40, stress: 20, knowledge: 8, turn: 1, month: 1, turnsUntilNextSalary: 4,
    actionsTaken: 0, actionCooldowns: new Map(), history: [], monthlyBalance: 0,
    variableExpenses: 0, vacationCooldown: 0, hasInsurance: false, insurancePremium: 0,
    monthlyIncome: CONFIG.monthlyIncome, happinessNextTurn: 0, goal: null, 
    unlockedEvents: new Set(), goalCooldowns: new Map(), // เพิ่ม goalCooldowns
    savingKnowledge: { id: 'saving', progress: 0, cooldown: 0, completed: false },
    financeBasics: { id: 'financeBasics', progress: 0, cooldown: 0, completed: false }, // true
    insuranceKnowledge: { id: 'insurance', progress: 0, cooldown: 0, completed: false },
    hasInsurance: false, insurancePremium: 0, insuranceDuration: 0,
    loanKnowledge: { id: 'loan', progress: 0, cooldown: 0, completed: false },
    alertedDebtWarning: false, alertedFatigueWarning: false,
    lastNewJobOfferTurn: null, lastOutstandingWorkTurn: null, lastWorkBonusTurn: null, lastWorkOTTurn: null, Rewardyourself: null, RewardyourselfByplay: null, smartphontbroked: null,
    lastMinorIllnessTurn: null, lastWorkMistakeTurn: null, workActionCount: 0
};

const goals = [
    { id: 'pay-debt-2000', desc: 'ชำระหนี้ 2,000 บาทใน 3 เทิร์น', turns: 3, reward: { cash: 500, happiness: 10 }, condition: () => gameState.debt >= 2000 },
    { id: 'save-5000', desc: 'ฝากเงิน 5,000 บาทใน 7 เทิร์น', turns: 8, reward: { cash: 1000, happiness: 5 }, condition: () => gameState.savingKnowledge.completed },
    { id: 'knowledge-plus-20', desc: 'ความรู้มากกว่าปัจจุบัน 20 แต้มใน 16 เทิร์น', turns: 16, reward: { cash: 2000, happiness: 5 }, condition: () => gameState.knowledge < 80 && gameState.turn > 14 },
    { id: 'work-3-times', desc: 'ทำงานเพิ่มเติม 3 ครั้งใน 5 เทิร์น ', turns: 5, reward: { cash: 1000, knowledge: 5 }, condition: () => gameState.turn > 5 && !gameState.goalCooldowns.has('work-3-times') }
];

const events = [
    { type: 'good', prob: 0.40, events: [ //0.40
        { name: 'รางวัลกับตัวเองที่แสนสนุก' , decision: true, desc: 'เนื่องจากทำงานหนัก คุณจึงอยากให้รางวัลกับตัวเองด้วยการเล่นเกม EldenRing', condition: () => gameState.turn > 3 && (gameState.RewardyourselfByplay === null || gameState.turn - gameState.RewardyourselfByplay >= 5), acceptEffect: () => ({ cash: -1400, happiness: 8, stress: -3, desc: 'คุณซื้อเกม EldenRing ที่คุณอยากเล่นเป็นรางวัลคลายเครียดสำหรับคุณ (-1400 บาท)' }), rejectEffect: () => ({ fatigue: 8, desc: 'คุณได้แต่ร้องไห้แล้วดูคลิปเกม EldenRing แล้วหวังว่าจะได้เล่นเกมนั้นในอนาคต'})},
        { name: 'รางวัลกับตัวเองที่หอมหวาน' , decision: true, desc: 'เนื่องจากทำงานหนัก คุณจึงอยากให้รางวัลกับตัวเอง', condition: () => gameState.turn > 3 && (gameState.Rewardyourself === null || gameState.turn - gameState.Rewardyourself >= 4), acceptEffect: () => ({ cash: -750, happiness: 5, fatigue: -5, desc: 'คุณซื้ออาหารชุดใหญ่สำหรับการทำงานที่แสนเหนื่อย (-750 บาท)' }), rejectEffect: () => ({ desc: 'คุณยอมรับที่จะทนต่อไปโดยหวังว่าจะสบายในภายหลัง'})},
        { name: 'โอกาสเอาเงินเข้ากระเป๋า' , decision: true, desc: 'หัวหน้าขอให้คุณทำงานล่วงเวลา 2 ชม. โดยจะให้รางวัลเล็กๆกับคุณหากคุณรับข้อเสนอ ', condition: () => gameState.turn > 6 && (gameState.lastWorkOTTurn === null || gameState.turn - gameState.lastWorkOTTurn >= 6), acceptEffect: () => ({ cash: 500, fatigue: 5, desc: 'คุณตอบรับคำขอจากหัวหน้า และทำงานล่วงเวลา ได้รับรางวัลจากหัวหน้า (+500 บาท)' }), rejectEffect: () => ({ desc: 'คุณปฏิเสธข้อเสนอและยืนยันที่จะไม่ทำต่อ'})},
        { name: 'โบนัสงาน', effect: () => ({ cash: 1500, happiness: 5, stress: -3, desc: 'โบนัสงาน (+1,500 บาท)' }), condition: () => gameState.fatigue > 50 && (gameState.lastWorkBonusTurn === null || gameState.turn - gameState.lastWorkBonusTurn >= 8)},
        { name: 'ผลงานยอดเยี่ยมจากความสุข' , decision: true, desc: 'ความสุขสูงทำให้คุณทำงานได้ยอดเยี่ยม! รับโบนัสเงินสด 2,000 บาท', condition: () => gameState.happiness >= 90 && (gameState.lastOutstandingWorkTurn === null || gameState.turn - gameState.lastOutstandingWorkTurn >= 5), acceptEffect: () => ({ cash: 2000, stress: -5, desc: 'รับโบนัสเงินสดจากผลงานยอดเยี่ยม (+2,000 บาท)' }), rejectEffect: () => ({ stress: -15, happiness: 5, fatigue: 5, desc: 'คุณยกความดีความชอบให้เพื่อนร่วมงาน'})}
    ]},
    { type: 'bad', prob: 0.57, events: [ //0.57
        { name: 'การรับชมที่ต้องใช้จ่าย' , decision: true, desc: 'ช่วงนี้โทรศัพท์ของคุณดับบ่อยๆระหว่างดู TikTok คุณเลยคิดว่าอาจจะถึงเวลาซื้อใหม่?', condition: () => gameState.turn > 3 && (gameState.smartphontbroked === null || gameState.turn - gameState.smartphontbroked >= 8), acceptEffect: () => ({cash: -7990, happiness: 8, desc: 'คุณได้รับโทรศัพท์เครื่องใหม่ (-7990 บาท)'}), rejectEffect: () => ({ cash: -1400, stress: 8, fatigue: 15, desc: 'คุณต้องซ่อมโทรศัพท์ (-1400 บาท)' })},
        { name: 'ป่วยเล็กน้อย' , decision: true, desc: 'จ่ายค่ารักษาพยาบาล 1,500 บาท หรือยอมทนป่วย?', condition: () => gameState.turn > 3 && (gameState.lastMinorIllnessTurn === null || gameState.turn - gameState.lastMinorIllnessTurn >= 6), acceptEffect: () => ({cash: -(gameState.hasInsurance ? 150 : 1500), desc: `จ่ายค่ารักษาพยาบาล ( -${(gameState.hasInsurance ? 150 : 1500).toLocaleString()} บาท ${gameState.hasInsurance ? ' ประกัน Co-pay 10% ' : ''})`}), rejectEffect: () => ({ stress: 8, fatigue: 25, desc: 'ยอมทนป่วย' }) },
        { name: 'ทำงานผิดพลาดจากความเหนื่อย' , decision: true, desc: 'ความเหนื่อยล้าสูงทำให้คุณทำงานผิดพลาด! จ่ายค่าปรับ 2,000 บาท หรือยอมรับการตำหนิ?', condition: () => gameState.fatigue >= 75 && (gameState.lastWorkMistakeTurn === null || gameState.turn - gameState.lastWorkMistakeTurn >= 5), acceptEffect: () => ({ cash: -2000, stress: 5, desc: 'จ่ายค่าปรับจากความผิดพลาด (-2,000 บาท)' }), rejectEffect: () => ({ stress: 15, happiness: -18, desc: 'ยอมรับการตำหนิจากความผิดพลาด'})}
    ]},
    { type: 'rare', prob: 0.03, events: [ //0.03
        { name: 'ข้อเสนอซื้อบ้านในช่วงราคาถูก', decision: true, requiredKnowledge: 25,  desc: 'ซื้อบ้านราคาถูก ( เงินสด -62,400 บาท รวมค่าธรรมเนียม, มูลค่าบ้าน +80,000 บาท)?', acceptEffect: () => ({ cash: -62400, assets: 80000, happiness: 35, stress: 8, desc: ' คุณซื้อบ้านในราคา (62,400 บาท รวมค่าธรรมเนียม, มูลค่าบ้าน 80,000 บาท)' }), rejectEffect: () => ({ happiness: -18, stress: 5, desc: 'ปฏิเสธข้อเสนอซื้อบ้านในช่วงราคาถูก' }) },
        { name: 'ข้อเสนองานใหม่', requiredKnowledge: 38,  effect: () => { gameState.monthlyIncome += 2000; return { happiness: 20, stress: 18, fatigue: 10, desc: `ข้อเสนองานใหม่ (เงินเดือนเริ่มต้น ${gameState.monthlyIncome.toLocaleString()} บาท)` }; } }
    ]}
];

const swalConfig = {
    customClass: { popup: 'bg-gray-900 bg-opacity-80 text-white rounded-lg max-w-md w-full border border-gray-700 shadow-md backdrop-blur-md', title: 'text-gray-100 text-xl font-semibold mb-3', confirmButton: 'bg-blue-900 hover:bg-blue-800 text-white font-medium py-2 px-4 rounded-md transition duration-200', denyButton: 'bg-red-900 hover:bg-red-800 text-white font-medium py-2 px-4 rounded-md transition duration-200', cancelButton: 'bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition duration-200' },
    confirmButtonText: 'ตกลง', cancelButtonText: 'ยกเลิก', allowOutsideClick: true, allowEscapeKey: true, backdrop: 'rgba(0,0,0,0.5)'
};

const handleError = (fn, errorMsg) => async (...args) => { try { return await fn(...args); } catch (e) { addHistory('error', `${errorMsg}: ${e.message}`); } };
const closeSwal = handleError(async () => { if (Swal.isVisible()) { await Swal.close(); await new Promise(r => setTimeout(r, 300)); } }, 'closeSwal');
const showAlert = handleError(async (title, text, icon, options = {}) => {
    await closeSwal();
    return await Swal.fire({ title, text, icon, showConfirmButton: true, showCancelButton: options.showDenyButton || options.showCancelButton, ...swalConfig, ...options });
}, 'showAlert');

const addHistory = handleError((type, desc, amount = 0) => {
    if (!type || !desc || typeof amount !== 'number' || gameState.history.some(item => item.turn === gameState.turn && item.desc === desc)) return;
    gameState.history.push({ id: Date.now(), turn: gameState.turn, type, desc, amount });
    if (gameState.history.length > CONFIG.maxHistoryItems) gameState.history.shift();
}, 'addHistory');

const tryWithdrawFromSavings = handleError(async (shortfall, purpose) => {
    if (!gameState.savingKnowledge.completed || gameState.savings <= 0) {
        addHistory('financial', `ไม่สามารถถอนเงินฝากเพื่อ${purpose} เนื่องจาก${!gameState.savingKnowledge.completed ? 'ยังไม่ได้เรียนการออมเงิน' : 'เงินฝากเป็น 0'}`);
        return false;
    }
    if (gameState.savings < shortfall) {
        gameState.cash += gameState.savings;
        addHistory('financial', `ถอนเงินจากเงินฝาก (+${gameState.savings.toLocaleString()} บาท) เพื่อ${purpose} (ไม่พอ, ต้องกู้เพิ่ม)`, gameState.savings);
        gameState.savings = 0;
        return false;
    }
    gameState.cash += shortfall;
    gameState.savings -= shortfall;
    addHistory('financial', `ถอนเงินจากเงินฝาก (+${shortfall.toLocaleString()} บาท) เพื่อ${purpose}`, shortfall);
    return true;
}, 'tryWithdrawFromSavings');

const DOMCache = {};
document.addEventListener('DOMContentLoaded', () => {
    ['cash', 'savings', 'expense', 'balance', 'debt', 'assets', 'debt-interest','debt-interest-container', 'turn', 'month', 'insurance-premium', 'income', 'turns-until-salary', 'goal', 'history-log', 'fatigue-bar', 'happiness-bar', 'stress-bar', 'knowledge-bar', 'savings-container', 'insurance-container', 'work-btn', 'rest-btn', 'study-btn', 'buy-btn', 'finance-btn', 'knowledge-btn', 'next-turn-btn', 'loading-screen'].forEach(id => {
        DOMCache[id] = document.getElementById(id);
        if (!DOMCache[id]) addHistory('error', `ไม่พบ element ID "${id}" ใน UI`);
    });
});

const updateUI = handleError(() => {
    const updateElement = (id, value) => {
        if (DOMCache[id]) DOMCache[id].textContent = value.toLocaleString ? value.toLocaleString() : value;
        else addHistory('error', `ไม่พบ element ID "${id}" ใน UI`);
    };
    const numericIds = {
        cash: gameState.cash,
        savings: gameState.savings,
        expense: CONFIG.fixedMonthlyExpense + gameState.variableExpenses + gameState.insurancePremium,
        balance: gameState.monthlyBalance,
        debt: gameState.debt,
        assets: gameState.assets,
        'debt-interest': gameState.loanKnowledge.completed ? Math.floor(gameState.debt * CONFIG.debtInterestRate) : '0',
        turn: gameState.turn,
        month: gameState.month,
        'insurance-premium': gameState.insurancePremium,
        income: gameState.monthlyIncome,
        'turns-until-salary': gameState.turnsUntilNextSalary
    };
    Object.entries(numericIds).forEach(([id, value]) => updateElement(id, value));

    if (DOMCache['debt-interest-container']) {
        DOMCache['debt-interest-container'].classList.toggle('hidden', !gameState.loanKnowledge.completed);
    } else {
        addHistory('error', `ไม่พบ element ID "debt-interest-container" ใน UI`);
    }

    ['fatigue', 'happiness', 'stress', 'knowledge'].forEach(stat => {
        if (DOMCache[`${stat}-bar`]) {
            const percentage = Math.max(0, Math.min(100, gameState[stat]));
            DOMCache[`${stat}-bar`].style.width = `${percentage}%`;
            const rawValue = Math.floor(gameState[stat]);
            DOMCache[`${stat}-bar`].setAttribute('data-tooltip', `${stat === 'fatigue' ? 'ความเหนื่อย' : stat === 'happiness' ? 'ความสุข' : stat === 'stress' ? 'ความเครียด' : 'ความรู้'}: ${Math.floor(percentage)}%`);
        } else {
            addHistory('error', `ไม่พบ bar ID "${stat}-bar" ใน UI`);
        }
    });

    if (gameState.debt >= 45000 && gameState.debt < CONFIG.maxDebt && !gameState.alertedDebtWarning) {
        showAlert('คำเตือน!', 'หนี้ของคุณใกล้ถึงขีดจำกัด 50,000 บาท!', 'warning');
        gameState.alertedDebtWarning = true;
    }
    if (gameState.fatigue >= 80 && gameState.fatigue < 100 && !gameState.alertedFatigueWarning) {
        showAlert('คำเตือน!', 'ความเหนื่อยของคุณใกล้ถึงขีดจำกัด!', 'warning');
        gameState.alertedFatigueWarning = true;
    }

    if (DOMCache['goal']) DOMCache['goal'].textContent = gameState.goal ? `${gameState.goal.desc} (เหลือ ${gameState.goal.turnsRemaining} เทิร์น)` : 'ไม่มีเป้าหมายในขณะนี้';
    else addHistory('error', `ไม่พบ element ID "goal" ใน UI`);

    const elementsToToggle = [
        { id: 'savings-container', condition: !gameState.savingKnowledge.completed },
        { id: 'insurance-container', condition: !gameState.hasInsurance },
        { id: 'knowledge-btn', condition: !gameState.financeBasics.completed },
        { id: 'finance-btn', condition: !gameState.financeBasics.completed || (!gameState.savingKnowledge.completed && !gameState.insuranceKnowledge.completed && !gameState.loanKnowledge.completed) } // แก้ไขเงื่อนไขที่นี่
    ];
    elementsToToggle.forEach(({ id, condition }) => {
        if (DOMCache[id]) DOMCache[id].classList.toggle('hidden', condition);
        else addHistory('error', `ไม่พบ element ID "${id}" ใน UI`);
    });

    if (DOMCache['history-log']) {
        DOMCache['history-log'].innerHTML = gameState.history
            .filter(item => item.turn >= gameState.turn - 1)
            .sort((a, b) => b.id - a.id)
            .slice(0, CONFIG.maxHistoryItems)
            .map(item => {
                if (!item?.type || !item.desc) return '';
                const turnLabel = item.turn === gameState.turn ? 'เทิร์นปัจจุบัน' : 'เทิร์นก่อนหน้า';
                const amountDisplay = item.amount === 0 ? '-' : (item.amount > 0 ? `+${item.amount.toLocaleString()}` : item.amount.toLocaleString());
                return `<tr class="history-${item.type} ${item.turn === gameState.turn ? 'text-white-200 shadow-md' : 'text-gray-400'}" style="${item.turn === gameState.turn ? 'text-shadow: 0 0 5px rgba(59, 130, 246, 0.5)' : ''}">
                    <td class="px-4 py-2">${turnLabel}</td>
                    <td class="px-4 py-2">${{ action: 'การกระทำ', event: 'เหตุการณ์', financial: 'การเงิน', error: 'ข้อผิดพลาด' }[item.type]}</td>
                    <td class="px-4 py-2">${item.desc}</td>
                    <td class="px-4 py-2">${amountDisplay}</td>
                </tr>`;
            }).join('');
    } else addHistory('error', `ไม่พบ element ID "history-log" ใน UI`);

    ['work-btn', 'rest-btn', 'study-btn', 'buy-btn', 'finance-btn', 'knowledge-btn', 'next-turn-btn'].forEach(id => {
        if (DOMCache[id]) {
            const disabled = id !== 'next-turn-btn' && (gameState.vacationCooldown > 0 || gameState.actionsTaken >= CONFIG.maxTurnActions);
            DOMCache[id].disabled = disabled;
            DOMCache[id].classList.toggle('opacity-50', disabled);
            DOMCache[id].classList.toggle('cursor-not-allowed', disabled);
        } else addHistory('error', `ไม่พบปุ่ม ID "${id}" ใน UI`);
    });
}, 'updateUI');

const checkUnlockedEvents = handleError(async () => {
    const unlocked = events.flatMap(eventType => eventType.events
        .filter(event => event.requiredKnowledge && gameState.knowledge >= event.requiredKnowledge && !gameState.unlockedEvents.has(event.name))
        .map(event => {
            gameState.unlockedEvents.add(event.name);
            addHistory('event', `ปลดล็อคเหตุการณ์: ${event.name} (ต้องใช้ความรู้ ${event.requiredKnowledge})`);
            return event.name;
        }));
    if (unlocked.length) await showAlert('ปลดล็อคเหตุการณ์ใหม่!', `คุณปลดล็อคเหตุการณ์: ${unlocked.join(', ')}`, 'success');
}, 'checkUnlockedEvents');

const showKnowledgeDetail = handleError(async topicId => {
    await closeSwal();
    const knowledgeContent = {
        'finance-basics': { 
            title: 'การเงินพื้นฐาน', 
            html: `<div class="knowledge-card p-4 bg-gray-900 rounded-xl shadow-lg border border-gray-700 ">
                <div class="flex items-center mb-4">
                    <span class="text-yellow-400 text-xl mr-3">💡</span>
                    <h3 class="text-blue-300 text-lg font-semibold">การเงินพื้นฐาน</h3>
                </div>
                <p class="text-gray-200 text-sm font-medium leading-relaxed text-left space-y-4">
                    การเงินพื้นฐานสำหรับบุคคลทั่วไป อาจจะสงสัยว่าอะไรง่ายๆแบบนี้จะอธิบายให้ฟังทำไม? <br>
                    เพราะอะไรง่ายๆแบบนี้นี่แหละที่คนเราส่วนมากยังไม่เข้าใจ<br><br>
                    <span class="text-emerald-400 font-semibold">1. รู้จักรายรับ - รายจ่ายของตัวเอง</span><br>
                    <span class="text-gray-300">- เข้าใจว่ากระแสเงินของเราไหลไปที่ไหนในแต่ละเดือน</span><br><br>
                    <span class="text-emerald-400 font-semibold">2. วางแผนงบประมาณรายเดือน</span><br>
                    <span class="text-gray-300">- บริหารจัดสรรด้วยการแบ่งเงินออกเป็นส่วนๆ </span><br>
                    <span class="text-pink-400"><i>ตัวอย่างเช่น : แบ่ง 70% เป็นค่าใช้จ่ายจำเป็น 20% เป็นการออม และ 10% เป็นค่าใช้จ่ายฟุ่มเฟือย</i></span><br><br>
                </p>
                <span class="text-white "><i>"สิ่งสำคัญกว่าเงินคือความรู้ทางการเงิน "</i></span>
                    <span class="text-emerald-400 font-semibold ml-2"> โดย : Robert T Kiyosaki  <br><br>
            </div>` 
        },
        'saving': { 
            title: 'การออมเงิน', 
            html: `<div class="knowledge-card p-4 bg-gray-900 rounded-xl shadow-lg border border-gray-700 ">
                <div class="flex items-center mb-4">
                    <span class="text-yellow-400 text-xl mr-3">💰</span>
                    <h3 class="text-blue-300 text-lg font-semibold">การออมเงิน</h3>
                </div>
                <p class="text-gray-200 text-sm font-medium leading-relaxed text-left space-y-4">
                    การออมเงินคือการเก็บเงินส่วนหนึ่งจากรายได้ไว้ใช้ในอนาคต โดยไม่นำไปใช้จ่ายในปัจจุบัน เป็นการสร้างความมั่นคงทางการเงินและเตรียมพร้อมสำหรับเหตุการณ์ต่างๆ <br><br>
                    <span class="text-emerald-400 font-semibold">1. Pay yourself first</span><br>
                    <span class="text-gray-300">- เป็นแนวคิดทางการเงินที่ให้ความสำคัญกับการออมเงินก่อนที่จะนำไปจ่ายค่าใช้จ่ายอื่นๆ </span> <br>
                    <span class="text-pink-400"><i>ตัวอย่างเช่น : ได้เงินเดือนมา → ออมทันที → ที่เหลือค่อยใช้ </i><br>
                    </span><br>
                    <span class="text-emerald-400 font-semibold">2. มีเป้าหมายการออม</span><br>
                    <span class="text-gray-300">- การออมเงิน ควรมีเป้าหมายการออมของของตัวเองและไม่ควรมีน้อยกว่า 1 กอง  </span><br>
                    <span class="text-pink-400"><i> ตัวอย่างเช่น : ค่ารักษาพระยาบาล กองทุนฉุกเฉิน กองทุนเกษียณอายุ</i></span><br><br>
                    <span class="text-emerald-400 font-semibold">3. ควรเก็บเท่าไหร่?</span><br>
                    <span class="text-gray-300">- โดยปกติแล้วออมเดือนละ 10% ของรายได้ก็ถือว่าเริ่มต้นได้ดีแล้ว แต่หากเรามีกำลังมากพอก็แนะนำให้ออมเท่าไหนเท่านั้น ขอแค่สม่ำเสมอในการออมก็เพียงพอแล้ว</span><br><br>
                    
                </p>
                    <span class="text-white "><i>"เงินที่เก็บคือเงินที่หาได้ "</i></span>
                    <span class="text-emerald-400 font-semibold ml-2"> โดย: Benjamin Franklin  <br><br>
            </div>` 
        },
        'insurance': { 
            title: 'การประกันภัย', 
            html: `<div class="knowledge-card p-4 bg-gray-900 rounded-xl shadow-lg border border-gray-700 ">
                <div class="flex items-center mb-4">
                    <span class="text-yellow-400 text-xl mr-3">🛡️</span>
                    <h3 class="text-blue-300 text-lg font-semibold">การประกันภัย</h3>
                </div>
                <p class="text-gray-200 text-sm font-medium leading-relaxed text-left space-y-4">
                    ประกันคือการจ่ายเงินเล็กน้อยเพื่อโอนความเสี่ยง เช่น ค่ารักษาพยาบาล <br> ไปให้บริษัทประกันช่วยลดภาระค่าใช้จ่ายเมื่อเกิดเหตุไม่คาดคิด<br><br>
                    <span class="text-emerald-400 font-semibold">1. ประกันอะไรบ้าง</span><br>
                    <span class="text-gray-300">- ประกันชีวิต – คุ้มครองกรณีเสียชีวิต/ทุพพลภาพ เพื่อดูแลครอบครัว</span><br>
                    <span class="text-gray-300">- ประกันสุขภาพ – ช่วยค่ารักษาพยาบาลเมื่อเจ็บป่วยหรืออุบัติเหตุ</span><br>
                    <span class="text-gray-300">- ประกันอุบัติเหตุ – จ่ายเงินเมื่อเกิดอุบัติเหตุร้ายแรง</span><br>
                    <span class="text-gray-300">- ประกันทรัพย์สิน/รถยนต์ – คุ้มครองความเสียหายต่อทรัพย์สิน/รถ</span><br><br>
                    <span class="text-emerald-400 font-semibold">2. สิ่งสำคัญที่ต้องเข้าใจ</span><br>
                    <span class="text-gray-300"><span class="text-gray-300">- เบี้ยประกัน = เงินที่เราต้องจ่าย (รายเดือน/รายปี)</span><br>
                    <span class="text-gray-300">- ทุนประกัน = วงเงินสูงสุดที่บริษัทจ่ายให้เรา</span><br>
                    <span class="text-gray-300">- เงื่อนไข/ข้อยกเว้น = สิ่งที่ไม่ครอบคลุม เช่น โรคที่เป็นมาก่อนทำประกัน</span><br><br>
                    <span class="text-emerald-400 font-semibold">3. แล้วควรเลือกประกันอะไรดี?</span><br>
                    <span class="text-gray-300">- พูดให้เข้าใจง่ายๆก็คือ เลือกให้ตรงกับความเสี่ยงและเบี้ยที่จ่ายไหว</span><br><br>
                </p>
            </div>` 
        },
        'loan': { 
            title: 'การกู้เงิน', 
            html: `<div class="knowledge-card p-4 bg-gray-900 rounded-xl shadow-lg border border-gray-700 ">
                <div class="flex items-center mb-4">
                    <span class="text-yellow-400 text-xl mr-3">💸</span>
                    <h3 class="text-blue-300 text-lg font-semibold">หนี้สิน</h3>
                </div>
                <p class="text-gray-200 text-sm font-medium leading-relaxed text-left space-y-4">
                    สิ่งใดก็ตามที่ทำให้เงินออกจากกระเป๋าของเรา เช่น การกู้ยืมเงิน, การซื้อบ้านหรือรถยนต์ที่ต้องผ่อนจ่าย หรือการซื้อสินค้าและบริการที่ยังไม่ได้ชำระเงิน. <br><br>
                    <span class="text-emerald-400 font-semibold">1. หนี้ดี </span><br>
                    <span class="text-gray-300">- หนี้ดี: สิ่งที่เอาเงินเข้ากระเป๋าหรือสร้างรายได้ </span><br>
                    <span class="text-pink-400"><i>ตัวอย่างเช่น : กู้เงินซื้อ อสังหาริมทรัพย์ปล่อยเช่า → ได้ค่าเช่ามาจ่ายดอกและเพิ่มทรัพย์สิน</i></span><br><br>
                    <span class="text-emerald-400 font-semibold">2. หนี้ไม่ดี</span><br>
                    <span class="text-gray-300">- หนี้ไม่ดีหรือหนี้เสีย: หนี้บริโภคหรือสิ่งที่เอาเงินออกจากกระเป๋า แม้รถหรูหรือบ้านใหญ่ยังไม่หมดหนี้หรือจะปลดหนี้แล้ว แต่ถ้าไม่ได้ปล่อยเช่าหรือสร้างรายได้ ก็จัดถือว่าเป็นหนี้เสีย</span><br><br>
                    <span class="text-emerald-400 font-semibold">3. ดอกเบี้ย</span><br>
                    <span class="text-gray-300">- ราคาของการกู้/ยืมเงิน หรือผลตอบแทนหรือค่าใช้จ่ายที่เกิดจากการใช้เงิน <br> หนี้ของเราเป็นทรัพย์สินของคนอื่นเสมอ</span><br><br>
                    <span class="text-emerald-400 font-semibold">4. ใช้หนี้อย่างไรให้เป็นประโยชน์?</span><br>
                    <span class="text-gray-300">- ไม่ควรมีหนี้ตั้งแต่อายุยังน้อยหรือ 10 ปีแรกของทำงาน</span><br>
                    <span class="text-gray-300">- กู้เงินเพื่อสร้างทรัพย์สินไม่ใช่หนี้สิน (Good Debt)</span><br><br>
                </p>
            </div>` 
        },
    };
    await Swal.fire({ title: knowledgeContent[topicId]?.title || 'ไม่มีเนื้อหา', html: `<div class="knowledge-container grid grid-cols-1 gap-4 max-h-[70vh] overflow-y-auto px-4">${knowledgeContent[topicId]?.html || '<p class="text-gray-200 text-sm">ไม่มีเนื้อหาความรู้</p>'}</div>`, showConfirmButton: true, confirmButtonText: 'ปิด', ...swalConfig, customClass: { ...swalConfig.customClass, popup: 'bg-gray-900 bg-opacity-80 text-white rounded-lg max-w-2xl w-full border border-gray-700 shadow-md backdrop-blur-md' } });
}, 'showKnowledgeDetail');

const showKnowledgeLog = handleError(async () => {
    await closeSwal();
    if (!gameState.financeBasics.completed) {
        return await Swal.fire({
            title: 'คลังความรู้',
            html: '<div class="knowledge-container grid grid-cols-1 gap-4 max-h-[70vh] overflow-y-auto px-4"><p class="text-gray-200 text-sm">ไม่มีเนื้อหาความรู้ กรุณาเรียนรู้การเงินพื้นฐานก่อน!</p></div>',
            showConfirmButton: true,
            confirmButtonText: 'ปิด',
            ...swalConfig
        });
    }
    const knowledgeTopics = [
        ...(gameState.financeBasics.completed ? [{
            id: 'finance-basics',
            title: 'การเงินพื้นฐาน',
            emoji: '💡',
            desc: `การเงินพื้นฐานอาจดูง่าย แต่หลายคนยังมองข้าม!`
        }] : []),
        ...(gameState.savingKnowledge.completed ? [{
            id: 'saving',
            title: 'การออมเงิน',
            emoji: '💰',
            desc: `ทุกคนรู้ว่าควรออม แต่มีไม่กี่คนที่ลงมือทำ `
        }] : []),
        ...(gameState.insuranceKnowledge.completed ? [{
            id: 'insurance',
            title: 'การประกันภัย',
            emoji: '🛡️',
            desc: `ประกันไม่ได้ทำให้รวยขึ้น แต่ทำให้สิ่งที่สร้างมาไม่หายในคืนเดียว`
        }] : []),
        ...(gameState.loanKnowledge.completed ? [{
            id: 'loan',
            title: 'หนี้สิน',
            emoji: '💸',
            desc: `รถหรู บ้านใหญ่ ถ้าไม่สร้างรายได้…ก็ยังเป็นหนี้อยู่ดี`
        }] : [])
    ];
    if (!knowledgeTopics.length) {
        return await Swal.fire({
            title: 'คลังความรู้',
            html: '<div class="knowledge-container grid grid-cols-1 gap-4 max-h-[70vh] overflow-y-auto px-4"><p class="text-gray-200 text-sm">ไม่มีเนื้อหาความรู้เพิ่มเติม กรุณาเรียนรู้การออมเงิน การประกันภัย หรือการกู้เงิน!</p></div>',
            showConfirmButton: true,
            confirmButtonText: 'ปิด',
            ...swalConfig
        });
    }
    const gridCols = knowledgeTopics.length > 4 ? 'grid-cols-3' : knowledgeTopics.length > 2 ? 'grid-cols-2' : 'grid-cols-1';
    const cards = knowledgeTopics.map(t => `<div class="knowledge-card glassmorphism p-4 bg-gray-800 rounded-lg shadow-md border border-gray-700 cursor-pointer hover:border-white hover:bg-[#1a2330]" data-topic="${t.id}"><div class="flex items-center mb-2"><span class="text-yellow-400 text-lg mr-2">${t.emoji}</span><h3 class="text-blue-300 font-semibold text-base">${t.title}</h3></div><p class="text-gray-200 text-sm">${t.desc}</p></div>`).join('');
    await Swal.fire({
        title: 'คลังความรู้',
        html: `<div class="knowledge-container grid ${gridCols} gap-4 max-h-[70vh] overflow-y-auto px-4">${cards}</div>`,
        showConfirmButton: true,
        confirmButtonText: 'ปิด',
        ...swalConfig,
        customClass: {
            ...swalConfig.customClass,
            popup: `bg-gray-900 bg-opacity-80 text-white rounded-lg ${knowledgeTopics.length > 2 ? 'max-w-4xl' : 'max-w-xl'} w-full border border-gray-700 shadow-md backdrop-blur-md`
        },
        didOpen: () => document.querySelectorAll('.knowledge-card').forEach(card => card.addEventListener('click', async () => {
            await Swal.close();
            await new Promise(r => setTimeout(r, 300));
            await showKnowledgeDetail(card.getAttribute('data-topic'));
        }))
    });
}, 'showKnowledgeLog');

const checkGameStatus = handleError(async () => {
    const conditions = [
        { check: gameState.stress >= CONFIG.maxStress, msg: 'ความเครียดสูงเกินไป คุณแพ้!', icon: 'error' },
        { check: gameState.fatigue >= 100, msg: 'คุณเหนื่อยเกินไป คุณแพ้!', icon: 'error' },
        { check: gameState.cash >= CONFIG.winCash && gameState.debt === 0, msg: 'คุณปลดหนี้และมีเงิน 100,000 บาท คุณชนะ!', icon: 'success' },
        { check: gameState.debt >= CONFIG.maxDebt, msg: 'หนี้ถึง 50,000 บาท คุณล้มละลาย!', icon: 'error' }
    ];
    for (const { check, msg, icon } of conditions) {
        if (check) {
            await closeSwal();
            const result = await Swal.fire({
                title: 'เกมโอเวอร์!',
                text: `${msg}\nต้องการเริ่มเกมใหม่หรือไม่?`,
                icon: icon,
                showConfirmButton: true,
                confirmButtonText: 'เริ่มเกมใหม่',
                allowOutsideClick: false,
                allowEscapeKey: false,
                ...swalConfig
            });
            if (result.isConfirmed) {
                location.reload(); // รีเซ็ตเกมเมื่อผู้เล่นยืนยัน
            }
        }
    }
    return true;
}, 'checkGameStatus');
const applyFinancials = handleError(async () => {
    if ((gameState.turn - 1) % CONFIG.weeksPerMonth !== 0) return;
    if (gameState.savingKnowledge.completed) {
        const savingsInterest = Math.floor(gameState.savings * CONFIG.savingsInterestRate);
        if (savingsInterest > 0) {
            gameState.savings += savingsInterest;
            addHistory('financial', `เดือนที่ ${gameState.month}: ดอกเบี้ยเงินฝาก (+${savingsInterest.toLocaleString()} บาท)`, savingsInterest);
        }
    }
    const interest = Math.floor(gameState.debt * CONFIG.debtInterestRate);
    let newCash = gameState.cash;
    if (interest > 0) {
        newCash -= interest;
        if (newCash < 0) {
            const shortfall = -newCash;
            if (await tryWithdrawFromSavings(shortfall, `จ่ายดอกเบี้ยหนี้ ${interest.toLocaleString()} บาท`)) {
                newCash = gameState.cash - interest;
            } else if (gameState.loanKnowledge.completed && CONFIG.maxDebt - gameState.debt >= shortfall) {
                await closeSwal();
                const result = await Swal.fire({
                    title: 'เงินไม่พอสำหรับดอกเบี้ย!',
                    text: `ต้องการกู้หนี้ ${shortfall.toLocaleString()} บาทเพื่อจ่ายดอกเบี้ย ${interest.toLocaleString()} บาทหรือไม่?`,
                    showConfirmButton: true,
                    showDenyButton: true,
                    confirmButtonText: 'กู้หนี้',
                    denyButtonText: 'ยกเลิก',
                    ...swalConfig
                });
                if (result.isConfirmed) {
                    gameState.debt += shortfall;
                    gameState.cash += shortfall;
                    newCash = gameState.cash - interest;
                    addHistory('financial', `กู้หนี้ (+${shortfall.toLocaleString()} บาท) เพื่อจ่ายดอกเบี้ย (-${interest.toLocaleString()} บาท)`, shortfall - interest);
                    if (gameState.debt >= CONFIG.maxDebt) { updateUI(); return checkGameStatus(); }
                } else {
                    addHistory('financial', `ยกเลิกการจ่ายดอกเบี้ยหนี้ ${interest.toLocaleString()} บาท เนื่องจากเงินไม่พอ`);
                    return checkGameStatus();
                }
            } else {
                addHistory('financial', `ไม่สามารถจ่ายดอกเบี้ยหนี้ ${interest.toLocaleString()} บาท เนื่องจาก${gameState.loanKnowledge.completed ? 'หนี้ถึงขีดจำกัด' : 'ต้องเรียนรู้การกู้เงินก่อน!'}`);
                if (!gameState.loanKnowledge.completed) {
                    await showAlert('ข้อผิดพลาด', 'เงินสดไม่เพียงพอ!', 'error');
                }
                return checkGameStatus();
            }
        } else {
            addHistory('financial', `เดือนที่ ${gameState.month}: จ่ายดอกเบี้ยหนี้ (-${interest.toLocaleString()} บาท)`, -interest);
        }
    }
    newCash += gameState.monthlyIncome;
    addHistory('financial', `เดือนที่ ${gameState.month}: เงินเดือน (+${gameState.monthlyIncome.toLocaleString()} บาท)`, gameState.monthlyIncome);
    let totalExpenses = CONFIG.fixedMonthlyExpense;
    if (gameState.hasInsurance) totalExpenses += gameState.insurancePremium;
    newCash -= totalExpenses;
    addHistory('financial', `เดือนที่ ${gameState.month}: ค่าใช้จ่ายประจำ (-${CONFIG.fixedMonthlyExpense.toLocaleString()} บาท)`, -CONFIG.fixedMonthlyExpense);
    if (gameState.hasInsurance) {
        addHistory('financial', `เดือนที่ ${gameState.month}: จ่ายเบี้ยประกัน (-${gameState.insurancePremium.toLocaleString()} บาท)`, -gameState.insurancePremium);
    }
    if (newCash < 0) {
        const shortfall = -newCash;
        if (await tryWithdrawFromSavings(shortfall, `ค่าใช้จ่ายประจำ ${totalExpenses.toLocaleString()} บาท`)) {
            newCash = gameState.cash - totalExpenses;
        } else if (gameState.loanKnowledge.completed && CONFIG.maxDebt - gameState.debt >= shortfall) {
            await closeSwal();
            const result = await Swal.fire({
                title: 'เงินไม่พอสำหรับค่าใช้จ่ายประจำ!',
                text: `ต้องการกู้หนี้ ${shortfall.toLocaleString()} บาทเพื่อจ่ายค่าใช้จ่ายประจำหรือไม่?`,
                showConfirmButton: true,
                showDenyButton: true,
                confirmButtonText: 'กู้หนี้',
                denyButtonText: 'ยกเลิก',
                ...swalConfig
            });
            if (result.isConfirmed) {
                gameState.debt += shortfall;
                gameState.cash += shortfall;
                newCash = gameState.cash - totalExpenses;
                addHistory('financial', `กู้หนี้ (+${shortfall.toLocaleString()} บาท) เพื่อจ่ายค่าใช้จ่ายประจำ (-${totalExpenses.toLocaleString()} บาท)`, shortfall - totalExpenses);
                if (gameState.debt >= CONFIG.maxDebt) { updateUI(); return checkGameStatus(); }
            } else {
                addHistory('financial', `ยกเลิกการจ่ายค่าใช้จ่ายประจำ ${totalExpenses.toLocaleString()} บาท เนื่องจากเงินไม่พอ`);
                return checkGameStatus();
            }
        } else {
            addHistory('financial', `ไม่สามารถจ่ายค่าใช้จ่ายประจำ ${totalExpenses.toLocaleString()} บาท เนื่องจาก${gameState.loanKnowledge.completed ? 'หนี้ถึงขีดจำกัด' : 'ต้องเรียนรู้การกู้เงินก่อน!'}`);
            if (!gameState.loanKnowledge.completed) {
                await showAlert('ข้อผิดพลาด', 'เงินสดไม่เพียงพอ!', 'error');
            }
            return checkGameStatus();
        }
    }
    gameState.cash = newCash;
    gameState.monthlyBalance = gameState.monthlyIncome - totalExpenses;
    gameState.variableExpenses = 0;
    gameState.turnsUntilNextSalary = 4;
    updateUI();
}, 'applyFinancials');

const applyEvent = handleError(async () => {
    const rand = Math.random();
    let cumulative = 0;
    for (const eventType of events) {
        cumulative += eventType.prob;
        if (rand <= cumulative) {
            const availableEvents = eventType.events.filter(e => {
                if (e.name === 'ข้อเสนองานใหม่') {
                    return (!e.requiredKnowledge || gameState.knowledge >= e.requiredKnowledge) &&
                           (gameState.lastNewJobOfferTurn === null || 
                            gameState.turn - gameState.lastNewJobOfferTurn >= 20);
                }
                if (e.name === 'ผลงานยอดเยี่ยมจากความสุข') {
                    return e.condition();
                }
                if (e.name === 'ป่วยเล็กน้อย คุณต้องไปหาหมอ') {
                    return e.condition();
                }
                if (e.name === 'ทำงานผิดพลาดจากความเหนื่อย') {
                    return e.condition();
                }
                return (!e.requiredKnowledge || gameState.knowledge >= e.requiredKnowledge) &&
                       (!e.condition || e.condition());
            });
            if (!availableEvents.length) continue;
            const event = availableEvents[Math.floor(Math.random() * availableEvents.length)];
            await closeSwal();
            let effect, decisionAccepted = false;
            if (event.decision) {
                const result = await Swal.fire({
                    title: event.name,
                    text: event.desc,
                    showConfirmButton: true,
                    showDenyButton: true,
                    confirmButtonText: 'ยอมรับ',
                    denyButtonText: 'ปฏิเสธ',
                    ...swalConfig
                });
                if (result.isConfirmed) {
                    effect = event.acceptEffect();
                    decisionAccepted = true;
                } else if (result.isDenied || result.dismiss === Swal.DismissReason.backdrop || result.dismiss === Swal.DismissReason.cancel) {
                    effect = event.rejectEffect();
                    decisionAccepted = false;
                }
            } else {
                effect = event.effect();
                if (event.name === 'ข้อเสนองานใหม่') {
                    gameState.lastNewJobOfferTurn = gameState.turn;
                }
                if (event.name === 'โบนัสงาน') {
                    gameState.lastWorkBonusTurn = gameState.turn; // Update cooldown tracker for work bonus
                }
                
            }
            if (effect) {
                if (event.name === 'รางวัลกับตัวเองที่แสนสนุก') {
                    gameState.RewardyourselfByplay = gameState.turn; // Update cooldown tracker for work bonus
                }
                if (event.name === 'รางวัลกับตัวเองที่หอมหวาน') {
                    gameState.Rewardyourself = gameState.turn; // Update cooldown tracker for work bonus
                }
                if (event.name === 'โอกาสเอาเงินเข้ากระเป๋า') {
                    gameState.lastWorkOTTurn = gameState.turn; // Update cooldown tracker for work bonus
                }
                if (event.name === 'ผลงานยอดเยี่ยมจากความสุข') {
                    gameState.lastOutstandingWorkTurn = gameState.turn; // Update cooldown tracker
                }
                if (event.name === 'การรับชมที่ต้องใช้จ่าย') {
                    gameState.smartphontbroked = gameState.turn; // Update cooldown tracker for minor illness
                }
                if (event.name === 'ป่วยเล็กน้อย คุณต้องไปหาหมอ') {
                    gameState.lastMinorIllnessTurn = gameState.turn; // Update cooldown tracker for minor illness
                }
                if (event.name === 'ทำงานผิดพลาดจากความเหนื่อย') {
                    gameState.lastWorkMistakeTurn = gameState.turn; // Update cooldown tracker for work mistake
                }
                await applyEventEffect(event, effect, eventType.type, decisionAccepted);
                showNotification(effect.desc, eventType.type); // ใช้ Notification แทน Swal
            } else {
                showNotification(`ยกเลิกเหตุการณ์: ${event.name}`, 'event');
            }
            return;
        }
    }
    showNotification('ไม่มีเหตุการณ์เกิดขึ้นในเทิร์นนี้', 'event');
}, 'applyEvent');

const applyEventEffect = handleError(async (event, effect, eventType, decisionAccepted = false) => {
    const cashChange = effect.cash || 0;
    let loanMessage = '';
    if (cashChange < 0 && gameState.cash + cashChange < 0) {
        const shortfall = -(gameState.cash + cashChange);
        let canProceed = false;
        if (gameState.savingKnowledge.completed && gameState.savings > 0 && await tryWithdrawFromSavings(shortfall, event.name)) {
            gameState.cash += cashChange;
            if (cashChange < 0) gameState.variableExpenses += -cashChange;
            canProceed = true;
        } else if (gameState.loanKnowledge.completed && CONFIG.maxDebt - gameState.debt >= shortfall) { // เพิ่มการตรวจสอบ loanKnowledge.completed
            await closeSwal();
            const result = await Swal.fire({ 
                title: 'เงินไม่พอ!', 
                text: `ต้องการกู้หนี้ ${shortfall.toLocaleString()} บาทเพื่อ ${event.name} หรือไม่?`, 
                showConfirmButton: true, 
                showDenyButton: true, 
                confirmButtonText: 'กู้หนี้', 
                denyButtonText: 'ยกเลิก', 
                ...swalConfig 
            });
            if (result.isConfirmed) {
                gameState.debt += shortfall;
                gameState.cash += shortfall;
                gameState.cash += cashChange;
                if (cashChange < 0) gameState.variableExpenses += -cashChange;
                addHistory('event', `กู้หนี้ (+${shortfall.toLocaleString()} บาท) เพื่อ${event.name}`, shortfall);
                loanMessage = `กู้หนี้ ${shortfall.toLocaleString()} บาทเพื่อ `;
                canProceed = true;
                if (gameState.debt >= CONFIG.maxDebt) { updateUI(); return checkGameStatus(); }
            }
        }
        if (!canProceed) {
            addHistory('event', `ยกเลิก ${event.name} เนื่องจาก${gameState.loanKnowledge.completed ? 'เงินไม่พอและหนี้ถึงขีดจำกัด' : 'ต้องเรียนรู้การกู้เงินก่อน!'}`);
            if (!gameState.loanKnowledge.completed) {
                await showAlert('ข้อผิดพลาด', 'เงินสดไม่เพียงพอ!', 'error');
            }
            if (event.rejectEffect && decisionAccepted) await applyEventEffect(event, event.rejectEffect(), eventType, false);
            return;
        }
    } else {
        gameState.cash += cashChange;
        if (cashChange < 0) gameState.variableExpenses += -cashChange;
    }
    if (effect.hasInsurance) gameState.hasInsurance = true;
    const prevKnowledge = gameState.knowledge;
    Object.entries(effect).forEach(([key, value]) => {
        if (key !== 'desc' && key !== 'cash' && key !== 'hasInsurance' && value !== undefined) {
            gameState[key] = ['savings', 'debt', 'assets', 'monthlyIncome'].includes(key) ? (gameState[key] || 0) + value : Math.max(0, Math.min(100, (gameState[key] || 0) + value));
        }
    });
    addHistory('event', effect.desc, cashChange);
    if (effect.desc) await showAlert(event.name, `${loanMessage}${effect.desc}`, eventType === 'good' || eventType === 'rare' ? 'success' : 'warning');
    if (gameState.knowledge !== prevKnowledge) await checkUnlockedEvents();
    updateUI();
    checkGameStatus();
}, 'applyEventEffect');

const calculateTurnsRemaining = (knowledge) => {
    if (knowledge.completed) return 0;
    const turnsPerProgress = knowledge.id === 'financeBasics' ? 2 : 4;
    if (knowledge.progress >= 2) {
        return knowledge.cooldown;
    }
    const remainingProgress = 2 - knowledge.progress;
    const cooldown = knowledge.cooldown > 0 ? knowledge.cooldown : 0;
    return cooldown + remainingProgress * turnsPerProgress;
};

const showSubActions = handleError(async (title, actionList) => {  // เปลี่ยน parameter เป็น actionList เพื่อชัดเจนว่าเป็น array
    if (gameState.vacationCooldown > 0 || gameState.actionsTaken >= CONFIG.maxTurnActions) return await showAlert('ไม่สามารถกระทำได้!', gameState.vacationCooldown > 0 ? `คุณอยู่ในช่วงพักจากการไปเที่ยว เหลือ ${gameState.vacationCooldown} เทิร์น` : 'คุณทำครบ 2 การกระทำในเทิร์นนี้แล้ว!', 'warning');
    const actionDetails = {
        'work-extra': { name: 'งานพิเศษ', desc: 'ทำงานพิเศษเพื่อรับเงินเพิ่ม', effects: [{ label: 'เงินสด', value: '+2,500 บาท', color: 'text-green-400' }, { label: 'ความเหนื่อย', value: '+30', color: 'text-red-400' }, { label: 'ความเครียด', value: '+8', color: 'text-yellow-400' }, { label: 'ความสุข', value: '-15', color: 'text-red-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-blue-900' },
        'work-overtime': { name: 'ทำงานล่วงเวลา', desc: 'ทำงานล่วงเวลาเพื่อรับเงินมากขึ้น', effects: [{ label: 'เงินสด', value: '+4,000 บาท', color: 'text-green-400' }, { label: 'ความเหนื่อย', value: '+18', color: 'text-red-400' }, { label: 'ความเครียด', value: '+35', color: 'text-yellow-400' }, { label: 'ความสุข', value: '-20', color: 'text-red-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-blue-900' },
        'rest-relax': { name: 'ลาเพื่อพักผ่อน', desc: 'พักผ่อนที่บ้าน 1 วันเพื่อลดความเหนื่อยล้า', effects: [{ label: 'เงินสด', value: '-2,250 บาท', color: 'text-red-400' }, { label: 'ความเหนื่อย', value: '-15', color: 'text-green-400' }, { label: 'ความสุข', value: '+10', color: 'text-green-400' }, { label: 'ความเครียด', value: '-8', color: 'text-green-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-green-900' },
        'rest-vacation': { name: 'ไปเที่ยว', desc: 'ไปเที่ยวระยะไกลเพื่อฟื้นฟูสภาพจิตใจ', effects: [{ label: 'เงินสด', value: '-4,000 บาท', color: 'text-red-400' }, { label: 'ความเหนื่อย', value: '-20', color: 'text-green-400' }, { label: 'ความสุข', value: '+15 (+8 ในเทิร์นถัดไป)', color: 'text-green-400' }, { label: 'ความเครียด', value: '-15', color: 'text-green-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-green-900' },
        'study-free': { name: 'เรียนรู้ด้วยตัวเอง', desc: 'การเรียนรู้ฟรี! ศึกษาเรียนรู้จากช่องทางอินเทอร์เน็ต', effects: [{ label: 'เงินสด', value: 'ฟรี!', color: 'text-white' }, { label: 'ความรู้', value: '+5', color: 'text-green-400' }, { label: 'ความเหนื่อย', value: '+10', color: 'text-red-400' }, { label: 'ความสุข', value: '+3', color: 'text-green-400' }, { label: 'ความเครียด', value: '-5', color: 'text-green-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-green-900' },
        'study-saving': { 
            name: 'การออมเงิน', 
            desc: 'เรียนรู้การออมเงินเพื่อปลดล็อคระบบเงินฝาก', 
            effects: [
                { label: 'เงินสด', value: '-1,500 บาท', color: 'text-red-400' }, 
                { label: 'ความรู้', value: '+10', color: 'text-green-400' }, 
                { label: 'ความเครียด', value: '+15', color: 'text-yellow-400' }, 
                { label: 'ความเหนื่อย', value: '+10', color: 'text-red-400' }, 
                { label: 'ความคืบหน้า', value: `+1 (ขณะนี้ ${gameState.savingKnowledge.progress}/2)`, color: 'text-blue-400' }, 
                { label: 'คูลดาวน์', value: '4 เทิร์น', color: 'text-gray-400' }, 
                ...(gameState.savingKnowledge.progress >= 2 && !gameState.savingKnowledge.completed && gameState.savingKnowledge.cooldown > 0 ? [{ label: 'สถานะ', value: `กำลังรอสำเร็จ (เหลือ ${calculateTurnsRemaining(gameState.savingKnowledge)} เทิร์น)`, color: 'text-teal-400' }] : []),
                ...(gameState.savingKnowledge.completed ? [{ label: 'สถานะ', value: 'คุณเรียนรู้การออมเงินครบแล้ว!', color: 'text-teal-400' }] : []),
                ...(!gameState.financeBasics.completed ? [{ label: 'ข้อกำหนด', value: 'ต้องเรียนรู้การเงินพื้นฐานก่อน!', color: 'text-red-400' }] : [])
            ], 
            bgColor: 'bg-purple-900' 
        },
        'study-finance-basics': { 
            name: 'การเงินพื้นฐาน', 
            desc: 'เรียนรู้การเงินพื้นฐานเพื่อปลดล็อคคลังความรู้ ', 
            effects: [
                { label: 'เงินสด', value: '-500 บาท', color: 'text-red-400' }, 
                { label: 'ความรู้', value: '+5', color: 'text-green-400' }, 
                { label: 'ความเครียด', value: '+10', color: 'text-yellow-400' }, 
                { label: 'ความเหนื่อย', value: '+5', color: 'text-red-400' }, 
                { label: 'ความคืบหน้า', value: `+1 (ขณะนี้ ${gameState.financeBasics.progress}/2)`, color: 'text-blue-400' }, 
                { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }, 
                ...(gameState.financeBasics.progress >= 2 && !gameState.financeBasics.completed && gameState.financeBasics.cooldown > 0 ? [{ label: 'สถานะ', value: `กำลังรอสำเร็จ (เหลือ ${calculateTurnsRemaining(gameState.financeBasics)} เทิร์น)`, color: 'text-teal-400' }] : []),
                ...(gameState.financeBasics.completed ? [{ label: 'สถานะ', value: 'คุณเรียนรู้การเงินพื้นฐานครบแล้ว!', color: 'text-teal-400' }] : [])
            ], 
            bgColor: 'bg-purple-900' 
        },
        'study-insurance': { 
            name: 'การประกันภัย', 
            desc: 'เรียนรู้การประกันภัยเพื่อปลดล็อคระบบประกันสุขภาพแบบ Co-pay', 
            effects: [
                { label: 'เงินสด', value: '-2,500 บาท', color: 'text-red-400' }, 
                { label: 'ความรู้', value: '+20', color: 'text-green-400' }, 
                { label: 'ความเครียด', value: '+15', color: 'text-yellow-400' }, 
                { label: 'ความเหนื่อย', value: '+25', color: 'text-red-400' }, 
                { label: 'ความคืบหน้า', value: `+1 (ขณะนี้ ${gameState.insuranceKnowledge.progress}/2)`, color: 'text-blue-400' }, 
                { label: 'คูลดาวน์', value: '4 เทิร์น', color: 'text-gray-400' }, 
                ...(gameState.insuranceKnowledge.progress >= 2 && !gameState.insuranceKnowledge.completed && gameState.insuranceKnowledge.cooldown > 0 ? [{ label: 'สถานะ', value: `กำลังรอสำเร็จ (เหลือ ${calculateTurnsRemaining(gameState.insuranceKnowledge)} เทิร์น)`, color: 'text-teal-400' }] : []),
                ...(gameState.insuranceKnowledge.completed ? [{ label: 'สถานะ', value: 'คุณเรียนรู้การประกันภัยครบแล้ว!', color: 'text-teal-400' }] : []),
                ...(!gameState.financeBasics.completed ? [{ label: 'ข้อกำหนด', value: 'ต้องเรียนรู้การเงินพื้นฐานก่อน!', color: 'text-red-400' }] : [])
            ], 
            bgColor: 'bg-purple-900' 
        },
        'study-loan': { 
            name: 'การกู้เงิน', 
            desc: 'เรียนรู้การกู้เงินเพื่อปลดล็อคระบบกู้เงิน', 
            effects: [
                { label: 'เงินสด', value: '-2,000 บาท', color: 'text-red-400' }, 
                { label: 'ความรู้', value: '+8', color: 'text-green-400' }, 
                { label: 'ความเครียด', value: '+20', color: 'text-yellow-400' }, 
                { label: 'ความเหนื่อย', value: '+8', color: 'text-red-400' }, 
                { label: 'ความคืบหน้า', value: `+1 (ขณะนี้ ${gameState.loanKnowledge.progress}/2)`, color: 'text-blue-400' }, 
                { label: 'คูลดาวน์', value: '4 เทิร์น', color: 'text-gray-400' }, 
                ...(gameState.loanKnowledge.progress >= 2 && !gameState.loanKnowledge.completed && gameState.loanKnowledge.cooldown > 0 ? [{ label: 'สถานะ', value: `กำลังรอสำเร็จ (เหลือ ${calculateTurnsRemaining(gameState.loanKnowledge)} เทิร์น)`, color: 'text-teal-400' }] : []),
                ...(gameState.loanKnowledge.completed ? [{ label: 'สถานะ', value: 'คุณเรียนรู้การกู้เงินครบแล้ว!', color: 'text-teal-400' }] : []),
                ...(!gameState.financeBasics.completed ? [{ label: 'ข้อกำหนด', value: 'ต้องเรียนรู้การเงินพื้นฐานก่อน!', color: 'text-red-400' }] : [])
            ], 
            bgColor: 'bg-purple-900' 
        },
        'borrow-loan': {
            name: 'กู้เงิน',
            desc: 'กู้เงินเพื่อเพิ่มเงินสด',
            effects: [
                { label: 'เงินสด', value: '+10,000 บาท', color: 'text-green-400' },
                { label: 'หนี้', value: '+10,000 บาท', color: 'text-red-400' },
                { label: 'คูลดาวน์', value: '4 เทิร์น', color: 'text-gray-400' },
                ...(!gameState.loanKnowledge.completed ? [{ label: 'ข้อกำหนด', value: 'ต้องเรียนรู้การกู้เงินก่อน!', color: 'text-red-400' }] : [])
            ],
            bgColor: 'bg-red-900'
        },
        'buy-essential': { name: 'ซื้อของจำเป็น', desc: 'ซื้อของจำเป็นในชีวิตประจำวัน', effects: [{ label: 'เงินสด', value: '-2,000 บาท', color: 'text-red-400' }, { label: 'ความสุข', value: '+8', color: 'text-green-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-yellow-900' },
        'buy-luxury': { name: 'ซื้อของฟุ่มเฟือย', desc: 'ซื้อของฟุ่มเฟือยเพื่อเพิ่มความสุข', effects: [{ label: 'เงินสด', value: '-10,000 บาท', color: 'text-red-400' }, { label: 'ความสุข', value: '+25', color: 'text-green-400' }, { label: 'ความเครียด', value: '-10', color: 'text-green-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-yellow-900' },
        'pay-debt': { name: 'ชำระหนี้', desc: 'ชำระหนี้ 2,000 บาท', effects: [{ label: 'เงินสด', value: '-2,000 บาท', color: 'text-red-400' }, { label: 'หนี้', value: '-2,000 บาท', color: 'text-green-400' }, { label: 'คูลดาวน์', value: '3 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-indigo-900' },
        'deposit': { name: 'ฝากเงิน', desc: 'ฝากเงิน 1,000 บาท', effects: [{ label: 'เงินสด', value: '-1,000 บาท', color: 'text-red-400' }, { label: 'เงินฝาก', value: '+1,000 บาท', color: 'text-green-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-indigo-900' },
        'withdraw': { name: 'ถอนเงิน', desc: 'ถอนเงิน 1,000 บาท', effects: [{ label: 'เงินสด', value: '+1,000 บาท', color: 'text-green-400' }, { label: 'เงินฝาก', value: '-1,000 บาท', color: 'text-red-400' }, { label: 'คูลดาวน์', value: '2 เทิร์น', color: 'text-gray-400' }], bgColor: 'bg-indigo-900' },
        'buy-insurance': {
            name: 'ซื้อประกันสุขภาพ',
            desc: 'เบี้ยประกันสุขภาพ (-2,000 บาท/เดือน, ระยะเวลา 4 เดือน)',
            effects: [
                { label: 'เงินสด', value: '-2,000 บาท', color: 'text-red-400' },
                { label: 'ความเครียด', value: '-10', color: 'text-green-400' },
                { label: 'ความสุข', value: '+5', color: 'text-green-400' },
                { label: 'ความเหนื่อย', value: '+5', color: 'text-red-400' }, 
                { label: 'ระยะเวลา', value: '4 เดือน (16 เทิร์น)', color: 'text-gray-400' },
                ...(gameState.hasInsurance && gameState.insuranceDuration > 0
                    ? [{ label: 'สถานะ', value: `ประกันยังเหลือ ${gameState.insuranceDuration} เทิร์น`, color: 'text-teal-400' }]
                    : gameState.hasInsurance && gameState.insuranceDuration === 0
                        ? [{ label: 'สถานะ', value: 'ประกันหมดอายุ สามารถซื้อใหม่ได้', color: 'text-yellow-400' }]
                        : []),
                ...(!gameState.insuranceKnowledge.completed
                    ? [{ label: 'ข้อกำหนด', value: 'ต้องเรียนรู้การประกันภัยก่อน!', color: 'text-red-400' }]
                    : [])
            ],
            bgColor: 'bg-indigo-900'
        }
    };

    await closeSwal();
    const filteredActions = actionList.filter(a => {
        if (a.id === 'study-saving' || a.id === 'study-insurance' || a.id === 'study-loan') return gameState.financeBasics.completed;
        if (a.id === 'deposit') return gameState.savingKnowledge.completed;
        if (a.id === 'withdraw') return gameState.savingKnowledge.completed && gameState.savings >= 1000;
        if (a.id === 'buy-insurance') return gameState.insuranceKnowledge.completed;
        if (a.id === 'borrow-loan') return gameState.loanKnowledge.completed;
        if (a.id === 'pay-debt') return gameState.debt >= 5000;
        return true;
    });
    const isTwoColumns = filteredActions.length > 2;
    const cards = filteredActions.map(action => {
        const details = actionDetails[action.id];
        const isDisabled = (action.id === 'study-saving' && (gameState.savingKnowledge.cooldown > 0 || gameState.savingKnowledge.completed || !gameState.financeBasics.completed)) ||
            (action.id === 'study-finance-basics' && (gameState.financeBasics.cooldown > 0 || gameState.financeBasics.completed)) ||
            (action.id === 'study-insurance' && (gameState.insuranceKnowledge.cooldown > 0 || gameState.insuranceKnowledge.completed || !gameState.financeBasics.completed)) ||
            (action.id === 'study-loan' && (gameState.loanKnowledge.cooldown > 0 || gameState.loanKnowledge.completed || !gameState.financeBasics.completed)) ||
            (action.id === 'buy-insurance' && (gameState.hasInsurance || !gameState.insuranceKnowledge.completed)) ||
            (action.id === 'borrow-loan' && !gameState.loanKnowledge.completed) ||
            (action.id === 'pay-debt' && gameState.debt < 2000) ||
            (action.id === 'deposit' && gameState.cash < 1000) ||
            (action.id === 'withdraw' && gameState.savings < 1000);
        return `<div class="subaction-card mb-1 mt-2 px-6 pt-6 pb-10 rounded-md glassmorphism border border-gray-800 bg-[#1f2937] shadow-md backdrop-blur-sm ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-2xl hover:bg-opacity-60 hover:border-white hover:bg-[#1a2330] active:bg-opacity-20 active:scale-99 active:shadow-inner'}" data-action="${action.id}" style="${isDisabled ? 'pointer-events: none' : ''}">
            <h3 class="text-base font-medium text-gray-100 mb-1">${details.name}</h3>
            <p class="text-sm text-gray-400 mb-2">${details.desc}</p>
            <ul class="text-sm space-y-1">${details.effects.map(e => `<li class="flex justify-between"><span class="text-gray-300">${e.label}</span><span class="${e.color}">${e.value}</span></li>`).join('')}</ul>
        </div>`;
    }).join('');
    await Swal.fire({ title, html: `<div class="subaction-container ${isTwoColumns ? 'subaction-container-two-cols grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4'} max-h-[70vh] overflow-y-auto px-2">${cards}</div>`, showConfirmButton: false, showCancelButton: true, ...swalConfig, customClass: { ...swalConfig.customClass, popup: `bg-gray-900 bg-opacity-80 text-white rounded-lg ${isTwoColumns ? 'max-w-3xl' : 'max-w-md'} w-full border border-gray-700 shadow-md backdrop-blur-md` }, didOpen: () => document.querySelectorAll('.subaction-card:not(.cursor-not-allowed)').forEach(card => card.addEventListener('click', async () => { await Swal.close(); await new Promise(r => setTimeout(r, 300)); await handleSubAction(card.getAttribute('data-action')); })) });
}, 'showSubActions');

const handleSubAction = handleError(async actionId => {
    if (gameState.actionsTaken >= CONFIG.maxTurnActions || gameState.vacationCooldown > 0) 
        return await showAlert('ไม่สามารถกระทำได้!', gameState.actionsTaken >= CONFIG.maxTurnActions ? 
            'คุณทำครบ 2 การกระทำในเทิร์นนี้แล้ว!' : 
            `คุณอยู่ในช่วงพักจากการไปเที่ยว เหลือ ${gameState.vacationCooldown} เทิร์น`, 'warning');
    if (gameState.actionCooldowns.has(actionId)) 
        return await showAlert('ข้อผิดพลาด', 'การกระทำนี้อยู่ในช่วงคูลดาวน์!', 'error');
    const actions = {
        'work-extra': { effect: { cash: 2500, fatigue: 30, stress: 8, happiness: -15 }, desc: `งานพิเศษ (+${(2500).toLocaleString()} บาท)` },
        'work-overtime': { effect: { cash: 4000, fatigue: 18, stress: 35, happiness: -20 }, desc: `ทำงานล่วงเวลา (+${(4000).toLocaleString()} บาท)` },
        'rest-relax': { effect: { fatigue: -15, happiness: 10, stress: -8, cash: -2250 }, desc: `พักผ่อนที่บ้าน (-${(2250).toLocaleString()} บาท)` },
        'rest-vacation': { effect: { fatigue: -20, happiness: 15, stress: -15, cash: -4000 }, desc: `ไปเที่ยว (-${(4000).toLocaleString()} บาท)` },
        'study-free': { effect: { knowledge: 5, fatigue: 10, happiness: 3, stress: -5 }, desc: `เรียนรู้ด้วยตัวเอง` },
        'study-saving': { effect: null, desc: '' },
        'study-finance-basics': { effect: null, desc: '' },
        'study-insurance': { effect: null, desc: '' },
        'study-loan': { effect: null, desc: '' },
        'borrow-loan': { effect: { cash: 10000, debt: 10000 }, desc: `กู้เงิน +${(10000).toLocaleString()} บาท` },
        'buy-essential': { effect: { cash: -2000, happiness: 8 }, desc: `ซื้อของจำเป็น (-${(2000).toLocaleString()} บาท)` },
        'buy-luxury': { effect: { cash: -10000, happiness: 25, stress: -10 }, desc: `ซื้อของฟุ่มเฟือย (-${(10000).toLocaleString()} บาท)` },
        'pay-debt': { effect: gameState.debt >= 2000 && gameState.cash >= 2000 ? { cash: -2000, debt: -2000 } : null, desc: `ชำระหนี้ (-${(2000).toLocaleString()} บาท)` },
        'deposit': { effect: gameState.savingKnowledge.completed && gameState.cash >= 1000 ? { cash: -1000, savings: 1000 } : null, desc: `ฝากเงิน (-${(1000).toLocaleString()} บาท)` },
        'withdraw': { effect: gameState.savingKnowledge.completed && gameState.savings >= 1000 ? { cash: 1000, savings: -1000 } : null, desc: `ถอนเงิน (+${(1000).toLocaleString()} บาท)` },
        'buy-insurance': { effect: !gameState.hasInsurance && gameState.cash >= 2000 ? { cash: -2000, stress: -10, happiness: 5, fatigue: 5 } : null, desc: `ซื้อประกันสุขภาพ (-${(2000).toLocaleString()} บาท/เดือน)` }
    };
    if (actionId === 'study-saving') {
        if (!gameState.financeBasics.completed) return await showAlert('ข้อผิดพลาด', 'ต้องเรียนรู้การเงินพื้นฐานก่อน!', 'error');
        if (gameState.savingKnowledge.progress >= 2) return await showAlert('ข้อผิดพลาด', 'คุณเรียนรู้การออมเงินครบแล้ว (กำลังรอสำเร็จ)!', 'error');
        if (gameState.savingKnowledge.cooldown > 0) return await showAlert('ข้อผิดพลาด', `การเรียนรู้อยู่ในคูลดาวน์! เหลือ ${gameState.savingKnowledge.cooldown} เทิร์น`, 'error');
        if (gameState.cash < 1500) return await showAlert('ข้อผิดพลาด', `เงินสดไม่พอสำหรับเรียนรู้การออมเงิน (ต้องการ 1,500 บาท, มี ${gameState.cash.toLocaleString()} บาท)`, 'error');
        actions['study-saving'].effect = { stress: 15, fatigue: 10, cash: -1500 };
        actions['study-saving'].desc = `เรียนรู้การออมเงินครั้งที่ ${gameState.savingKnowledge.progress + 1} (-${(1500).toLocaleString()} บาท, ความคืบหน้า ${gameState.savingKnowledge.progress + 1}/2)`;
    } else if (actionId === 'study-finance-basics') {
        if (gameState.financeBasics.progress >= 2) return await showAlert('ข้อผิดพลาด', 'คุณเรียนรู้การเงินพื้นฐานครบแล้ว (กำลังรอสำเร็จ)!', 'error');
        if (gameState.financeBasics.cooldown > 0) return await showAlert('ข้อผิดพลาด', `การเรียนรู้อยู่ในคูลดาวน์! เหลือ ${gameState.financeBasics.cooldown} เทิร์น`, 'error');
        if (gameState.cash < 500) return await showAlert('ข้อผิดพลาด', `เงินสดไม่พอสำหรับเรียนรู้การเงินพื้นฐาน (ต้องการ 500 บาท, มี ${gameState.cash.toLocaleString()} บาท)`, 'error');
        actions['study-finance-basics'].effect = { stress: 10, fatigue: 5, cash: -500 };
        actions['study-finance-basics'].desc = `เรียนรู้การเงินพื้นฐานครั้งที่ ${gameState.financeBasics.progress + 1} (-${(500).toLocaleString()} บาท, ความคืบหน้า ${gameState.financeBasics.progress + 1}/2)`;
    } else if (actionId === 'study-insurance') {
        if (!gameState.financeBasics.completed) return await showAlert('ข้อผิดพลาด', 'ต้องเรียนรู้การเงินพื้นฐานก่อน!', 'error');
        if (gameState.insuranceKnowledge.progress >= 2) return await showAlert('ข้อผิดพลาด', 'คุณเรียนรู้การประกันภัยครบแล้ว (กำลังรอสำเร็จ)!', 'error');
        if (gameState.insuranceKnowledge.cooldown > 0) return await showAlert('ข้อผิดพลาด', `การเรียนรู้อยู่ในคูลดาวน์! เหลือ ${gameState.insuranceKnowledge.cooldown} เทิร์น`, 'error');
        if (gameState.cash < 2500) return await showAlert('ข้อผิดพลาด', `เงินสดไม่พอสำหรับเรียนรู้การประกันภัย (ต้องการ 2,500 บาท, มี ${gameState.cash.toLocaleString()} บาท)`, 'error');
        actions['study-insurance'].effect = { stress: 25, fatigue: 15, cash: -2500 };
        actions['study-insurance'].desc = `เรียนรู้การประกันภัยครั้งที่ ${gameState.insuranceKnowledge.progress + 1} (-${(2500).toLocaleString()} บาท, ความคืบหน้า ${gameState.insuranceKnowledge.progress + 1}/2)`;
    } else if (actionId === 'study-loan') {
        if (!gameState.financeBasics.completed) return await showAlert('ข้อผิดพลาด', 'ต้องเรียนรู้การเงินพื้นฐานก่อน!', 'error');
        if (gameState.loanKnowledge.progress >= 2) return await showAlert('ข้อผิดพลาด', 'คุณเรียนรู้การกู้เงินครบแล้ว (กำลังรอสำเร็จ)!', 'error');
        if (gameState.loanKnowledge.cooldown > 0) return await showAlert('ข้อผิดพลาด', `การเรียนรู้อยู่ในคูลดาวน์! เหลือ ${gameState.loanKnowledge.cooldown} เทิร์น`, 'error');
        if (gameState.cash < 2000) return await showAlert('ข้อผิดพลาด', `เงินสดไม่พอสำหรับเรียนรู้การกู้เงิน (ต้องการ 2,000 บาท, มี ${gameState.cash.toLocaleString()} บาท)`, 'error');
        actions['study-loan'].effect = { stress: 20, fatigue: 8, cash: -2000 };
        actions['study-loan'].desc = `เรียนรู้การกู้เงินครั้งที่ ${gameState.loanKnowledge.progress + 1} (-${(2000).toLocaleString()} บาท, ความคืบหน้า ${gameState.loanKnowledge.progress + 1}/2)`;
    } else if (actionId === 'borrow-loan') {
        if (!gameState.loanKnowledge.completed) return await showAlert('ข้อผิดพลาด', 'ต้องเรียนรู้การกู้เงินก่อน!', 'error');
        if (gameState.debt + 10000 > CONFIG.maxDebt) return await showAlert('ข้อผิดพลาด', 'หนี้จะเกินขีดจำกัด 50,000 บาท!', 'error');
    } else if (actionId === 'buy-insurance') {
        if (gameState.hasInsurance && gameState.insuranceDuration > 0)
            return await showAlert('ข้อผิดพลาด', `คุณมีประกันสุขภาพอยู่แล้ว! เหลือ ${gameState.insuranceDuration} เทิร์น`, 'error');
        if (!gameState.insuranceKnowledge.completed)
            return await showAlert('ข้อผิดพลาด', 'ต้องเรียนรู้การประกันภัยก่อน!', 'error');
        gameState.hasInsurance = true;
        gameState.insurancePremium = 2000;
        gameState.insuranceDuration = 16;
        addHistory('financial', `ซื้อประกันสุขภาพ: -${2000} บาท, ระยะเวลา 4 เดือน`);
    }
    const { effect, desc } = actions[actionId];
    if (!effect) return await showAlert('ข้อผิดพลาด', desc || 'เงื่อนไขไม่ครบถ้วน!', 'error');
    if (effect.cash < 0 && gameState.cash + effect.cash < 0) {
        const shortfall = -(gameState.cash + effect.cash);
        let alertText = `เงินสดไม่พอสำหรับ ${desc} (ขาด ${shortfall.toLocaleString()} บาท)`;
        let showConfirm = gameState.savingKnowledge.completed && gameState.savings > 0;
        await closeSwal();
        const result = await Swal.fire({ 
            title: 'เงินไม่พอ!', 
            text: showConfirm ? `${alertText}\nต้องการถอนเงิน ${shortfall.toLocaleString()} บาทจากเงินฝาก (${gameState.savings.toLocaleString()} บาท) หรือไม่?` : alertText, 
            showConfirmButton: showConfirm, 
            confirmButtonText: 'ถอนเงิน', 
            showCancelButton: true, 
            ...swalConfig 
        });
        if (result.isConfirmed && showConfirm) {
            if (await tryWithdrawFromSavings(shortfall, desc)) {
                if (actionId === 'study-saving') {
                    gameState.savingKnowledge.progress += 1;
                    gameState.savingKnowledge.cooldown = 4;
                } else if (actionId === 'study-finance-basics') {
                    gameState.financeBasics.progress += 1;
                    gameState.financeBasics.cooldown = 2;
                } else if (actionId === 'study-insurance') {
                    gameState.insuranceKnowledge.progress += 1;ห
                    gameState.insuranceKnowledge.cooldown = 4;
                } else if (actionId === 'study-loan') {
                    gameState.loanKnowledge.progress += 1;
                    gameState.loanKnowledge.cooldown = 4;
                }
                await applyActionEffect(effect, desc, actionId);
            }
        } else if (gameState.loanKnowledge.completed && gameState.debt + shortfall <= CONFIG.maxDebt) {
            await closeSwal();
            const loanResult = await Swal.fire({ 
                title: 'เงินฝากไม่เพียงพอ!', 
                text: `ต้องการกู้หนี้ ${shortfall.toLocaleString()} บาทเพื่อ ${desc} หรือไม่?`, 
                showConfirmButton: true, 
                showDenyButton: true, 
                confirmButtonText: 'กู้หนี้', 
                denyButtonText: 'ยกเลิก', 
                ...swalConfig 
            });
            if (loanResult.isConfirmed) {
                gameState.debt += shortfall;
                gameState.cash += shortfall;
                addHistory('financial', `กู้หนี้ (+${shortfall.toLocaleString()} บาท) เพื่อ${desc}`, shortfall);
                if (actionId === 'study-saving') {
                    gameState.savingKnowledge.progress += 1;
                    gameState.savingKnowledge.cooldown = 4;
                } else if (actionId === 'study-finance-basics') {
                    gameState.financeBasics.progress += 1;
                    gameState.financeBasics.cooldown = 2;
                } else if (actionId === 'study-insurance') {
                    gameState.insuranceKnowledge.progress += 1;
                    gameState.insuranceKnowledge.cooldown = 4;
                } else if (actionId === 'study-loan') {
                    gameState.loanKnowledge.progress += 1;
                    gameState.loanKnowledge.cooldown = 4;
                }
                await applyActionEffect(effect, desc, actionId, true);
                if (gameState.debt >= CONFIG.maxDebt) return checkGameStatus();
            } else {
                addHistory('financial', `ยกเลิก ${desc} เนื่องจากเงินไม่พอ`);
            }
        } else {
            addHistory('financial', `ยกเลิก ${desc} เนื่องจาก${gameState.loanKnowledge.completed ? 'หนี้ถึงขีดจำกัด' : 'ต้องเรียนรู้การกู้เงินก่อน!'}`);
            if (!gameState.loanKnowledge.completed) {
                await showAlert('ข้อผิดพลาด', 'ต้องเรียนรู้การกู้เงินก่อนจึงจะกู้เงินได้!', 'error');
            }
        }
        return;
    }
    if (actionId === 'study-saving') {
        gameState.savingKnowledge.progress += 1;
        gameState.savingKnowledge.cooldown = 4;
    } else if (actionId === 'study-finance-basics') {
        gameState.financeBasics.progress += 1;
        gameState.financeBasics.cooldown = 2;
    } else if (actionId === 'study-insurance') {
        gameState.insuranceKnowledge.progress += 1;
        gameState.insuranceKnowledge.cooldown = 4;
    } else if (actionId === 'study-loan') {
        gameState.loanKnowledge.progress += 1;
        gameState.loanKnowledge.cooldown = 4;
    }
    if (actionId === 'rest-vacation') {
        gameState.vacationCooldown = 2;
        gameState.happinessNextTurn = 8;
        await showAlert('ไปเที่ยว!', 'คุณเลือกไปเที่ยว จะไม่สามารถกระทำใด ๆ ได้ใน 2 เทิร์นถัดไป', 'info');
    }

    if (actionId === 'work-extra' || actionId === 'work-overtime') {
        gameState.workActionCount += 1; // Increment work action count for goal tracking
    }
    await applyActionEffect(effect, desc, actionId);
}, 'handleSubAction');

const applyActionEffect = handleError(async (effect, desc, actionId, borrowed = false) => {
    gameState.cash += (effect.cash || 0);
    if (effect.cash < 0) gameState.variableExpenses += -effect.cash;
    const prevKnowledge = gameState.knowledge;
    Object.entries(effect).forEach(([key, value]) => {
        if (key !== 'desc' && key !== 'cash' && value !== undefined) {
            gameState[key] = ['savings', 'debt', 'assets'].includes(key) ? 
                (gameState[key] || 0) + value : 
                Math.max(0, Math.min(100, (gameState[key] || 0) + value));
        }
    });
    addHistory('action', desc, effect.cash || 0);
    gameState.actionsTaken++;
    if (!['study-saving', 'study-finance-basics', 'study-insurance', 'study-loan', 'buy-insurance'].includes(actionId)) 
        gameState.actionCooldowns.set(actionId, 2);
    if (gameState.knowledge !== prevKnowledge) await checkUnlockedEvents();
    updateUI();
    checkGameStatus();
}, 'applyActionEffect');

const assignGoal = handleError(() => {
    if (!gameState.goal && Math.random() < 0.90) {
        const availableGoals = goals.filter(g => g.condition());
        if (availableGoals.length) {
            gameState.goal = { 
                ...availableGoals[Math.floor(Math.random() * availableGoals.length)], 
                turnsRemaining: availableGoals[0].turns, 
                initialDebt: gameState.debt,
                initialKnowledge: gameState.knowledge, // เพิ่ม initialKnowledge เพื่อเก็บความรู้เริ่มต้น
                workActionCount: 0
            };
            gameState.workActionCount = 0;
            showAlert('เป้าหมายใหม่!', gameState.goal.desc, 'info');
        }
    }
}, 'assignGoal');

const checkGoalProgress = handleError(() => {
    if (!gameState.goal) return;
    gameState.goal.turnsRemaining--;
    const achieved = {
        'pay-debt-2000': gameState.goal.initialDebt - gameState.debt >= 2000,
        'save-5000': gameState.savings >= 5000,
        'knowledge-plus-20': gameState.knowledge >= gameState.goal.initialKnowledge + 20,
        'work-3-times': gameState.workActionCount >= 3,
    }[gameState.goal.id];
    if (achieved && gameState.goal.turnsRemaining >= 0) {
        const { cash, happiness, knowledge } = gameState.goal.reward;
        gameState.cash += cash || 0;
        if (happiness) gameState.happiness = Math.max(0, Math.min(100, gameState.happiness + happiness));
        if (knowledge) gameState.knowledge = Math.max(0, Math.min(100, gameState.knowledge + knowledge));
        addHistory('event', `รางวัลเป้าหมาย: ${gameState.goal.desc} (+${(cash || 0).toLocaleString()} บาท${happiness ? `, ความสุข +${happiness}` : ''}${knowledge ? `, ความรู้ +${knowledge}` : ''})`, cash || 0);
        showAlert('สำเร็จ!', `คุณทำเป้าหมาย "${gameState.goal.desc}" สำเร็จ! ได้รับเงิน ${(cash || 0).toLocaleString()} บาท${happiness ? ` และความสุข +${happiness}` : ''}${knowledge ? ` และความรู้ +${knowledge}` : ''}`, 'success');
        if (gameState.goal.id === 'work-3-times') {
            gameState.goalCooldowns.set('work-3-times', 10);
        }
        gameState.goal = null;
        gameState.workActionCount = 0;
    } else if (gameState.goal.turnsRemaining <= 0) {
        showAlert('ล้มเหลว!', `คุณไม่สามารถทำเป้าหมาย "${gameState.goal.desc}" ได้ทันเวลา`, 'error');
        if (gameState.goal.id === 'work-3-times') {
            gameState.goalCooldowns.set('work-3-times', 10);
        }
        gameState.goal = null;
        gameState.workActionCount = 0;
    }
}, 'checkGoalProgress');

const showLoadingScreen = handleError(() => {
    if (DOMCache['loading-screen']) { DOMCache['loading-screen'].classList.remove('hidden'); setTimeout(() => DOMCache['loading-screen'].classList.add('hidden'), 1500); }
    else addHistory('error', `ไม่พบ element ID "loading-screen" ใน UI`);
}, 'showLoadingScreen');

document.addEventListener('DOMContentLoaded', handleError(() => {
    if (!window.Swal) throw new Error('SweetAlert2 not loaded');
    const financeBtn = document.getElementById('finance-btn');
    if (financeBtn) financeBtn.classList.add('hidden');
    else addHistory('error', 'ไม่พบปุ่ม ID "finance-btn" ใน UI');

    const knowledgeBtn = document.getElementById('knowledge-btn');
    if (knowledgeBtn) knowledgeBtn.classList.add('hidden');
    else addHistory('error', 'ไม่พบปุ่ม ID "knowledge-btn" ใน UI');

    updateUI();
    const buttons = [
        { id: 'work-btn', actions: [{ id: 'work-extra' }, { id: 'work-overtime' }], title: 'ทำงาน' },
        { id: 'rest-btn', actions: [{ id: 'rest-relax' }, { id: 'rest-vacation' }], title: 'พักผ่อน' },
        { id: 'study-btn', actions: () => [
            { id: 'study-free' },
            { id: 'study-finance-basics' }, 
            ...(gameState.financeBasics.completed ? [{ id: 'study-saving' }, { id: 'study-insurance' }, { id: 'study-loan' }] : [])
        ], title: 'เรียนรู้' },
        { id: 'buy-btn', actions: [{ id: 'buy-essential' }, { id: 'buy-luxury' }], title: 'ซื้อของ' },
        { id: 'finance-btn', actions: () => [
            { id: 'pay-debt' }, 
            { id: 'deposit' }, 
            { id: 'withdraw' }, 
            { id: 'borrow-loan' }, 
            ...(gameState.insuranceKnowledge.completed ? [{ id: 'buy-insurance' }] : [])
        ], title: 'การเงิน' },
        { id: 'knowledge-btn', action: showKnowledgeLog }
    ];
    buttons.forEach(({ id, actions, title, action }) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', action || (() => showSubActions(title, typeof actions === 'function' ? actions() : actions)));
        else addHistory('error', `ไม่พบปุ่ม ID "${id}" ใน UI`);
    });

    let fatigue60TurnCounter = 0;
    let stress70TurnCounter = 0;
    const nextTurnBtn = document.getElementById('next-turn-btn');
    if (nextTurnBtn) {
        nextTurnBtn.addEventListener('click', async () => {
            showLoadingScreen();
            gameState.turn++;
            gameState.month = Math.floor((gameState.turn - 1) / CONFIG.weeksPerMonth) + 1;
            gameState.actionsTaken = 0;
            gameState.turnsUntilNextSalary--;
            gameState.vacationCooldown = Math.max(0, gameState.vacationCooldown - 1);
            gameState.savingKnowledge.cooldown = Math.max(0, gameState.savingKnowledge.cooldown - 1);
            gameState.financeBasics.cooldown = Math.max(0, gameState.financeBasics.cooldown - 1);
            gameState.insuranceKnowledge.cooldown = Math.max(0, gameState.insuranceKnowledge.cooldown - 1);
            gameState.loanKnowledge.cooldown = Math.max(0, gameState.loanKnowledge.cooldown - 1);
            if (gameState.goalCooldowns) {
                gameState.goalCooldowns.forEach((value, key) => {
                    gameState.goalCooldowns.set(key, value - 1);
                    if (gameState.goalCooldowns.get(key) <= 0) gameState.goalCooldowns.delete(key);
                });
            }
            fatigue60TurnCounter++;
            if (gameState.fatigue >= 70 && gameState.fatigue < 79) {
                if (fatigue60TurnCounter >= 2) {
                    gameState.happiness = Math.max(0, Math.min(100, gameState.happiness - 5));
                    addHistory('event', 'คุณเหนื่อยเกิน 70% : ความสุข -5', 0);
                    fatigue60TurnCounter = 0;
                }
            } else {
                fatigue60TurnCounter = 0;
            }
            if (gameState.fatigue >= 80) {
                gameState.stress = Math.max(0, Math.min(100, gameState.stress + 3));
                gameState.happiness = Math.max(0, Math.min(100, gameState.happiness - 5));
                addHistory('event', 'คุณเหนื่อยเกิน 80% : ความเครียด +3, ความสุข -5', 0);
            }
            stress70TurnCounter++;
            if (gameState.stress >= 70 && gameState.stress < 79) {
                if (stress70TurnCounter >= 2) {
                    gameState.happiness = Math.max(0, Math.min(100, gameState.happiness - 5));
                    addHistory('event', 'คุณเครียดเกินไป 70% : ความสุข -5', 0);
                    stress70TurnCounter = 0;
                }
            } else {
                stress70TurnCounter = 0;
            }
            if (gameState.stress >= 80) {
                gameState.happiness = Math.max(0, Math.min(100, gameState.happiness - 5));
                gameState.fatigue = Math.max(0, Math.min(100, gameState.fatigue + 3));
                addHistory('event', 'คุณเครียดเกิน 80% : ความสุข -5, ความเหนื่อย +3', 0);
            }
            if (gameState.hasInsurance && gameState.insuranceDuration > 0) {
                gameState.insuranceDuration--;
                if (gameState.insuranceDuration === 0) {
                    gameState.hasInsurance = false;
                    gameState.insurancePremium = 0;
                    await closeSwal();
                    await showAlert('แจ้งเตือน', 'ประกันสุขภาพของคุณหมดอายุแล้ว! คุณสามารถซื้อประกันใหม่ได้ในเมนูการเงิน', 'info', { allowOutsideClick: true, allowEscapeKey: true });
                    addHistory('financial', 'ประกันสุขภาพหมดอายุ สามารถซื้อใหม่ได้');
                }
            }
            gameState.happiness += gameState.happinessNextTurn;
            gameState.happinessNextTurn = 0;
            gameState.actionCooldowns.forEach((value, key) => {
                gameState.actionCooldowns.set(key, value - 1);
                if (gameState.actionCooldowns.get(key) <= 0) gameState.actionCooldowns.delete(key);
            });
            if (gameState.savingKnowledge.progress >= 2 && !gameState.savingKnowledge.completed && gameState.savingKnowledge.cooldown <= 0) {
                gameState.savingKnowledge.completed = true;
                gameState.knowledge = Math.max(0, Math.min(100, gameState.knowledge + 10));
                await closeSwal();
                await showAlert('ยินดีด้วย!', 'คุณเรียนรู้การออมเงินสำเร็จ! ได้รับความรู้ +10 ปลดล็อคระบบเงินฝากและเมนูการเงิน', 'success');
                addHistory('action', 'เรียนรู้การออมเงินสำเร็จ');
                document.getElementById('finance-btn').classList.remove('hidden'); // ปลดล็อค finance-btn
            }
            if (gameState.financeBasics.progress >= 2 && !gameState.financeBasics.completed && gameState.financeBasics.cooldown <= 0) {
                gameState.financeBasics.completed = true;
                gameState.knowledge = Math.max(0, Math.min(100, gameState.knowledge + 5));
                await closeSwal();
                await showAlert('ยินดีด้วย!', 'คุณเรียนรู้การเงินพื้นฐานสำเร็จ! ได้รับความรู้ +5 ปลดล็อคคลังความรู้', 'success');
                addHistory('action', 'เรียนรู้การเงินพื้นฐานสำเร็จ');
                document.getElementById('knowledge-btn').classList.remove('hidden'); // ปลดล็อคเฉพาะ knowledge-btn
            }
            if (gameState.insuranceKnowledge.progress >= 2 && !gameState.insuranceKnowledge.completed && gameState.insuranceKnowledge.cooldown <= 0) {
                gameState.insuranceKnowledge.completed = true;
                gameState.knowledge = Math.max(0, Math.min(100, gameState.knowledge + 20));
                await closeSwal();
                await showAlert('ยินดีด้วย!', 'คุณเรียนรู้การประกันภัยสำเร็จ! ได้รับความรู้ +20 ปลดล็อคระบบประกันสุขภาพและเมนูการเงิน', 'success');
                addHistory('action', 'เรียนรู้การประกันภัยสำเร็จ');
                document.getElementById('finance-btn').classList.remove('hidden'); // ปลดล็อค finance-btn
            }
            if (gameState.loanKnowledge.progress >= 2 && !gameState.loanKnowledge.completed && gameState.loanKnowledge.cooldown <= 0) {
                gameState.loanKnowledge.completed = true;
                gameState.knowledge = Math.max(0, Math.min(100, gameState.knowledge + 8));
                await closeSwal();
                await showAlert('ยินดีด้วย!', 'คุณเรียนรู้การกู้เงินสำเร็จ! ได้รับความรู้ +8 ปลดล็อคระบบกู้เงินและเมนูการเงิน', 'success');
                addHistory('action', 'เรียนรู้การกู้เงินสำเร็จ');
                document.getElementById('finance-btn').classList.remove('hidden'); // ปลดล็อค finance-btn
            }
            await applyFinancials();
            if (!(await checkGameStatus())) return;
            await applyEvent();
            if (!(await checkGameStatus())) return;
            assignGoal();
            checkGoalProgress();
            updateUI();
        });
    } else addHistory('error', 'ไม่พบปุ่ม ID "next-turn-btn" ใน UI');
}, 'DOMContentLoaded'));
