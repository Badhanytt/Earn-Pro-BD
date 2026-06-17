import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, runTransaction, push, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let tg = window.Telegram.WebApp;
tg.expand(); 

let myTelegramId = tg.initDataUnsafe?.user?.id || 5977808817; 
let myUsername = tg.initDataUnsafe?.user?.username || "User_" + myTelegramId;

// ⚠️ ১. এখানে আপনার নিজের আসল টেলিগ্রাম আইডি দিন
const ADMIN_TELEGRAM_ID = 5977808817; 
const dbUserPath = ref(db, 'users/' + myTelegramId);

function initApp() {
    if(myTelegramId === ADMIN_TELEGRAM_ID) {
        document.getElementById('adminBadge').classList.remove('hidden');
        listenAdminTransactions();
        calculateAdminStats(); 
        loadAdminSettingsInPanel(); // এডমিন প্যানেলে কারেন্ট ডাটা লোড করা
    }

    // ইউজার প্রোফাইল ও রেজিস্ট্রেশন লজিক
    get(dbUserPath).then((snapshot) => {
        if(!snapshot.exists()) {
            let refBy = getUrlParam('startapp') || "none";
            
            get(ref(db, 'admin_settings/referral_bonus')).then((bonusSnap) => {
                let currentBonusAttr = bonusSnap.val() || 0; 

                set(dbUserPath, {
                    id: myTelegramId, username: myUsername, main_balance: 0, 
                    pending_balance: refBy !== "none" ? currentBonusAttr : 0, 
                    referred_by: refBy, status: "active", active_bot: null
                });

                if(refBy !== "none" && currentBonusAttr > 0) {
                    runTransaction(ref(db, `users/${refBy}/pending_balance`), (current) => (current || 0) + currentBonusAttr);
                }
            });
        } else if(snapshot.val().status === "blocked") {
            document.body.innerHTML = "<h1 style='color:red; text-align:center; margin-top:50px;'>You are BLOCKED by Admin!</h1>";
        }
    });

    // রিয়েলটাইম প্রোফাইল ডাটা আপডেট ও ২. আপনার সঠিক বটের লিংক সেটআপ
    onValue(dbUserPath, (snapshot) => {
        let data = snapshot.val();
        if(!data) return;
        document.getElementById('txtUsername').innerText = "👤 " + data.username;
        document.getElementById('lblMainBalance').innerText = data.main_balance;
        document.getElementById('lblPendingBalance').innerText = data.pending_balance;
        
        // আপনার বটের সঠিক লিংক ফরমেট
        document.getElementById('refLinkInput').value = "https://t.me/QuantumProBD_bot/earn?startapp=" + myTelegramId; 
        handleActiveBotLogic(data);
    });

    listenGlobalSettings(); // নোটিশ এবং অফিশিয়াল নাম্বার লাইভ শোনা
    listenUserHistory(); 
    loadLeaderboardAndFakeData();
    loadBotShop();
    setInterval(loadLeaderboardAndFakeData, 60000); 
}

// ==================== গ্লোবাল সেটিংস লজিক (Notice & Numbers) ====================

function listenGlobalSettings() {
    onValue(ref(db, 'admin_settings'), (snapshot) => {
        let settings = snapshot.val();
        if(!settings) return;
        
        // ইউজার প্যানেলে নোটিশ ও নাম্বার আপডেট করা
        if(settings.notice) document.getElementById('lblLiveNotice').innerText = settings.notice;
        if(settings.bkash) document.getElementById('dspBkashNum').innerText = settings.bkash;
        if(settings.nagad) document.getElementById('dspNagadNum').innerText = settings.nagad;
        if(settings.rocket) document.getElementById('dspRocketNum').innerText = settings.rocket;
        if(settings.referral_bonus) document.getElementById('admCurrentRefBonus').innerText = settings.referral_bonus;
    });
}

window.saveAdminSettings = function() {
    let notice = document.getElementById('admNoticeText').value;
    let bkash = document.getElementById('admBkashNum').value;
    let nagad = document.getElementById('admNagadNum').value;
    let rocket = document.getElementById('admRocketNum').value;

    let updates = {};
    if(notice) updates['admin_settings/notice'] = notice;
    if(bkash) updates['admin_settings/bkash'] = bkash;
    if(nagad) updates['admin_settings/nagad'] = nagad;
    if(rocket) updates['admin_settings/rocket'] = rocket;

    update(ref(db), updates).then(() => {
        showPopup("🎯 নোটিশ ও নাম্বার সফলভাবে আপডেট হয়েছে!");
    });
}

function loadAdminSettingsInPanel() {
    get(ref(db, 'admin_settings')).then((snap) => {
        let s = snap.val(); if(!s) return;
        if(s.notice) document.getElementById('admNoticeText').value = s.notice;
        if(s.bkash) document.getElementById('admBkashNum').value = s.bkash;
        if(s.nagad) document.getElementById('admNagadNum').value = s.nagad;
        if(s.rocket) document.getElementById('admRocketNum').value = s.rocket;
    });
}

window.setReferralBonusFromAdmin = function() {
    let bonusAmount = parseInt(document.getElementById('admRefBonusAmount').value);
    if(!bonusAmount || bonusAmount < 0) return alert("সঠিক পরিমাণ দিন!");
    set(ref(db, 'admin_settings/referral_bonus'), bonusAmount).then(() => {
        showPopup(`🎯 রেফার বোনাস ৳${bonusAmount} টাকা সেট করা হয়েছে!`);
        document.getElementById('admRefBonusAmount').value = '';
    });
}

// ==================== ডিপোজিট, উইথড্র ও লিমিটেশন সিকিউরিটি ====================

window.submitDeposit = function() {
    let amount = parseInt(document.getElementById('usrTxnAmount').value);
    let method = document.getElementById('usrTxnMethod').value;
    let number = document.getElementById('usrTxnNumber').value;

    if(!amount || amount <= 0 || !number) return alert("সঠিক তথ্য দিন!");

    get(ref(db, 'transactions')).then((snapshot) => {
        let txns = snapshot.val();
        for(let id in txns) {
            if(txns[id].userId === myTelegramId && txns[id].type === 'Deposit') {
                alert("⚠️ আপনার একটি ডিপোজিট রিকোয়েস্ট অলরেডি পেন্ডিং আছে!");
                return;
            }
        }

        push(ref(db, 'transactions'), {
            userId: myTelegramId, username: myUsername, type: 'Deposit', amount: amount, method: method, number: number
        });
        
        push(ref(db, `history/${myTelegramId}`), {
            type: 'Deposit', amount: amount, number: number, status: 'Pending', timestamp: Date.now()
        });

        showPopup("📥 ডিপোজিট রিকোয়েস্ট পাঠানো হয়েছে!");
        clearTxnFields();
    });
}

window.submitWithdraw = function() {
    let amount = parseInt(document.getElementById('usrTxnAmount').value);
    let method = document.getElementById('usrTxnMethod').value;
    let number = document.getElementById('usrTxnNumber').value;

    if(!amount || amount <= 0 || !number) return alert("সঠিক তথ্য দিন!");

    get(dbUserPath).then((snap) => {
        let u = snap.val();
        if(u.main_balance < amount) return alert("আপনার মেইন ব্যালেন্স পর্যাপ্ত নয়!");

        get(ref(db, 'transactions')).then((snapshot) => {
            let txns = snapshot.val();
            for(let id in txns) {
                if(txns[id].userId === myTelegramId && txns[id].type === 'Withdraw') {
                    alert("⚠️ আপনার একটি উইথড্র রিকোয়েস্ট অলরেডি পেন্ডিং আছে!");
                    return;
                }
            }

            let charge = Math.round(amount * 0.02);
            let finalPayout = amount - charge;

            runTransaction(ref(db, `users/${myTelegramId}/main_balance`), current => current - amount);

            let newTxnKey = push(ref(db, 'transactions')).key;
            set(ref(db, 'transactions/' + newTxnKey), {
                userId: myTelegramId, username: myUsername, type: 'Withdraw', amount: finalPayout, origAmount: amount, method: method, number: number, txnKey: newTxnKey
            });

            set(ref(db, `history/${myTelegramId}/${newTxnKey}`), {
                type: 'Withdraw', amount: amount, netPayout: finalPayout, number: number, status: 'Pending', timestamp: Date.now()
            });

            showPopup(`💸 উইথড্র সফল! ২% চার্জ (৳${charge}) কেটে ব্যালেন্স পেন্ডিং এ রাখা হয়েছে।`);
            clearTxnFields();
        });
    });
}

function listenUserHistory() {
    onValue(ref(db, `history/${myTelegramId}`), (snapshot) => {
        let tbody = document.getElementById('userHistoryTableBody'); tbody.innerHTML = "";
        let data = snapshot.val();
        if(!data) { tbody.innerHTML = "<tr><td colspan='4' style='text-align: center; color: #888;'>কোনো হিস্ট্রি নেই</td></tr>"; return; }

        let keys = Object.keys(data).reverse();
        keys.forEach(key => {
            let h = data[key];
            let color = h.status === 'Success' ? '#00ff87' : (h.status === 'Declined' ? '#ff0055' : 'orange');
            tbody.innerHTML += `<tr><td>${h.type}</td><td>৳${h.amount}</td><td>${h.number}</td><td style="color:${color}; font-weight:bold;">${h.status}</td></tr>`;
        });
    });
}

function clearTxnFields() { document.getElementById('usrTxnAmount').value = ''; document.getElementById('usrTxnNumber').value = ''; }

// ==================== এডমিন কন্ট্রোল ও ড্যাশবোর্ড ক্যালকুলেশন ====================

function listenAdminTransactions() {
    onValue(ref(db, 'transactions'), (snapshot) => {
        let tbody = document.getElementById('adminTxnTableBody'); tbody.innerHTML = "";
        let txns = snapshot.val();
        if(!txns) { tbody.innerHTML = "<tr><td colspan='6' style='text-align: center;'>কোনো রিকোয়েস্ট পেন্ডিং নেই</td></tr>"; return; }

        for(let id in txns) {
            let t = txns[id];
            let row = document.createElement('tr');
            row.innerHTML = `
                <td>${t.userId}</td>
                <td style="color:${t.type==='Deposit'?'#00ff87':'#ff0055'}">${t.type}</td>
                <td>৳${t.amount}</td>
                <td>${t.method}</td>
                <td>${t.number}</td>
                <td>
                    <button class="btn btn-success action-btn-sm" id="btn-acc-${id}">Accept</button>
                    <button class="btn btn-danger action-btn-sm" id="btn-dec-${id}">Decline</button>
                </td>
            `;
            tbody.appendChild(row);
            document.getElementById(`btn-acc-${id}`).onclick = () => handleTxnAction(id, t, 'accept');
            document.getElementById(`btn-dec-${id}`).onclick = () => handleTxnAction(id, t, 'decline');
        }
    });
}

function handleTxnAction(txnId, t, action) {
    if(action === 'accept') {
        if(t.type === 'Deposit') {
            runTransaction(ref(db, `users/${t.userId}/main_balance`), bal => (bal || 0) + t.amount);
            push(ref(db, 'stats/successful_deposits'), t.amount);
            
            get(ref(db, `history/${t.userId}`)).then(snap => {
                let hData = snap.val();
                for(let hKey in hData) {
                    if(hData[hKey].type === 'Deposit' && hData[hKey].status === 'Pending' && hData[hKey].amount === t.amount) {
                        update(ref(db, `history/${t.userId}/${hKey}`), { status: 'Success' }); break;
                    }
                }
            });
        } else {
            push(ref(db, 'stats/successful_withdrawals'), t.amount);
            update(ref(db, `history/${t.userId}/${t.txnKey}`), { status: 'Success' });
        }
        showPopup("Approved successfully!");
    } else {
        if(t.type === 'Withdraw') {
            runTransaction(ref(db, `users/${t.userId}/main_balance`), bal => (bal || 0) + t.origAmount);
            update(ref(db, `history/${t.userId}/${t.txnKey}`), { status: 'Declined' });
        } else {
            get(ref(db, `history/${t.userId}`)).then(snap => {
                let hData = snap.val();
                for(let hKey in hData) {
                    if(hData[hKey].type === 'Deposit' && hData[hKey].status === 'Pending' && hData[hKey].amount === t.amount) {
                        update(ref(db, `history/${t.userId}/${hKey}`), { status: 'Declined' }); break;
                    }
                }
            });
        }
        showPopup("Declined & Refunded!");
    }
    remove(ref(db, 'transactions/' + txnId));
}

function calculateAdminStats() {
    onValue(ref(db, 'users'), (snapshot) => {
        let users = snapshot.val(); let totalBal = 0;
        for(let id in users) { totalBal += (users[id].main_balance || 0); }
        document.getElementById('statTotalUserBal').innerText = totalBal;
    });
    onValue(ref(db, 'stats/successful_deposits'), (snapshot) => {
        let data = snapshot.val(); let totalDep = 0;
        for(let id in data) { totalDep += data[id]; }
        document.getElementById('statTotalDeposit').innerText = totalDep;
    });
    onValue(ref(db, 'stats/successful_withdrawals'), (snapshot) => {
        let data = snapshot.val(); let totalWith = 0;
        for(let id in data) { totalWith += data[id]; }
        document.getElementById('statTotalWithdraw').innerText = totalWith;
    });
}

// ==================== মাইনিং বট শপ ও ম্যাচিং লজিক ====================

let countdownInterval;
function handleActiveBotLogic(userData) {
    clearInterval(countdownInterval);
    let botArea = document.getElementById('botActiveArea');
    let noBot = document.getElementById('noBotActive');
    let claimBtn = document.getElementById('btnClaimProfit');

    if(!userData.active_bot) { botArea.classList.add('hidden'); noBot.classList.remove('hidden'); return; }

    noBot.classList.add('hidden'); botArea.classList.remove('hidden');
    let b = userData.active_bot;
    document.getElementById('actBotName').innerText = b.name + " (৳" + b.price + ")";

    countdownInterval = setInterval(() => {
        let now = Date.now();
        let distance = b.expiry_time - now;

        if (distance > 0) {
            let mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            let secs = Math.floor((distance % (1000 * 60)) / 1000);
            document.getElementById('actBotTimer').innerText = `${mins}m ${secs}s`;
            document.getElementById('actBotStatusMsg').innerText = "🤖 মাইনিং হচ্ছে, মেয়াদ শেষ হওয়া পর্যন্ত অপেক্ষা করুন...";
            claimBtn.classList.add('hidden');
        } else {
            clearInterval(countdownInterval);
            document.getElementById('actBotTimer').innerText = "মেয়াদ শেষ!";
            checkMatchingAndRefundLogic(b);
        }
    }, 1000);
}

function checkMatchingAndRefundLogic(activeBot) {
    get(ref(db, 'users')).then((snapshot) => {
        let allUsers = snapshot.val();
        let matchFound = false;

        for(let uid in allUsers) {
            if(uid != myTelegramId && allUsers[uid].active_bot && allUsers[uid].active_bot.price === activeBot.price) {
                matchFound = true; break;
            }
        }

        if(matchFound) {
            document.getElementById('actBotStatusMsg').innerText = "🎉 ম্যাচিং সফল! আপনার প্রফিট ক্লেম করুন।";
            document.getElementById('btnClaimProfit').classList.remove('hidden');
        } else {
            let extCount = activeBot.extensions || 0;
            if(extCount >= 3) {
                update(dbUserPath, { active_bot: null });
                runTransaction(ref(db, `users/${myTelegramId}/main_balance`), b => (b || 0) + activeBot.price);
                showPopup("❌ ম্যাচিং পাওয়া যায়নি। আপনার ইনভেস্ট করা ৳" + activeBot.price + " রিফান্ড করা হয়েছে!");
            } else {
                let newExpiry = Date.now() + (activeBot.duration * 60 * 1000); 
                update(ref(db, `users/${myTelegramId}/active_bot`), { expiry_time: newExpiry, extensions: extCount + 1 });
                showPopup(`⚠️ অন্য ইউজার না থাকায় মেয়াদ আরও ১ সাইকেল বাড়ল! (ট্রাই: ${extCount+1}/3)`);
            }
        }
    });
}

window.claimBotProfit = function() {
    get(dbUserPath).then((snap) => {
        let data = snap.val(); if(!data.active_bot) return;
        let profit = data.active_bot.profit;
        update(dbUserPath, { active_bot: null });
        runTransaction(ref(db, `users/${myTelegramId}/main_balance`), b => (b || 0) + profit);
        showPopup("🎉 ৳" + profit + " প্রফিট ব্যালেন্সে যুক্ত হয়েছে!");
    });
}

function loadBotShop() {
    onValue(ref(db, 'bots'), (snapshot) => {
        let shop = document.getElementById('botShopArea'); shop.innerHTML = "";
        let bots = snapshot.val(); if(!bots) { shop.innerHTML = "কোনো বট উপলব্ধ নেই।"; return; }
        for(let id in bots) {
            let b = bots[id];
            let botCard = document.createElement('div');
            botCard.style = "background:#111; padding:10px; border-radius:8px; margin-bottom:8px; border: 1px solid #222;";
            botCard.innerHTML = `<div class="flex"><div><b>${b.name}</b><br><small style="color: #aaa;">দাম: ৳${b.price} | লাভ: ৳${b.profit} | মেয়াদ: ${b.duration} দিন</small></div><button class="btn" style="width:80px;" id="btn-buy-${id}">কিনুন</button></div>`;
            shop.appendChild(botCard);
            document.getElementById(`btn-buy-${id}`).onclick = () => buyBot(id, b.price, b.profit, b.duration, b.name);
        }
    });
}

function buyBot(id, price, profit, duration, name) {
    get(dbUserPath).then((snap) => {
        let u = snap.val();
        if(u.main_balance < price) { alert("পর্যাপ্ত ব্যালেন্স নেই!"); return; }
        if(u.active_bot) { alert("অলরেডি একটি বট একটিভ আছে!"); return; }
        let expiry = Date.now() + (duration * 60 * 1000); 
        let updates = { main_balance: u.main_balance - price, active_bot: { name: name, price: price, profit: profit, duration: duration, expiry_time: expiry, extensions: 0 } };
        
        if(u.referred_by !== "none" && u.pending_balance > 0) {
            let refId = u.referred_by;
            let amountToTransfer = u.pending_balance;
            get(ref(db, 'users/' + refId)).then((rSnap) => {
                if(rSnap.exists()){
                    runTransaction(ref(db, `users/${refId}/pending_balance`), p => Math.max(0, (p || 0) - amountToTransfer));
                    runTransaction(ref(db, `users/${refId}/main_balance`), m => (m || 0) + amountToTransfer);
                }
            });
        }
        update(dbUserPath, updates); showPopup("🎉 বট কেনা সফল এবং মাইনিং শুরু হয়েছে!");
    });
}

// ==================== ফেক ডাটা জেনারেটর ও এডমিন সার্চ ====================

function loadLeaderboardAndFakeData() {
    let tbody = document.getElementById('leaderboardBody'); tbody.innerHTML = "";
    let fakeNames = ["Siam_Pro", "Nisha_Crypto", "Fahim_99", "Asif_Trader", "Bristy_Fx", "Alamin_Boss", "Mim_01", "Rony_Mining", "Sumon_Earn", "Tasnim_Khan"];
    let paymentGateways = ["Bkash", "Nagad", "Rocket"];
    for(let i=0; i<10; i++) {
        let randomName = fakeNames[Math.floor(Math.random() * fakeNames.length)] + "_" + Math.floor(Math.random()*900);
        let randomProfit = Math.floor(Math.random() * 4800) + 200;
        tbody.innerHTML += `<tr><td>${i+1}</td><td>${randomName}</td><td>৳${randomProfit}</td></tr>`;
    }
    let randomUser = fakeNames[Math.floor(Math.random() * fakeNames.length)];
    let randomAmount = Math.floor(Math.random() * 2000) + 150;
    let randomMethod = paymentGateways[Math.floor(Math.random() * paymentGateways.length)];
    showPopup(`🔔 ইউজার @${randomUser} এইমাত্র ৳${randomAmount} টাকা ${randomMethod}-এ উইথড্র পেয়েছেন!`);
}

window.addBotFromAdmin = function() {
    let name = document.getElementById('admBotName').value;
    let price = parseInt(document.getElementById('admBotPrice').value);
    let profit = parseInt(document.getElementById('admBotProfit').value);
    let duration = parseInt(document.getElementById('admBotDuration').value);
    if(!name || !price || !profit || !duration) return alert("সব তথ্য দিন!");
    push(ref(db, 'bots'), { name, price, profit, duration });
    showPopup("বট শপে যুক্ত হয়েছে!");
}

let searchedUserId = null;
window.searchUserAdmin = function() {
    let uid = document.getElementById('admSearchId').value;
    get(ref(db, 'users/' + uid)).then((snap) => {
        if(!snap.exists()) return alert("ইউজার পাওয়া যায়নি!");
        searchedUserId = uid; let u = snap.val();
        document.getElementById('admUserResult').classList.remove('hidden');
        document.getElementById('admUsrName').innerText = u.username;
        document.getElementById('admUsrBal').value = u.main_balance;
        document.getElementById('btnBlockAdmin').innerText = u.status === "blocked" ? "Unblock" : "Block";
    });
}

window.updateUserBalAdmin = function() {
    let val = parseInt(document.getElementById('admUsrBal').value);
    update(ref(db, 'users/' + searchedUserId), { main_balance: val });
    showPopup("ইউজার ব্যালেন্স আপডেট হয়েছে!");
}

window.toggleBlockUserAdmin = function() {
    let btn = document.getElementById('btnBlockAdmin');
    let newStatus = btn.innerText === "Block" ? "blocked" : "active";
    update(ref(db, 'users/' + searchedUserId), { status: newStatus });
    btn.innerText = newStatus === "blocked" ? "Unblock" : "Block";
    showPopup("ইউজার স্ট্যাটাস পরিবর্তিত!");
}

function showPopup(text) {
    let p = document.getElementById('popupNotification'); p.innerText = text; p.classList.remove('hidden');
    setTimeout(() => p.classList.add('show-popup'), 100);
    setTimeout(() => { p.classList.remove('show-popup'); setTimeout(() => p.classList.add('hidden'), 500); }, 4000);
}

// টেলিগ্রাম ডিরেক্ট লিংক ট্র্যাকিং মেথড (QuantumProBD_bot/earn)
function getUrlParam(name) { 
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
        if (window.Telegram.WebApp.initDataUnsafe.start_param) {
            return window.Telegram.WebApp.initDataUnsafe.start_param;
        }
    }
    return new URLSearchParams(window.location.search).get(name); 
}

initApp();
