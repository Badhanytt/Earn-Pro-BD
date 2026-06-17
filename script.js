// ==========================================
// ১. TELEGRAM WEB APP INITIALIZATION & STATES
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready(); 
tg.expand(); 

const tgUser = tg.initDataUnsafe?.user;
const userId = tgUser ? tgUser.id.toString() : "DEMO_USER_123";
const firstName = tgUser ? tgUser.first_name : "Guest User";

// 👑 আপনার মেইন অ্যাডমিন আইডি
const ADMIN_TELEGRAM_ID = "5977808817"; 

let currentUser = null;
let liveInterval = null;
let fakeTxInterval = null;
let leaderboardInterval = null;

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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// ৩. DOM CONTENT LOADED - AUTOMATIC TELEGRAM LOGIN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // ক) আপনি নিজে ঢুকলে সরাসরি অ্যাডমিন প্যানেল ওপেন হবে
    if (userId === ADMIN_TELEGRAM_ID) {
        currentUser = { username: 'Admin', role: 'admin', telegramId: userId };
        
        document.getElementById('auth-page').classList.add('hidden'); 
        document.getElementById('main-app').classList.add('hidden'); 
        document.getElementById('admin-panel').classList.remove('hidden'); 
        
        switchAdminTab('dash');
        loadAdminData();
        return;
    }

    // খ) সাধারণ ইউজার ঢুকলে অটো-লগইন বা অটো-রেজিস্ট্রেশন (টেলিগ্রাম গেটওয়ে)
    db.ref('users/' + userId).once('value', snapshot => {
        let user = snapshot.val();

        if (user) {
            // যদি ইউজার ব্যান থাকে, আপনার ডিজাইন করা suspended-screen শো করবে
            if (user.isBlocked === true) {
                document.getElementById('auth-page').classList.add('hidden');
                document.getElementById('main-app').classList.add('hidden');
                document.getElementById('suspended-screen').classList.remove('hidden');
                return;
            }
            loginUserFlow(user);
        } else {
            // নতুন ইউজার হলে অটোমেটিক ব্যাকএন্ড অ্যাকাউন্ট তৈরি (টেলিগ্রাম আইডি বেসড)
            let randomDigits = Math.floor(1000 + Math.random() * 9000);
            let myNewPermanentRefCode = (firstName.substring(0,4).replace(/\s+/g, '') + randomDigits).toUpperCase();

            // টেলিগ্রাম স্টার্টঅ্যাপ প্যারামিটার থেকে ইনভাইট কোড চেক করা
            let startParam = tg.initDataUnsafe?.start_param || "none";

            let newUserObject = { 
                username: firstName, 
                telegramId: userId,
                balance: 0,
                myOwnRefCode: myNewPermanentRefCode, 
                referredBy: startParam,   
                deviceId: "TG-" + Math.floor(100000 + Math.random() * 900000), // ডাইনামিক ডিভাইস আইডি জেনারেট
                hasBoughtBot: false,
                isBlocked: false,
                joinedAt: new Date().toISOString()
            };

            db.ref('users/' + userId).set(newUserObject).then(() => {
                // নতুন রেফারার থাকলে তাকে রিওয়ার্ড সাইকেল প্রসেস করা
                if(startParam !== "none") {
                    processReferralBonusOnReg(startParam);
                }
                loginUserFlow(newUserObject);
            });
        }
    });
});

// HTML-এর ম্যানুয়াল লগইন/রেজিস্ট্রেশন বাটন হ্যান্ডল করার ব্যাকআপ মেথড
function switchAuth(type) {
    if(type === 'register') {
        document.getElementById('tab-login-btn').classList.remove('active-tab-btn');
        document.getElementById('tab-reg-btn').classList.add('active-tab-btn');
        document.getElementById('ref-field-container').classList.remove('hidden');
        document.getElementById('auth-btn-text').innerText = "Register";
    } else {
        document.getElementById('tab-reg-btn').classList.remove('active-tab-btn');
        document.getElementById('tab-login-btn').classList.add('active-tab-btn');
        document.getElementById('ref-field-container').classList.add('hidden');
        document.getElementById('auth-btn-text').innerText = "Login";
    }
}

function handleAuth() {
    // টেলিগ্রাম মিনি অ্যাপ অটো লগইন হ্যান্ডল করছে, ম্যানুয়াল ক্লিকের ক্ষেত্রে রিলোড এভয়েড করার জন্য প্রোটেকশন
    alert("Telegram Secure Gateway Auto-Verified Your Account! Loading Matrix...");
}

function loginUserFlow(user) {
    currentUser = user;
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    switchTab('home', document.querySelector('.bottom-nav .nav-item'));
    
    // আপনার অ্যাপের রিয়েলটাইম মেথডসমূহ চালু করা
    syncUserData();
    startLiveTimerLoop();
    triggerNoticeModal();
    startFakeTransactions();
    loadLeaderboard();
}

// ==========================================
// ৪. USER INTERFACE NAVIGATION (TAB SWITCHING)
// ==========================================
function switchTab(tabId, el) {
    const tabs = ['home', 'leaderboard', 'profile'];
    tabs.forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden');
    });
    document.getElementById('tab-' + tabId).classList.remove('hidden');

    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    if(el) el.classList.add('active');

    if(tabId === 'profile') loadProfileData();
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
// ৫. USER CORE LOBBY & DATA SYNC
// ==========================================
function syncUserData() {
    if(!currentUser || currentUser.role === 'admin') return;

    db.ref('users/' + userId).on('value', snapshot => {
        let data = snapshot.val();
        if(!data) return;
        currentUser = data;

        document.getElementById('user-display-name').innerText = data.username;
        document.getElementById('user-balance').innerText = parseFloat(data.balance).toFixed(2);
        
        // রান থাকা বটগুলোর লিস্ট রিফ্রেশ করা
        loadMyRunningBots();
    });

    // মার্কেটপ্লেসের বট লোড করা
    loadBotMarket();
}

function loadProfileData() {
    if(!currentUser) return;
    document.getElementById('profile-name').innerText = currentUser.username;
    document.getElementById('profile-balance').innerText = parseFloat(currentUser.balance).toFixed(2);
    document.getElementById('user-ref-pending').innerText = parseFloat(currentUser.refWalletPending || 0).toFixed(2);
    document.getElementById('user-ref-success').innerText = parseFloat(currentUser.refWalletSuccess || 0).toFixed(2);
    
    // টেলিগ্রামের ইনভাইটেশন লিংক জেনারেট
    let botUsername = "QuantumProBD_bot"; // আপনার বটের ইউজারনেম
    document.getElementById('permanent-ref-code').value = `https://t.me/${botUsername}/app?startapp=${currentUser.myOwnRefCode}`;

    loadUserHistory();
}

function copyRefCode() {
    let copyText = document.getElementById('permanent-ref-code');
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
    alert("Referral Link Copied!");
}

// ==========================================
// ৬. BOT MARKETPLACE & INCOME CORE LOGIC
// ==========================================
function loadBotMarket() {
    db.ref('bots').on('value', snapshot => {
        let market = document.getElementById('bot-market');
        market.innerHTML = '';
        if(!snapshot.exists()) {
            market.innerHTML = '<p style="color:#94a3b8; font-size:12px; padding:15px;">No active bots available right now.</p>';
            return;
        }
        snapshot.forEach(child => {
            let b = child.val();
            market.innerHTML += `
                <div class="bot-card card-3d">
                    <h4>🤖 ${b.name}</h4>
                    <p>Price: <b>${b.price} TK</b></p>
                    <p>Total Return: <b style="color:#2dd4bf;">${b.profit} TK</b></p>
                    <p>Duration: <b>${b.days} Days</b></p>
                    <button onclick="buyBot('${child.key}', ${b.price})">Rent Bot</button>
                </div>
            `;
        });
    });
}

function buyBot(botId, price) {
    if(parseFloat(currentUser.balance) < price) {
        return alert("Insufficient balance! Please deposit cash first.");
    }

    // 🔒 [নিরাপত্তা লক] একই বট ডাবল কেনা আটকানোর চেক
    let isAlreadyRunning = false;
    if (currentUser.runningBots) {
        for (let key in currentUser.runningBots) {
            if (currentUser.runningBots[key].botId === botId) {
                isAlreadyRunning = true;
                break;
            }
        }
    }

    if (isAlreadyRunning) {
        return alert("এই লেভেলের বটটি আপনার অলরেডি একটি রানিং আছে! এটি শেষ না হওয়া পর্যন্ত একই লেভেলের বট দ্বিতীয়বার কিনতে পারবেন না।");
    }

    db.ref('bots/' + botId).once('value', snap => {
        let bData = snap.val();
        if(!bData) return;

        let newBalance = parseFloat((currentUser.balance - price).toFixed(2));
        
        let myNewBot = {
            botId: botId,
            name: bData.name,
            price: bData.price,
            profit: bData.profit,
            days: bData.days,
            dailyReturn: parseFloat((bData.profit / bData.days).toFixed(2)),
            lastClaimed: new Date().toISOString(),
            purchasedAt: new Date().toISOString(),
            daysPassed: 0
        };

        // ব্যালেন্স আপডেট এবং রানিং বটে ডেটা পুশ
        db.ref('users/' + userId + '/balance').set(newBalance);
        db.ref('users/' + userId + '/hasBoughtBot').set(true);
        
        // প্রথমবার বট কিনলে পেন্ডিং রেফারেল বোনাস মেইন ওয়ালেটে সাকসেসফুল ক্লেম করা
        let pendingBonus = parseFloat(currentUser.refWalletPending || 0);
        if(pendingBonus > 0) {
            db.ref('users/' + userId + '/refWalletSuccess').transaction(c => (parseFloat(c) || 0) + pendingBonus);
            db.ref('users/' + userId + '/balance').transaction(c => (parseFloat(c) || 0) + pendingBonus);
            db.ref('users/' + userId + '/refWalletPending').set(0);
        }

        db.ref('users/' + userId + '/runningBots').push(myNewBot).then(() => {
            alert(`Successfully activated ${bData.name}!`);
            
            // টু-লেভেল রেফারেল কমিশন ডিস্ট্রিবিউট করা
            distributeBotPurchaseCommissions(price);
        });
    });
}

function loadMyRunningBots() {
    let container = document.getElementById('my-bots');
    container.innerHTML = '';
    
    db.ref('users/' + userId + '/runningBots').once('value', snapshot => {
        if(!snapshot.exists()) {
            container.innerHTML = '<p style="color:#94a3b8; font-size:12px; padding:10px;">You do not have any running bots currently.</p>';
            return;
        }
        snapshot.forEach(child => {
            let rb = child.val();
            container.innerHTML += `
                <div class="running-bot-card card-3d" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:12px; margin-bottom:8px; border-radius:8px;">
                    <div>
                        <h4 style="margin:0; font-size:14px; color:#fff;">${rb.name}</h4>
                        <p style="margin:2px 0; font-size:12px; color:#cbd5e1;">Daily Income: <b style="color:#10b981;">+${rb.dailyReturn} TK</b></p>
                        <p style="margin:0; font-size:11px; color:#94a3b8;">Cycle: <b>${rb.daysPassed}/${rb.days} Days</b></p>
                    </div>
                    <button class="btn-claim-income" id="btn-claim-${child.key}" onclick="claimBotIncome('${child.key}')" style="width:auto; padding:6px 15px; font-size:12px; background:#10b981;">Claim</button>
                </div>
            `;
        });
    });
}

function claimBotIncome(key) {
    let btn = document.getElementById(`btn-claim-${key}`);
    btn.disabled = true;

    db.ref('users/' + userId + '/runningBots/' + key).once('value', snapshot => {
        let rb = snapshot.val();
        if(!rb) return;

        let now = new Date();
        let lastClaim = new Date(rb.lastClaimed);
        let diffHours = (now - lastClaim) / (1000 * 60 * 60);

        if(diffHours < 24) {
            let remainingHours = Math.ceil(24 - diffHours);
            alert(`You can claim income again in ${remainingHours} hours!`);
            btn.disabled = false;
            return;
        }

        let nextDaysPassed = (rb.daysPassed || 0) + 1;
        let currentWalletBalance = parseFloat(currentUser.balance) || 0;
        let updatedWalletBalance = parseFloat((currentWalletBalance + rb.dailyReturn).toFixed(2));

        if(nextDaysPassed >= parseInt(rb.days)) {
            db.ref('users/' + userId + '/balance').set(updatedWalletBalance);
            db.ref('users/' + userId + '/runningBots/' + key).remove();
            alert(`Bot runtime cycle complete! Total profit added to wallet.`);
        } else {
            db.ref('users/' + userId + '/balance').set(updatedWalletBalance);
            db.ref('users/' + userId + '/runningBots/' + key + '/lastClaimed').set(now.toISOString());
            db.ref('users/' + userId + '/runningBots/' + key + '/daysPassed').set(nextDaysPassed);
            alert(`Successfully claimed today's profit: +${rb.dailyReturn} TK`);
        }
        btn.disabled = false;
    });
}

function processReferralBonusOnReg(refCode) {
    db.ref('sysSettings/referralBonus').once('value', snap => {
        let bonusAmt = parseFloat(snap.val()) || 0;
        if(bonusAmt <= 0) return;

        db.ref('users').once('value', allUsers => {
            allUsers.forEach(child => {
                if(child.val().myOwnRefCode === refCode) {
                    // রেফারার যদি অলরেডি বট কিনে থাকে তবে ডাইরেক্ট ব্যালেন্স, নাহলে পেন্ডিং ওয়ালেটে ঢুকবে
                    if(child.val().hasBoughtBot === true) {
                        db.ref('users/' + child.key + '/balance').transaction(c => (parseFloat(c) || 0) + bonusAmt);
                        db.ref('users/' + child.key + '/refWalletSuccess').transaction(c => (parseFloat(c) || 0) + bonusAmt);
                    } else {
                        db.ref('users/' + child.key + '/refWalletPending').transaction(c => (parseFloat(c) || 0) + bonusAmt);
                    }
                }
            });
        });
    });
}

function distributeBotPurchaseCommissions(botPrice) {
    db.ref('sysSettings').once('value', snap => {
        let settings = snap.val() || {};
        let lvl1Rate = parseFloat(settings.lvl1Commission) || 0;
        let lvl2Rate = parseFloat(settings.lvl2Commission) || 0;

        if(currentUser.referredBy && currentUser.referredBy !== "none") {
            db.ref('users').once('value', allUsersSnap => {
                let uMap = allUsersSnap.val();
                let lvl1UserKey = null;
                let lvl2UserKey = null;

                for(let k in uMap) {
                    if(uMap[k].myOwnRefCode === currentUser.referredBy) lvl1UserKey = k;
                }

                if(lvl1UserKey) {
                    let lvl1Data = uMap[lvl1UserKey];
                    let oldBal1 = parseFloat(lvl1Data.balance) || 0;
                    db.ref('users/' + lvl1UserKey + '/balance').set(parseFloat((oldBal1 + lvl1Rate).toFixed(2)));

                    if(lvl1Data.referredBy && lvl1Data.referredBy !== "none") {
                        for(let k2 in uMap) {
                            if(uMap[k2].myOwnRefCode === lvl1Data.referredBy) lvl2UserKey = k2;
                        }
                        if(lvl2UserKey) {
                            let oldBal2 = parseFloat(uMap[lvl2UserKey].balance) || 0;
                            db.ref('users/' + lvl2UserKey + '/balance').set(parseFloat((oldBal2 + lvl2Rate).toFixed(2)));
                        }
                    }
                }
            });
        }
    });
}

// ==========================================
// ৭. USER TRANSACTION SYSTEM (DEPOSIT/WITHDRAW)
// ==========================================
function depositRequest() {
    let amt = parseFloat(document.getElementById('deposit-amount').value);
    let trx = document.getElementById('deposit-txid').value.trim();

    if(!amt || !trx || amt < 100) return alert("Minimum deposit is 100 TK. Please fill data accurately.");

    let depositNode = {
        username: currentUser.username,
        amount: amt,
        trxId: trx,
        status: "PENDING",
        timestamp: new Date().toISOString()
    };

    db.ref('deposits').push(depositNode).then(() => {
        db.ref('users/' + userId + '/depositHistory').push({ amount: amt, trxId: trx, status: "PENDING" });
        alert("Deposit submitted successfully! Waiting for admin review.");
        document.getElementById('deposit-amount').value = '';
        document.getElementById('deposit-txid').value = '';
    });
}

function withdrawRequest() {
    let amt = parseFloat(document.getElementById('withdraw-amount').value);
    let phone = document.getElementById('withdraw-phone').value.trim();

    if(!amt || !phone || amt < 500) return alert("Minimum withdraw is 500 TK.");
    if((parseFloat(currentUser.balance) - amt) < 50) return alert("You must leave at least 50 TK in your balance!");

    let netPay = parseFloat((amt * 0.98).toFixed(2)); // ২% চার্জ কর্তন

    let withdrawNode = {
        username: currentUser.username,
        amount: amt,
        netPay: netPay,
        phone: phone,
        status: "PENDING",
        timestamp: new Date().toISOString()
    };

    let finalBal = parseFloat((currentUser.balance - amt).toFixed(2));
    db.ref('users/' + userId + '/balance').set(finalBal);

    db.ref('withdraws').push(withdrawNode).then(() => {
        db.ref('users/' + userId + '/withdrawHistory').push({ amount: amt, netPay: netPay, status: "PENDING" });
        alert("Withdraw request sent successfully!");
        document.getElementById('withdraw-amount').value = '';
        document.getElementById('withdraw-phone').value = '';
    });
}

function loadUserHistory() {
    db.ref('users/' + userId + '/depositHistory').on('value', snap => {
        let body = document.getElementById('user-deposit-history');
        body.innerHTML = '';
        snap.forEach(c => {
            let d = c.val();
            let col = d.status === "APPROVED" ? "#10b981" : d.status === "REJECTED" ? "#ef4444" : "#f59e0b";
            body.innerHTML += `<tr><td>${d.amount}</td><td>${d.trxId}</td><td style="color:${col}; font-weight:bold;">${d.status}</td></tr>`;
        });
    });

    db.ref('users/' + userId + '/withdrawHistory').on('value', snap => {
        let body = document.getElementById('user-withdraw-history');
        body.innerHTML = '';
        snap.forEach(c => {
            let w = c.val();
            let col = w.status === "APPROVED" ? "#10b981" : w.status === "REJECTED" ? "#ef4444" : "#f59e0b";
            body.innerHTML += `<tr><td>${w.amount}</td><td>${w.netPay}</td><td style="color:${col}; font-weight:bold;">${w.status}</td></tr>`;
        });
    });
}

// ==========================================
// ৮. LEADERBOARD & LIVE POPUPS ENGINE
// ==========================================
function loadLeaderboard() {
    db.ref('users').once('value', snapshot => {
        let list = [];
        snapshot.forEach(child => {
            let u = child.val();
            if(u.username !== 'Admin') {
                list.push({ name: u.username, bal: parseFloat(u.balance) || 0 });
            }
        });

        list.sort((a, b) => b.bal - a.bal);
        let board = document.getElementById('leaderboardList');
        board.innerHTML = '';

        list.slice(0, 10).forEach((user, idx) => {
            let medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx+1}`;
            board.innerHTML += `
                <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.03); padding:12px; margin-bottom:6px; border-radius:8px;">
                    <span><b>${medal}</b> ${user.name}</span>
                    <span style="color:#2dd4bf; font-weight:bold;">${user.bal.toFixed(2)} TK</span>
                </div>
            `;
        });
    });
}

function startFakeTransactions() {
    const names = ["Abir", "Sabbir", "Mizan", "Rahat", "Tariq", "Sumon", "Arif", "Nayan", "Imran", "Sujon"];
    const amounts = [600, 1200, 2500, 5000, 800, 1500, 3200, 7500];
    
    if(fakeTxInterval) clearInterval(fakeTxInterval);
    
    fakeTxInterval = setInterval(() => {
        let list = document.getElementById('fake-transaction-list');
        if(!list) return;
        
        let rName = names[Math.floor(Math.random() * names.length)];
        let rAmt = amounts[Math.floor(Math.random() * amounts.length)];
        
        let div = document.createElement('div');
        div.style = "background:rgba(16,185,129,0.1); border-left:3px solid #10b981; padding:8px; margin-bottom:5px; border-radius:4px; font-size:11px; color:#fff;";
        div.innerHTML = `🎉 <b>${rName}***</b> successfully withdrew <b>${rAmt} TK</b> via bKash!`;
        
        list.prepend(div);
        if(list.children.length > 15) list.removeChild(list.lastChild);
    }, 12000); 
}

// ==========================================
// ৯. LIVE NOTIFICATION SYSTEM
// ==========================================
function startLiveTimerLoop() {
    if(liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(() => {
        // ব্যাকগ্রাউন্ড ঘড়ির টাইমার লুপ
    }, 60000);
}

function triggerNoticeModal() {
    db.ref('sysNotice').on('value', snap => {
        if(snap.exists() && snap.val() !== "") {
            document.getElementById('notice-text-content').innerText = snap.val();
            document.getElementById('notice-modal').classList.remove('hidden');
        }
    });
}

function closeNotice() {
    document.getElementById('notice-modal').classList.add('hidden');
}

// ==========================================
// 👑 ১০. CONTROL PANEL (ADMIN SYSTEM) ENGINE
// ==========================================
function switchAdminTab(tabId) {
    const tabs = ['dash', 'approvals', 'bots', 'users'];
    tabs.forEach(t => {
        document.getElementById('admin-tab-' + t).classList.add('hidden');
        document.getElementById('admin-btn-' + t).classList.remove('active-admin-btn');
    });
    document.getElementById('admin-tab-' + tabId).classList.remove('hidden');
    document.getElementById('admin-btn-' + tabId).classList.add('active-admin-btn');
}

function loadAdminData() {
    db.ref('users').on('value', snapshot => {
        let totalVol = 0;
        let uBody = document.getElementById('user-list-admin');
        uBody.innerHTML = '';

        snapshot.forEach(child => {
            let u = child.val();
            if(child.key !== 'admin' && u.username !== 'Admin') {
                totalVol += parseFloat(u.balance) || 0;
                let btnText = u.isBlocked === true ? "Unban" : "Ban";
                let btnCol = u.isBlocked === true ? "background:#10b981;" : "background:#ef4444;";
                
                uBody.innerHTML += `
                    <tr ondblclick="inspectUser('${child.key}')">
                        <td><b>${u.username}</b><br><small style="color:#94a3b8">${child.key}</small></td>
                        <td>${parseFloat(u.balance).toFixed(2)}</td>
                        <td><small>${u.deviceId || "TG-WEB"}</small></td>
                        <td><button style="padding:4px 8px; font-size:11px; border:none; border-radius:4px; color:#fff; ${btnCol}" onclick="toggleUserBan('${child.key}', ${u.isBlocked || false})">${btnText}</button></td>
                    </tr>
                `;
            }
        });
        document.getElementById('stat-total-balance').innerText = totalVol.toFixed(2);
        calculateNetCash();
    });

    // পেন্ডিং ডিপোজিট লিস্ট লোড
    db.ref('deposits').on('value', snap => {
        let body = document.getElementById('admin-deposit-list');
        body.innerHTML = '';
        snap.forEach(c => {
            let d = c.val();
            if(d.status === "PENDING") {
                body.innerHTML += `
                    <tr>
                        <td>${d.username}</td>
                        <td><b>${d.amount}</b></td>
                        <td><code>${d.trxId}</code></td>
                        <td>
                            <button style="background:#10b981; padding:4px 8px; border:none; color:#fff; border-radius:4px;" onclick="actionDeposit('${c.key}', 'APPROVE')">Approve</button>
                            <button style="background:#ef4444; padding:4px 8px; border:none; color:#fff; border-radius:4px;" onclick="actionDeposit('${c.key}', 'REJECT')">Reject</button>
                        </td>
                    </tr>
                `;
            }
        });
    });

    // পেন্ডিং উইথড্র লিস্ট লোড
    db.ref('withdraws').on('value', snap => {
        let body = document.getElementById('admin-withdraw-list');
        body.innerHTML = '';
        snap.forEach(c => {
            let w = c.val();
            if(w.status === "PENDING") {
                body.innerHTML += `
                    <tr>
                        <td>${w.username}</td>
                        <td>${w.amount}</td>
                        <td style="color:#10b981; font-weight:bold;">${w.netPay}</td>
                        <td><code>${w.phone}</code></td>
                        <td>
                            <button style="background:#10b981; padding:4px 8px; border:none; color:#fff; border-radius:4px;" onclick="actionWithdraw('${c.key}', 'APPROVE')">Approve</button>
                            <button style="background:#ef4444; padding:4px 8px; border:none; color:#fff; border-radius:4px;" onclick="actionWithdraw('${c.key}', 'REJECT')">Reject</button>
                        </td>
                    </tr>
                `;
            }
        });
    });

    db.ref('sysSettings').once('value', snap => {
        if(snap.exists()) {
            let s = snap.val();
            document.getElementById('admin-ref-commission-input').value = s.referralBonus || 0;
            document.getElementById('admin-lvl1-input').value = s.lvl1Commission || 0;
            document.getElementById('admin-lvl2-input').value = s.lvl2Commission || 0;
        }
    });

    loadAdminBotsList();
}

function calculateNetCash() {
    db.ref('sysStats').on('value', snap => {
        let data = snap.val() || { totalDeposited: 0, totalWithdrawn: 0 };
        document.getElementById('stat-total-deposited').innerText = parseFloat(data.totalDeposited || 0).toFixed(2);
        document.getElementById('stat-total-withdrawn').innerText = parseFloat(data.totalWithdrawn || 0).toFixed(2);
        
        let net = parseFloat(data.totalDeposited || 0) - parseFloat(data.totalWithdrawn || 0);
        document.getElementById('stat-admin-cash').innerText = net.toFixed(2);
    });
}

// ==========================================
// 🔐 ১১. ADMIN ACTION METHODS (SYSTEM EXECUTION)
// ==========================================
function actionDeposit(key, type) {
    db.ref('deposits/' + key).once('value', snap => {
        let dep = snap.val();
        if(!dep) return;

        if(type === 'APPROVE') {
            db.ref('deposits/' + key + '/status').set("APPROVED");
            
            db.ref('users').once('value', uSnap => {
                uSnap.forEach(uChild => {
                    if(uChild.val().username === dep.username) {
                        let oldB = parseFloat(uChild.val().balance) || 0;
                        db.ref('users/' + uChild.key + '/balance').set(parseFloat((oldB + dep.amount).toFixed(2)));
                        
                        db.ref('users/' + uChild.key + '/depositHistory').once('value', hSnap => {
                            hSnap.forEach(hChild => {
                                if(hChild.val().trxId === dep.trxId) db.ref('users/' + uChild.key + '/depositHistory/' + hChild.key + '/status').set("APPROVED");
                            });
                        });
                    }
                });
            });

            db.ref('sysStats/totalDeposited').transaction(c => (parseFloat(c) || 0) + dep.amount);
        } else {
            db.ref('deposits/' + key + '/status').set("REJECTED");
            db.ref('users').once('value', uSnap => {
                uSnap.forEach(uChild => {
                    if(uChild.val().username === dep.username) {
                        db.ref('users/' + uChild.key + '/depositHistory').once('value', hSnap => {
                            hSnap.forEach(hChild => {
                                if(hChild.val().trxId === dep.trxId) db.ref('users/' + uChild.key + '/depositHistory/' + hChild.key + '/status').set("REJECTED");
                            });
                        });
                    }
                });
            });
        }
        alert("Deposit request processed successfully!");
    });
}

function actionWithdraw(key, type) {
    db.ref('withdraws/' + key).once('value', snap => {
        let wit = snap.val();
        if(!wit) return;

        if(type === 'APPROVE') {
            db.ref('withdraws/' + key + '/status').set("APPROVED");
            db.ref('users').once('value', uSnap => {
                uSnap.forEach(uChild => {
                    if(uChild.val().username === wit.username) {
                        db.ref('users/' + uChild.key + '/withdrawHistory').once('value', hSnap => {
                            hSnap.forEach(hChild => {
                                if(hChild.val().amount === wit.amount && hChild.val().status === "PENDING") {
                                    db.ref('users/' + uChild.key + '/withdrawHistory/' + hChild.key + '/status').set("APPROVED");
                                }
                            });
                        });
                    }
                });
            });
            db.ref('sysStats/totalWithdrawn').transaction(c => (parseFloat(c) || 0) + wit.amount);
        } else {
            db.ref('withdraws/' + key + '/status').set("REJECTED");
            db.ref('users').once('value', uSnap => {
                uSnap.forEach(uChild => {
                    if(uChild.val().username === wit.username) {
                        let oldB = parseFloat(uChild.val().balance) || 0;
                        db.ref('users/' + uChild.key + '/balance').set(parseFloat((oldB + wit.amount).toFixed(2)));
                        
                        db.ref('users/' + uChild.key + '/withdrawHistory').once('value', hSnap => {
                            hSnap.forEach(hChild => {
                                if(hChild.val().amount === wit.amount && hChild.val().status === "PENDING") {
                                    db.ref('users/' + uChild.key + '/withdrawHistory/' + hChild.key + '/status').set("REJECTED");
                                }
                            });
                        });
                    }
                });
            });
        }
        alert("Withdraw request processed successfully!");
    });
}

function updateReferralCommission() {
    let val = parseFloat(document.getElementById('admin-ref-commission-input').value) || 0;
    db.ref('sysSettings/referralBonus').set(val).then(() => alert("Referral system configuration updated!"));
}

function updateBotCommissions() {
    let lvl1 = parseFloat(document.getElementById('admin-lvl1-input').value) || 0;
    let lvl2 = parseFloat(document.getElementById('admin-lvl2-input').value) || 0;

    db.ref('sysSettings/lvl1Commission').set(lvl1);
    db.ref('sysSettings/lvl2Commission').set(lvl2).then(() => alert("MLM bot level purchase commissions live!"));
}

function pushNotice() {
    let txt = document.getElementById('admin-notice-input').value.trim();
    db.ref('sysNotice').set(txt).then(() => {
        alert("Global live notification deployed!");
        document.getElementById('admin-notice-input').value = '';
    });
}

function createBot() {
    let name = document.getElementById('bot-name').value.trim();
    let price = parseFloat(document.getElementById('bot-price').value);
    let profit = parseFloat(document.getElementById('bot-profit').value);
    let days = parseInt(document.getElementById('bot-days').value);

    if(!name || !price || !profit || !days) return alert("Fill up all parameters perfectly.");

    let newBot = { name: name, price: price, profit: profit, days: days };
    db.ref('bots').push(newBot).then(() => {
        alert("New artificial matrix intelligence bot listed inside marketplace!");
        document.getElementById('bot-name').value = '';
        document.getElementById('bot-price').value = '';
        document.getElementById('bot-profit').value = '';
        document.getElementById('bot-days').value = '';
    });
}

function loadAdminBotsList() {
    db.ref('bots').on('value', snap => {
        let body = document.getElementById('admin-bots-list');
        body.innerHTML = '';
        snap.forEach(c => {
            let b = c.val();
            body.innerHTML += `<tr><td>${b.name}</td><td>${b.price}</td><td>${b.profit}</td><td>${b.days} Days</td></tr>`;
        });
    });
}

function toggleUserBan(targetUserId, currentStatus) {
    db.ref('users/' + targetUserId + '/isBlocked').set(!currentStatus).then(() => {
        alert(`User target status modification updated successfully.`);
    });
}

function inspectUser(targetUid) {
    document.getElementById('admin-user-search-input').value = targetUid;
    searchUserTransactionsAndStatus();
}

function searchUserTransactionsAndStatus() {
    let sUid = document.getElementById('admin-user-search-input').value.trim();
    let box = document.getElementById('admin-user-trx-box');
    let body = document.getElementById('admin-user-trx-history-body');

    if(!sUid) { box.classList.add('hidden'); return; }

    db.ref('users/' + sUid).once('value', snap => {
        if(!snap.exists()) { body.innerHTML = '<tr><td colspan="4">No matrix profile logs found</td></tr>'; box.classList.remove('hidden'); return; }
        
        body.innerHTML = '';
        let uData = snap.val();
        document.getElementById('search-trx-title').innerText = `Logs for: ${uData.username}`;

        if(uData.depositHistory) {
            for(let k in uData.depositHistory) {
                let d = uData.depositHistory[k];
                body.innerHTML += `<tr><td>Deposit</td><td>${d.amount}</td><td>${d.trxId}</td><td>${d.status}</td></tr>`;
            }
        }
        if(uData.withdrawHistory) {
            for(let k in uData.withdrawHistory) {
                let w = uData.withdrawHistory[k];
                body.innerHTML += `<tr><td>Withdraw</td><td>${w.amount}</td><td>${w.phone}</td><td>${w.status}</td></tr>`;
            }
        }
        box.classList.remove('hidden');
    });
}

// ==========================================
// ১২. LOGOUT & SHUTDOWN CONFIGURATION
// ==========================================
function logout() {
    if(currentUser && currentUser.username !== 'Admin') {
        db.ref('users/' + userId).off();
    }
    db.ref('sysNotice').off(); 
    if(liveInterval) clearInterval(liveInterval);
    if(fakeTxInterval) clearInterval(fakeTxInterval);
    if(leaderboardInterval) clearInterval(leaderboardInterval);
    
    currentUser = null;
    tg.close(); 
}
