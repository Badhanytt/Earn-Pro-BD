// ==========================================
// ১. TELEGRAM WEBAPP INITIALIZATION
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready(); 
tg.expand(); 

const tgUser = tg.initDataUnsafe?.user;
// টেলিগ্রাম আইডি ব্যবহার করা হচ্ছে (এটি কখনো পরিবর্তন হয় না)
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
// ৩. DOM CONTENT LOADED - TELEGRAM ID BASED AUTO REGISTRATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // অ্যাডমিন চেক
    if (userId === ADMIN_TELEGRAM_ID) {
        currentUser = { username: 'Admin', role: 'admin', telegramId: userId };
        document.getElementById('auth-page').classList.add('hidden'); 
        document.getElementById('main-app').classList.add('hidden'); 
        document.getElementById('admin-panel').classList.remove('hidden'); 
        switchAdminTab('dash');
        loadAdminData();
        return;
    }

    // টেলিগ্রাম আইডি দিয়ে ইউজার ডাটাবেসে চেক করা হচ্ছে
    db.ref('users/' + userId).once('value', snapshot => {
        let user = snapshot.val();

        if (user) {
            // ইউজার ডাটাবেসে থাকলে সরাসরি লগইন
            if (user.isBlocked === true) {
                document.getElementById('auth-page').classList.add('hidden');
                document.getElementById('main-app').classList.add('hidden');
                document.getElementById('suspended-screen').classList.remove('hidden');
                return;
            }
            loginUserFlow(user);
        } else {
            // ডাটাবেসে না থাকলে আইডি দিয়ে অটো রেজিস্ট্রেশন
            let refInp = (tg.initDataUnsafe && tg.initDataUnsafe.start_param) ? tg.initDataUnsafe.start_param.trim() : "none";
            let randomDigits = Math.floor(1000 + Math.random() * 9000);
            let myNewRefCode = (firstName.substring(0,4).replace(/\s+/g, '') + randomDigits).toUpperCase();

            let newUserObject = {
                username: firstName,
                telegramId: userId, // টেলিগ্রাম আইডি সেভ হচ্ছে
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
// ৪. MANUAL AUTHENTICATION (বাকি ফাংশনগুলো আগের মতোই)
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
    // এই ফাংশনটি এখন আর প্রয়োজন নেই বললেই চলে, কারণ অটো-রেজিষ্ট্রেশন হয়ে যাচ্ছে।
    // তবে কোডটি ভাঙা এড়াতে এটি খালি রাখা হয়েছে।
}

// ==========================================
// ৫. USER APP FLOW & CORE NAVIGATION
// ==========================================
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

// ==========================================
// ৬. REALTIME DATA SYNC & CLOUD MINING BOT ENGINE
// ==========================================
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
        if(!snapshot.exists()) {
            market.innerHTML = '<p style="color:#94a3b8; font-size:12px;">No active bots available right now.</p>';
            return;
        }
        snapshot.forEach(child => {
            let b = child.val();
            market.innerHTML += `
                <div class="card-3d animate-pop" style="padding:15px; text-align:center; background:rgba(255,255,255,0.03); border-radius:12px;">
                    <h4 style="margin:0 0 5px 0; color:#2dd4bf;">🤖 ${b.name}</h4>
                    <p style="font-size:12px; margin:5px 0;">Price: <b style="color:#fff;">${b.price} TK</b></p>
                    <p style="font-size:11px; color:#94a3b8; margin-bottom:10px;">Return: ${b.profit} TK (${b.days} Days)</p>
                    <button class="btn-glow" style="padding:6px 15px; font-size:12px;" onclick="buyBot('${child.key}', ${b.price})">Rent Bot</button>
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
        let newPurchase = { id: pId, userId: userId, botName: bData.name, price: bData.price, profitAmount: bData.profit, endTime: endTime, status: "running" };
        db.ref('users/' + userId + '/balance').set(parseFloat((currentUser.balance - price).toFixed(2)));
        db.ref('globalPurchases/' + pId).set(newPurchase).then(() => {
            releaseOlderBotsOfSameLevel(bData.price);
            alert("Bot purchased!");
        });
    });
}

function releaseOlderBotsOfSameLevel(botPrice) {
    db.ref('globalPurchases').once('value', snapshot => {
        snapshot.forEach(child => {
            let p = child.val();
            if (p.price === botPrice && p.status === 'waiting') {
                db.ref('globalPurchases/' + child.key + '/status').set('claimable');
            }
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
                let extendedTime = now + (2 * 24 * 60 * 60 * 1000);
                db.ref('globalPurchases/' + child.key).update({ status: "waiting", endTime: extendedTime });
                status = "waiting";
            }
            let displayStatus = status === "running" ? "Running" : (status === "waiting" ? "Waiting (Hold)" : "Claimable");
            let btn = status === "claimable" ? `<button onclick="claimBotProfit('${child.key}', ${p.profitAmount})">Claim Profit</button>` : "";
            container.innerHTML += `<div><h5>${p.botName}</h5><p>Status: ${displayStatus}</p>${btn}</div>`;
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
        let lvl2Amt = parseFloat(s.lvl2Commission) || 20; 
        db.ref('users').once('value', allUsersSnap => {
            let uMap = allUsersSnap.val();
            let userA_Key = null;
            let triggerUser = uMap[triggeringUserId];
            if (actionType === "REGISTRATION") {
                for(let k in uMap) { if(uMap[k].myOwnRefCode === refCode) userA_Key = k; }
                if(userA_Key) {
                    if(uMap[userA_Key].hasBoughtBot === true) {
                        db.ref('users/' + userA_Key + '/balance').transaction(c => (c || 0) + lvl1Amt);
                        db.ref('users/' + userA_Key + '/refWalletSuccess').transaction(c => (c || 0) + lvl1Amt);
                    } else {
                        db.ref('users/' + userA_Key + '/refWalletPending').transaction(c => (c || 0) + lvl1Amt);
                    }
                }
            } else if (actionType === "BOT_PURCHASE") {
                for(let k in uMap) { if(uMap[k].myOwnRefCode === triggerUser.referredBy) userA_Key = k; }
                if(userA_Key) {
                    if(uMap[userA_Key].hasBoughtBot === true) {
                        db.ref('users/' + userA_Key + '/balance').transaction(c => (c || 0) + lvl2Amt);
                        db.ref('users/' + userA_Key + '/refWalletSuccess').transaction(c => (c || 0) + lvl2Amt);
                    } else {
                        db.ref('users/' + userA_Key + '/refWalletPending').transaction(c => (c || 0) + lvl2Amt);
                    }
                    if(triggerUser.refWalletPending > 0) {
                        let totalPending = parseFloat(triggerUser.refWalletPending);
                        db.ref('users/' + triggeringUserId).update({
                            balance: parseFloat((triggerUser.balance + totalPending).toFixed(2)),
                            refWalletSuccess: parseFloat(((triggerUser.refWalletSuccess || 0) + totalPending).toFixed(2)),
                            refWalletPending: 0
                        });
                    }
                }
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
    let botUsername = "QuantumProBD_bot"; 
    document.getElementById('permanent-ref-code').value = `https://t.me/${botUsername}/app?startapp=${currentUser.myOwnRefCode}`;
}

function copyRefCode() {
    let copyText = document.getElementById('permanent-ref-code');
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    alert("Referral Matrix Link Copied!");
}

function loadUserHistories() {
    db.ref('deposits').on('value', snap => {
        let tbody = document.getElementById('user-deposit-history');
        if(!tbody) return;
        tbody.innerHTML = '';
        snap.forEach(c => {
            let d = c.val();
            if(d.userId === userId) {
                let badge = d.status === 'approved' ? '🟢 Success' : '🟡 Pending';
                tbody.innerHTML += `<tr><td>${d.amount} TK</td><td>${d.trxId}</td><td>${badge}</td></tr>`;
            }
        });
    });
    db.ref('withdraws').on('value', snap => {
        let tbody = document.getElementById('user-withdraw-history');
        if(!tbody) return;
        tbody.innerHTML = '';
        snap.forEach(c => {
            let w = c.val();
            if(w.userId === userId) {
                let badge = w.status === 'approved' ? '🟢 Success' : '🟡 Pending';
                tbody.innerHTML += `<tr><td>${w.amount} TK</td><td>${w.netPay} TK</td><td>${badge}</td></tr>`;
            }
        });
    });
}

function loadLeaderboard() {
    let board = document.getElementById('leaderboardList');
    if (!board) return;
    board.innerHTML = '';
    // এখানে চাইলে ডাটাবেস থেকে রিয়েল লিডারবোর্ড লোড করতে পারেন
    // আপাতত আগের মতোই রাখা হয়েছে।
}

function startFakeTransactions() {
    if(fakeTxInterval) clearInterval(fakeTxInterval);
    let fakeNames = ["Abir", "Sujon", "Mim", "Tarek", "Rifat"];
    fakeTxInterval = setInterval(() => {
        let list = document.getElementById('fake-transaction-list');
        if(!list) return;
        let name = fakeNames[Math.floor(Math.random() * fakeNames.length)];
        let amt = Math.floor(Math.random() * 2000) + 500;
        list.innerHTML = `<div style="background:rgba(16,185,129,0.1); border-left:3px solid #10b981; padding:8px; font-size:12px; color:#fff;">🎉 <b>${name}***</b> withdrew <b>${amt} TK</b> successfully via bKash!</div>`;
    }, 15000);
}

function checkGlobalNotice() {
    db.ref('globalNotice').on('value', snap => {
        let text = snap.val();
        if(text && text.trim() !== "") {
            document.getElementById('notice-text-content').innerText = text;
            document.getElementById('notice-modal').classList.remove('hidden');
        }
    });
}

function closeNotice() { document.getElementById('notice-modal').classList.add('hidden'); }

function depositRequest() {
    let amt = document.getElementById('deposit-amount').value;
    let trx = document.getElementById('deposit-txid').value;
    if(!amt || !trx) return alert("Fill up all fields!");
    let reqId = Date.now();
    db.ref('deposits/' + reqId).set({ id: reqId, userId: userId, username: currentUser.username, amount: parseFloat(amt), trxId: trx, status: "pending" }).then(() => alert("Deposit Submitted!"));
}

function withdrawRequest() {
    let amt = document.getElementById('withdraw-amount').value;
    let phone = document.getElementById('withdraw-phone').value;
    if(!amt || !phone) return alert("Fill up all fields!");
    if(parseFloat(amt) < 500) return alert("Min withdraw 500 TK");
    let reqId = Date.now();
    db.ref('withdraws/' + reqId).set({ id: reqId, userId: userId, username: currentUser.username, amount: parseFloat(amt), netPay: amt*0.98, phone: phone, status: "pending" }).then(() => alert("Withdraw Submitted!"));
}

function switchAdminTab(tabName) {
    let tabs = ['dash', 'approvals', 'bots', 'users'];
    tabs.forEach(t => {
        document.getElementById('admin-tab-' + t).classList.add('hidden');
        document.getElementById('admin-btn-' + t).classList.remove('active-admin-btn');
    });
    document.getElementById('admin-tab-' + tabName).classList.remove('hidden');
    document.getElementById('admin-btn-' + tabName).classList.add('active-admin-btn');
}

function loadAdminData() {
    db.ref('users').on('value', snap => {
        let totalBal = 0;
        let tbody = document.getElementById('user-list-admin');
        if(tbody) {
            tbody.innerHTML = '';
            snap.forEach(c => {
                let u = c.val();
                totalBal += parseFloat(u.balance || 0);
                let btnText = u.isBlocked ? "Unblock" : "Block";
                tbody.innerHTML += `<tr><td>${u.username}</td><td>${parseFloat(u.balance).toFixed(2)} TK</td><td>${u.deviceId || 'N/A'}</td><td><button onclick="toggleBlockUser('${c.key}', ${u.isBlocked || false})">${btnText}</button></td></tr>`;
            });
        }
        document.getElementById('stat-total-balance').innerText = totalBal.toFixed(2);
    });
    // (বাকি অ্যাডমিন ফাংশনগুলো আগের মতোই)
}

function toggleBlockUser(userKey, currentStatus) { db.ref('users/' + userKey + '/isBlocked').set(!currentStatus); }
function logout() { tg.close(); }
