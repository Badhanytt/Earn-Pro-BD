// ==========================================
// ১. TELEGRAM WEBAPP INITIALIZATION
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready(); 
tg.expand(); 

const tgUser = tg.initDataUnsafe?.user;
const userId = tgUser ? tgUser.id.toString() : "DEMO_USER_123";
const firstName = tgUser ? tgUser.first_name : "Guest User";

const ADMIN_TELEGRAM_ID = "5977808817"; 

let currentUser = null;
let fakeTxInterval = null;
let currentAuthMode = 'login';

// ==========================================
// ২. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDqG0TFBK-0ZM5IjTwU4VC39esnCDsShI0",
    authDomain: "trounament-d8110.firebaseapp.com",
    databaseURL: "https://trounament-d8110-default-rtdb.firebaseio.com",
    projectId: "trounament-d8110",
    storageBucket: "trounament-d8110.firebasestorage.app",
    messagingSenderId: "882962094817",
    appId: "1:882962094817:web:111ac2630cc2a4199db5a0",
    measurementId: "G-FB2ZY0MLFG"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ==========================================
// ৩. DOM CONTENT LOADED - AUTOMATIC REGISTRATION (পরিবর্তিত অংশ)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // ১. অ্যাডমিন ডাইরেক্ট লগইন চেক
    if (userId === ADMIN_TELEGRAM_ID) {
        currentUser = { username: 'Admin', role: 'admin', telegramId: userId };
        document.getElementById('auth-page').classList.add('hidden'); 
        document.getElementById('main-app').classList.add('hidden'); 
        document.getElementById('admin-panel').classList.remove('hidden'); 
        switchAdminTab('dash');
        loadAdminData();
        return;
    }

    // ২. ইউজার অ্যাকাউন্ট ও অটো-রেজিস্ট্রেশন চেক
    db.ref('users/' + userId).once('value', snapshot => {
        let user = snapshot.val();

        if (user) {
            if (user.isBlocked === true) {
                document.getElementById('auth-page').classList.add('hidden');
                document.getElementById('main-app').classList.add('hidden');
                document.getElementById('suspended-screen').classList.remove('hidden');
                return;
            }
            loginUserFlow(user);
        } else {
            // অটো রেজিস্ট্রেশন লজিক
            let refInp = (tg.initDataUnsafe && tg.initDataUnsafe.start_param) ? tg.initDataUnsafe.start_param.trim() : "none";
            let randomDigits = Math.floor(1000 + Math.random() * 9000);
            let myNewRefCode = (firstName.substring(0,4).replace(/\s+/g, '') + randomDigits).toUpperCase();

            let newUserObject = {
                username: firstName,
                telegramId: userId,
                balance: 0,
                myOwnRefCode: myNewRefCode,
                referredBy: refInp,
                deviceId: "TG-" + Math.floor(100000 + Math.random() * 900000),
                hasBoughtBot: false,
                isBlocked: false,
                refWalletPending: 0,
                refWalletSuccess: 0,
                joinedAt: new Date().toISOString()
            };

            db.ref('users/' + userId).set(newUserObject).then(() => {
                if(refInp !== "none") {
                    processReferralActionChain(refInp, "REGISTRATION", userId);
                }
                loginUserFlow(newUserObject);
            });
        }
    });
});

// ==========================================
// ৪. MANUAL AUTHENTICATION (বাকি সব ফাংশন অপরিবর্তিত)
// ==========================================
function switchAuth(mode) {
    currentAuthMode = mode;
    if(mode === 'login') {
        document.getElementById('tab-login-btn').classList.add('active-tab-btn');
        document.getElementById('tab-reg-btn').classList.remove('active-tab-btn');
        document.getElementById('ref-field-container').classList.add('hidden');
        document.getElementById('auth-btn-text').innerText = 'Login';
    } else {
        document.getElementById('tab-reg-btn').classList.add('active-tab-btn');
        document.getElementById('tab-login-btn').classList.remove('active-tab-btn');
        document.getElementById('ref-field-container').classList.remove('hidden');
        document.getElementById('auth-btn-text').innerText = 'Register';
    }
}

function handleAuth() {
    let userInp = document.getElementById('username').value.trim();
    let passInp = document.getElementById('password').value.trim();
    let refInp = document.getElementById('ref-code-input').value.trim();
    if(!userInp || !passInp) return alert("Please fill in Username and Password!");
    document.getElementById('auth-spinner').classList.remove('hidden');
    db.ref('users/' + userId).once('value', snapshot => {
        let user = snapshot.val();
        document.getElementById('auth-spinner').classList.add('hidden');
        if(user && user.password === passInp) loginUserFlow(user);
        else alert("Invalid Credentials!");
    });
}

function loginUserFlow(user) {
    currentUser = user;
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    syncUserData();
    startFakeTransactions();
    loadLeaderboard();
    checkGlobalNotice();
    loadUserHistories();
}

function switchTab(tabId, element) {
    const tabs = ['home', 'leaderboard', 'profile'];
    tabs.forEach(t => document.getElementById('tab-' + t).classList.add('hidden'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if(element) element.classList.add('active');
    if(tabId === 'profile') loadProfileData();
    if(tabId === 'leaderboard') loadLeaderboard();
}

function toggleWalletView(type) {
    if(type === 'deposit') {
        document.getElementById('section-deposit').classList.toggle('hidden');
        document.getElementById('section-withdraw').classList.add('hidden');
    } else {
        document.getElementById('section-withdraw').classList.toggle('hidden');
        document.getElementById('section-deposit').classList.add('hidden');
    }
}

function syncUserData() {
    db.ref('users/' + userId).on('value', snapshot => {
        let data = snapshot.val();
        if(!data) return;
        currentUser = data;
        document.getElementById('user-display-name').innerText = data.username;
        document.getElementById('user-balance').innerText = parseFloat(data.balance).toFixed(2);
        triggerCloudBotsEvaluation();
    });
    loadBotMarket();
}

function loadBotMarket() {
    db.ref('bots').on('value', snapshot => {
        let market = document.getElementById('bot-market');
        if(!market) return;
        market.innerHTML = '';
        snapshot.forEach(child => {
            let b = child.val();
            market.innerHTML += `
                <div class="card-3d" style="padding:15px; text-align:center; background:rgba(255,255,255,0.03); border-radius:12px;">
                    <h4>🤖 ${b.name}</h4>
                    <p>Price: ${b.price} TK</p>
                    <button class="btn-glow" onclick="buyBot('${child.key}', ${b.price})">Rent Bot</button>
                </div>
            `;
        });
    });
}

function buyBot(botId, price) {
    if(parseFloat(currentUser.balance) < price) return alert("Insufficient balance!");
    db.ref('bots/' + botId).once('value', snap => {
        let bData = snap.val();
        let pId = Date.now();
        let endTime = pId + (bData.days * 24 * 60 * 60 * 1000);
        db.ref('users/' + userId + '/balance').set(parseFloat((currentUser.balance - price).toFixed(2)));
        db.ref('globalPurchases/' + pId).set({ id: pId, userId: userId, botName: bData.name, price: bData.price, profitAmount: bData.profit, endTime: endTime, status: "running" });
        releaseOlderBotsOfSameLevel(bData.price);
        alert("Bot purchased!");
    });
}

function releaseOlderBotsOfSameLevel(botPrice) {
    db.ref('globalPurchases').once('value', snapshot => {
        snapshot.forEach(child => {
            let p = child.val();
            if (p.price === botPrice && p.status === 'waiting') db.ref('globalPurchases/' + child.key + '/status').set('claimable');
        });
    });
}

function triggerCloudBotsEvaluation() {
    db.ref('globalPurchases').on('value', snapshot => {
        let container = document.getElementById('my-bots');
        if(!container) return;
        container.innerHTML = '';
        snapshot.forEach(child => {
            let p = child.val();
            if(p.userId !== userId) return;
            let now = Date.now();
            let status = p.status;
            if (now >= p.endTime) {
                db.ref('globalPurchases/' + child.key).update({ status: "waiting", endTime: now + (2 * 24 * 60 * 60 * 1000) });
                status = "waiting";
            }
            let btn = status === "claimable" ? `<button onclick="claimBotProfit('${child.key}', ${p.profitAmount})">Claim Profit</button>` : "";
            container.innerHTML += `<div><h5>${p.botName}</h5><p>Status: ${status}</p>${btn}</div>`;
        });
    });
}

function claimBotProfit(nodeKey, profit) {
    db.ref('users/' + userId + '/balance').transaction(c => (c || 0) + profit);
    db.ref('globalPurchases/' + nodeKey).remove();
    alert("Profit Claimed!");
}

function processReferralActionChain(refCode, actionType, triggeringUserId) {
    db.ref('sysSettings').once('value', settingsSnap => {
        let s = settingsSnap.val() || {};
        let lvl1Amt = parseFloat(s.referralBonus) || 10;
        db.ref('users').once('value', allUsersSnap => {
            let uMap = allUsersSnap.val();
            let userA_Key = null;
            for(let k in uMap) { if(uMap[k].myOwnRefCode === refCode) userA_Key = k; }
            if(userA_Key) {
                db.ref('users/' + userA_Key + '/refWalletPending').transaction(c => (c || 0) + lvl1Amt);
            }
        });
    });
}

function loadProfileData() {
    if(!currentUser) return;
    document.getElementById('profile-name').innerText = currentUser.username;
    document.getElementById('profile-balance').innerText = parseFloat(currentUser.balance).toFixed(2);
    document.getElementById('user-ref-pending').innerText = parseFloat(currentUser.refWalletPending || 0).toFixed(2);
    document.getElementById('user-ref-success').innerText = parseFloat(currentUser.refWalletSuccess || 0).toFixed(2);
    document.getElementById('permanent-ref-code').value = `https://t.me/QuantumProBD_bot/app?startapp=${currentUser.myOwnRefCode}`;
}

function copyRefCode() {
    document.getElementById('permanent-ref-code').select();
    document.execCommand('copy');
    alert("Referral Link Copied!");
}

function loadUserHistories() {
    db.ref('deposits').on('value', snap => {
        let tbody = document.getElementById('user-deposit-history');
        if(!tbody) return;
        tbody.innerHTML = '';
        snap.forEach(c => {
            let d = c.val();
            if(d.userId === userId) tbody.innerHTML += `<tr><td>${d.amount} TK</td><td>${d.trxId}</td><td>${d.status}</td></tr>`;
        });
    });
    db.ref('withdraws').on('value', snap => {
        let tbody = document.getElementById('user-withdraw-history');
        if(!tbody) return;
        tbody.innerHTML = '';
        snap.forEach(c => {
            let w = c.val();
            if(w.userId === userId) tbody.innerHTML += `<tr><td>${w.amount} TK</td><td>${w.netPay} TK</td><td>${w.status}</td></tr>`;
        });
    });
}

function loadLeaderboard() {
    let board = document.getElementById('leaderboardList');
    if (!board) return;
    board.innerHTML = '<div>Simulation Active...</div>';
}

function startFakeTransactions() {
    if(fakeTxInterval) clearInterval(fakeTxInterval);
    fakeTxInterval = setInterval(() => {
        let list = document.getElementById('fake-transaction-list');
        if(list) list.innerHTML = `<div>🎉 User withdrawn 1500 TK successfully!</div>`;
    }, 15000);
}

function checkGlobalNotice() {
    db.ref('globalNotice').on('value', snap => {
        if(snap.val()) document.getElementById('notice-modal').classList.remove('hidden');
    });
}

function closeNotice() { document.getElementById('notice-modal').classList.add('hidden'); }

function depositRequest() {
    let amt = document.getElementById('deposit-amount').value;
    let trx = document.getElementById('deposit-txid').value;
    if(!amt || !trx) return alert("Fill fields!");
    db.ref('deposits/' + Date.now()).set({ userId: userId, username: currentUser.username, amount: parseFloat(amt), trxId: trx, status: "pending" }).then(() => alert("Submitted!"));
}

function withdrawRequest() {
    let amt = document.getElementById('withdraw-amount').value;
    let phone = document.getElementById('withdraw-phone').value;
    if(!amt || !phone) return alert("Fill fields!");
    db.ref('withdraws/' + Date.now()).set({ userId: userId, username: currentUser.username, amount: parseFloat(amt), netPay: amt*0.98, phone: phone, status: "pending" }).then(() => alert("Submitted!"));
}

function switchAdminTab(tabName) {
    ['dash', 'approvals', 'bots', 'users'].forEach(t => document.getElementById('admin-tab-' + t).classList.add('hidden'));
    document.getElementById('admin-tab-' + tabName).classList.remove('hidden');
}

function loadAdminData() {
    db.ref('users').on('value', snap => {
        let tbody = document.getElementById('user-list-admin');
        if(tbody) {
            tbody.innerHTML = '';
            snap.forEach(c => {
                let u = c.val();
                tbody.innerHTML += `<tr><td>${u.username}</td><td>${parseFloat(u.balance).toFixed(2)} TK</td><td><button onclick="toggleBlockUser('${c.key}', ${u.isBlocked})">Block/Unblock</button></td></tr>`;
            });
        }
    });
}

function toggleBlockUser(key, status) { db.ref('users/' + key + '/isBlocked').set(!status); }
function logout() { tg.close(); }
