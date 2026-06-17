// ==========================================
// ১. TELEGRAM WEBAPP INITIALIZATION
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready(); 
tg.expand(); 

const tgUser = tg.initDataUnsafe?.user;
const userId = tgUser ? tgUser.id.toString() : "DEMO_USER_123";
const firstName = tgUser ? tgUser.first_name : "Guest User";

const ADMIN_TELEGRAM_ID = "5977808817"; // আপনার অ্যাডমিন আইডি

let currentUser = null;
let fakeTxInterval = null;
let currentAuthMode = 'login';

// ==========================================
// ২. FIREBASE CONFIGURATION (এখানে আপনার নিজস্ব তথ্য দিন)
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

// ফায়ারবেস ইনিশিয়ালাইজেশন চেক
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ==========================================
// ৩. DOM CONTENT LOADED - AUTOMATIC LOGIN & SECURITY
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

    // ২. ইউজার অ্যাকাউন্ট ও ব্লক স্ট্যাটাস চেক
    db.ref('users/' + userId).once('value', snapshot => {
        let user = snapshot.val();

        if (user) {
            if (user.isBlocked === true) {
                document.getElementById('auth-page').classList.add('hidden');
                document.getElementById('main-app').classList.add('hidden');
                document.getElementById('suspended-screen').classList.remove('hidden');
                return;
            }
            // অ্যাকাউন্ট থাকলে সরাসরি অ্যাপে নিয়ে যাবে
            loginUserFlow(user);
        } else {
            // অ্যাকাউন্ট না থাকলে লগইন/রেজিস্ট্রেশন পেজ দেখাবে
            document.getElementById('auth-page').classList.remove('hidden');
            // টেলিগ্রামের রেফার লিঙ্ক (start_param) থাকলে কোডটি ইনপুটে বসিয়ে দেবে
            if (tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
                switchAuth('register');
                document.getElementById('ref-code-input').value = tg.initDataUnsafe.start_param.trim();
            }
        }
    });
});

// ==========================================
// ৪. MANUAL AUTHENTICATION (LOGIN/REGISTER)
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

    if(currentAuthMode === 'register') {
        // নতুন অ্যাকাউন্ট তৈরি লজিক
        let randomDigits = Math.floor(1000 + Math.random() * 9000);
        let myNewRefCode = (userInp.substring(0,4).replace(/\s+/g, '') + randomDigits).toUpperCase();
        let finalRef = refInp === "" ? "none" : refInp;

        let newUserObject = {
            username: userInp,
            password: passInp, // সিম্পল অ্যাপ সিকিউরিটি
            telegramId: userId,
            balance: 0,
            myOwnRefCode: myNewRefCode,
            referredBy: finalRef,
            deviceId: "TG-" + Math.floor(100000 + Math.random() * 900000),
            hasBoughtBot: false,
            isBlocked: false,
            refWalletPending: 0,
            refWalletSuccess: 0,
            joinedAt: new Date().toISOString()
        };

        db.ref('users/' + userId).set(newUserObject).then(() => {
            if(finalRef !== "none") {
                processReferralActionChain(finalRef, "REGISTRATION", userId);
            }
            document.getElementById('auth-spinner').classList.add('hidden');
            loginUserFlow(newUserObject);
        });
    } else {
        // লগইন চেক
        db.ref('users/' + userId).once('value', snapshot => {
            let user = snapshot.val();
            document.getElementById('auth-spinner').classList.add('hidden');
            if(user && user.password === passInp) {
                loginUserFlow(user);
            } else {
                alert("Invalid Account or Credentials!");
            }
        });
    }
}

// ==========================================
// ৫. USER APP FLOW & CORE NAVIGATION
// ==========================================
function loginUserFlow(user) {
    currentUser = user;
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    // লাইভ ডেটা সিঙ্ক ও লুপ চালু করা
    syncUserData();
    startFakeTransactions();
    loadLeaderboard();
    checkGlobalNotice();
    loadUserHistories();
}

function switchTab(tabId, element) {
    const tabs = ['home', 'leaderboard', 'profile'];
    tabs.forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden');
    });
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
        
        // বটের রানিং ও হোল্ড (Waiting) কন্ডিশন ক্যালকুলেট করা
        triggerCloudBotsEvaluation();
    });
    loadBotMarket();
}

function loadBotMarket() {
    db.ref('bots').on('value', snapshot => {
        let market = document.getElementById('bot-market');
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

// ১. বট কেনা - নতুন বট কিনলে ব্যালেন্স কাটবে এবং সিস্টেম চেক করবে আগের কোনো বট হোল্ডে আছে কি না
function buyBot(botId, price) {
    if(parseFloat(currentUser.balance) < price) return alert("Insufficient balance!");

    db.ref('bots/' + botId).once('value', snap => {
        let bData = snap.val();
        let pId = Date.now();
        let endTime = pId + (bData.days * 24 * 60 * 60 * 1000);

        let newPurchase = {
            id: pId,
            userId: userId,
            botName: bData.name,
            price: bData.price,
            profitAmount: bData.profit,
            endTime: endTime,
            status: "running"
        };

        db.ref('users/' + userId + '/balance').set(parseFloat((currentUser.balance - price).toFixed(2)));
        db.ref('globalPurchases/' + pId).set(newPurchase).then(() => {
            // এই ফাংশনটি এখন চেক করবে এই প্রাইসের কেউ হোল্ডে আছে কি না
            releaseOlderBotsOfSameLevel(bData.price);
            alert("Bot purchased!");
        });
    });
}

// ২. শর্ত: শুধুমাত্র সেম প্রাইসের বট পেলেই হোল্ড রিলিজ হবে
function releaseOlderBotsOfSameLevel(botPrice) {
    db.ref('globalPurchases').once('value', snapshot => {
        snapshot.forEach(child => {
            let p = child.val();
            // যদি একই প্রাইসের এবং 'waiting' মোডে থাকে, তবেই সে টাকা ক্লেম করতে পারবে
            if (p.price === botPrice && p.status === 'waiting') {
                db.ref('globalPurchases/' + child.key + '/status').set('claimable');
            }
        });
    });
}

// ৩. মনিটরিং - মেয়াদ শেষ হলে ২ দিন করে বাড়ানো এবং হোল্ডে রাখা
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

            // মেয়াদের লজিক: সময় শেষ হলে ২ দিন করে বাড়বে
            if (now >= p.endTime) {
                let extendedTime = now + (2 * 24 * 60 * 60 * 1000);
                db.ref('globalPurchases/' + child.key).update({ 
                    status: "waiting", 
                    endTime: extendedTime 
                });
                status = "waiting";
            }

            // UI আপডেট
            let displayStatus = status === "running" ? "Running" : (status === "waiting" ? "Waiting (Hold)" : "Claimable");
            let btn = status === "claimable" ? `<button onclick="claimBotProfit('${child.key}', ${p.profitAmount})">Claim Profit</button>` : "";
            
            container.innerHTML += `<div><h5>${p.botName}</h5><p>Status: ${displayStatus}</p>${btn}</div>`;
        });
    });
}

// ৪. প্রফিট ক্লেম
function claimBotProfit(nodeKey, profit) {
    db.ref('users/' + userId + '/balance').transaction(c => (c || 0) + profit);
    db.ref('globalPurchases/' + nodeKey).remove();
    alert("Profit Claimed!");
}


// ==========================================
// 🎯 ৭. REFERRAL MLM ENGINE (PENDING VS SUCCESS MATRIX)
// ==========================================
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
                for(let k in uMap) {
                    if(uMap[k].myOwnRefCode === refCode) userA_Key = k;
                }
                if(userA_Key) {
                    if(uMap[userA_Key].hasBoughtBot === true) {
                        db.ref('users/' + userA_Key + '/balance').transaction(c => (c || 0) + lvl1Amt);
                        db.ref('users/' + userA_Key + '/refWalletSuccess').transaction(c => (c || 0) + lvl1Amt);
                    } else {
                        db.ref('users/' + userA_Key + '/refWalletPending').transaction(c => (c || 0) + lvl1Amt);
                    }
                }
            } 
            else if (actionType === "BOT_PURCHASE") {
                for(let k in uMap) {
                    if(uMap[k].myOwnRefCode === triggerUser.referredBy) userA_Key = k;
                }
                if(userA_Key) {
                    if(uMap[userA_Key].hasBoughtBot === true) {
                        db.ref('users/' + userA_Key + '/balance').transaction(c => (c || 0) + lvl2Amt);
                        db.ref('users/' + userA_Key + '/refWalletSuccess').transaction(c => (c || 0) + lvl2Amt);
                    } else {
                        db.ref('users/' + userA_Key + '/refWalletPending').transaction(c => (c || 0) + lvl2Amt);
                    }

                    // ইউজার নিজে বট কিনলে তার পেন্ডিং ওয়ালেট রিলিজ হবে
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

// ==========================================
// 👤 ৮. PROFILE & LINK DISTRIBUTION
// ==========================================
function loadProfileData() {
    if(!currentUser) return;
    document.getElementById('profile-name').innerText = currentUser.username;
    document.getElementById('profile-balance').innerText = parseFloat(currentUser.balance).toFixed(2);
    document.getElementById('user-ref-pending').innerText = parseFloat(currentUser.refWalletPending || 0).toFixed(2);
    document.getElementById('user-ref-success').innerText = parseFloat(currentUser.refWalletSuccess || 0).toFixed(2);
    
    let botUsername = "QuantumProBD_bot"; // আপনার অরিজিনাল বট ইউজারনেম দিন
    document.getElementById('permanent-ref-code').value = `https://t.me/${botUsername}/app?startapp=${currentUser.myOwnRefCode}`;
}

function copyRefCode() {
    let copyText = document.getElementById('permanent-ref-code');
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    alert("Referral Matrix Link Copied!");
}

// USER HISTORIES LOAD
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

// ==========================================
// 📊 ৯. LEADERBOARD & POPUPS (SIMULATION)
// ==========================================
let fakeLeaderboardData = [
    { name: "Rafiqul Islam", balance: 5420, tag: '👑 কিং মেম্বার' },
    { name: "Al Amin Hossain", balance: 4850, tag: '⚡ প্রো Elite' },
    { name: "Sumaiya Akter", balance: 4120, tag: '💎 এলিট মেম্বার' },
    { name: "Tariqul Islam", balance: 3950, tag: '🥇 গোল্ড মেম্বার' }
];

function loadLeaderboard() {
    let board = document.getElementById('leaderboardList');
    if (!board) return;
    board.innerHTML = '';
    fakeLeaderboardData.sort((a,b) => b.balance - a.balance);
    fakeLeaderboardData.forEach((user, idx) => {
        let medal = idx === 0 ? "🥇 " : (idx === 1 ? "🥈 " : "#" + (idx+1) + " ");
        board.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:10px; background:rgba(255,255,255,0.02); margin-bottom:6px; border-radius:8px; font-size:13px;">
                <span><b>${medal}${user.name}</b> <small style="color:#2dd4bf; font-size:10px;">(${user.tag})</small></span>
                <span style="color:#10b981; font-weight:bold;">${user.balance} TK</span>
            </div>
        `;
    });
}

function startFakeTransactions() {
    if(fakeTxInterval) clearInterval(fakeTxInterval);
    let fakeNames = ["Abir", "Sujon", "Mim", "Tarek", "Rifat"];
    fakeTxInterval = setInterval(() => {
        let list = document.getElementById('fake-transaction-list');
        if(!list) return;
        let name = fakeNames[Math.floor(Math.random() * fakeNames.length)];
        let amt = Math.floor(Math.random() * 2000) + 500;
        list.innerHTML = `
            <div class="animate__animated animate__fadeInUp" style="background:rgba(16,185,129,0.1); border-left:3px solid #10b981; padding:8px; font-size:12px; color:#fff;">
                🎉 <b>${name}***</b> withdrew <b>${amt} TK</b> successfully via bKash!
            </div>
        `;
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

// ==========================================
// 💰 ১০. TRANSACTION INPUT REQUESTS
// ==========================================
function depositRequest() {
    let amt = document.getElementById('deposit-amount').value;
    let trx = document.getElementById('deposit-txid').value;
    if(!amt || !trx) return alert("Fill up all fields!");
    let reqId = Date.now();
    db.ref('deposits/' + reqId).set({ id: reqId, userId: userId, username: currentUser.username, amount: parseFloat(amt), trxId: trx, status: "pending" }).then(() => {
        alert("Deposit Submitted!");
    });
}

function withdrawRequest() {
    let amt = document.getElementById('withdraw-amount').value;
    let phone = document.getElementById('withdraw-phone').value;
    if(!amt || !phone) return alert("Fill up all fields!");
    if(parseFloat(amt) < 500) return alert("Min withdraw 500 TK");
    let reqId = Date.now();
    db.ref('withdraws/' + reqId).set({ id: reqId, userId: userId, username: currentUser.username, amount: parseFloat(amt), netPay: amt*0.98, phone: phone, status: "pending" }).then(() => {
        alert("Withdraw Submitted!");
    });
}

// ==========================================
// 🛠️ ১১. ULTRA ADMIN CONTROL PANEL ENGINE (হুবহু HTML অনুযায়ী)
// ==========================================
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
    // সিস্টেম ক্যাশ হিসাব ক্যালকুলেশন
    db.ref('users').on('value', snap => {
        let totalBal = 0;
        let tbody = document.getElementById('user-list-admin');
        if(tbody) tbody.innerHTML = '';

        snap.forEach(c => {
            let u = c.val();
            totalBal += parseFloat(u.balance || 0);

            if(tbody) {
                let btnText = u.isBlocked ? "Unblock" : "Block";
                tbody.innerHTML += `
                    <tr ondblclick="directSearchUser('${u.username}')">
                        <td>${u.username}</td>
                        <td>${parseFloat(u.balance).toFixed(2)} TK</td>
                        <td>${u.deviceId || 'N/A'}</td>
                        <td><button style="background:#ef4444; padding:2px 5px;" onclick="toggleBlockUser('${c.key}', ${u.isBlocked || false})">${btnText}</button></td>
                    </tr>
                `;
            }
        });
        document.getElementById('stat-total-balance').innerText = totalBal.toFixed(2);
    });

    // ডিপোজিট এবং উইথড্রল টোটাল হিসাব ও পেন্ডিং রেন্ডারিং
    db.ref('deposits').on('value', snap => {
        let totalDep = 0;
        let dList = document.getElementById('admin-deposit-list');
        if(dList) dList.innerHTML = '';

        snap.forEach(c => {
            let d = c.val();
            if(d.status === 'approved') totalDep += parseFloat(d.amount);
            if(d.status === 'pending' && dList) {
                dList.innerHTML += `<tr><td>${d.username}</td><td>${d.amount}</td><td>${d.trxId}</td><td><button onclick="approveDeposit('${c.key}')">✔</button></td></tr>`;
            }
        });
        document.getElementById('stat-total-deposited').innerText = totalDep;
    });

    db.ref('withdraws').on('value', snap => {
        let totalWit = 0;
        let wList = document.getElementById('admin-withdraw-list');
        if(wList) wList.innerHTML = '';

        snap.forEach(c => {
            let w = c.val();
            if(w.status === 'approved') totalWit += parseFloat(w.amount);
            if(w.status === 'pending' && wList) {
                wList.innerHTML += `<tr><td>${w.username}</td><td>${w.amount}</td><td>${w.netPay}</td><td>${w.phone}</td><td><button onclick="approveWithdraw('${c.key}')">✔</button></td></tr>`;
            }
        });
        document.getElementById('stat-total-withdrawn').innerText = totalWit;
        
        // অ্যাডমিন নেট ক্যাশ ক্যালকুলেশন
        let dep = parseFloat(document.getElementById('stat-total-deposited').innerText) || 0;
        document.getElementById('stat-admin-cash').innerText = (dep - totalWit).toFixed(2);
    });

    // অ্যাডমিন বটস লিস্ট রেন্ডার
    db.ref('bots').on('value', snap => {
        let bList = document.getElementById('admin-bots-list');
        if(!bList) return;
        bList.innerHTML = '';
        snap.forEach(c => {
            let b = c.val();
            bList.innerHTML += `<tr><td>${b.name}</td><td>${b.price}</td><td>${b.profit}</td><td>${b.days}</td></tr>`;
        });
    });
}

// অ্যাডমিন অ্যাকশন মেথডসমূহ
function approveDeposit(key) {
    db.ref('deposits/' + key).once('value', snap => {
        let dep = snap.val();
        db.ref('users/' + dep.userId + '/balance').transaction(c => (c || 0) + dep.amount);
        db.ref('deposits/' + key + '/status').set('approved').then(() => alert("Deposit Approved!"));
    });
}

function approveWithdraw(key) {
    db.ref('withdraws/' + key + '/status').set('approved').then(() => alert("Withdraw Approved!"));
}

function createBot() {
    let name = document.getElementById('bot-name').value;
    let price = parseFloat(document.getElementById('bot-price').value);
    let profit = parseFloat(document.getElementById('bot-profit').value);
    let days = parseInt(document.getElementById('bot-days').value);
    
    if(!name || !price || !profit || !days) return alert("Fill all bot fields!");
    db.ref('bots').push({ name, price, profit, days }).then(() => {
        alert("New Bot Published to Market!");
    });
}

function toggleBlockUser(userKey, currentStatus) {
    db.ref('users/' + userKey + '/isBlocked').set(!currentStatus);
}

function pushNotice() {
    let txt = document.getElementById('admin-notice-input').value;
    db.ref('globalNotice').set(txt).then(() => alert("Notice Updated globally!"));
}

function updateReferralCommission() {
    let amt = document.getElementById('admin-ref-commission-input').value;
    db.ref('sysSettings/referralBonus').set(parseFloat(amt)).then(() => alert("Reg Bonus Updated!"));
}

function updateBotCommissions() {
    let l1 = document.getElementById('admin-lvl1-input').value;
    let l2 = document.getElementById('admin-lvl2-input').value;
    db.ref('sysSettings/lvl1Commission').set(parseFloat(l1));
    db.ref('sysSettings/lvl2Commission').set(parseFloat(l2)).then(() => alert("Bot Commissions Updated!"));
}

// অ্যাডমিন সার্চ মেথড
function directSearchUser(uname) {
    document.getElementById('admin-user-search-input').value = uname;
    searchUserTransactionsAndStatus();
}

function searchUserTransactionsAndStatus() {
    let q = document.getElementById('admin-user-search-input').value.trim().toLowerCase();
    let box = document.getElementById('admin-user-trx-box');
    let tbody = document.getElementById('admin-user-trx-history-body');
    
    if(q === "") { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    tbody.innerHTML = '';

    // ডিপোজিট সার্চ
    db.ref('deposits').once('value', snap => {
        snap.forEach(c => {
            let d = c.val();
            if(d.username.toLowerCase().includes(q)) {
                tbody.innerHTML += `<tr><td>Deposit</td><td>${d.amount}</td><td>${d.trxId}</td><td>${d.status}</td></tr>`;
            }
        });
    });
    // উইথড্র সার্চ
    db.ref('withdraws').once('value', snap => {
        snap.forEach(c => {
            let w = c.val();
            if(w.username.toLowerCase().includes(q)) {
                tbody.innerHTML += `<tr><td>Withdraw</td><td>${w.amount}</td><td>${w.phone}</td><td>${w.status}</td></tr>`;
            }
        });
    });
}

function logout() { tg.close(); }
