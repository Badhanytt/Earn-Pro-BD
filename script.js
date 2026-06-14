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

document.addEventListener("DOMContentLoaded", () => {
    try { loadLeaderboard(); } catch(e) { console.log("Leaderboard bypass"); }
    checkAutoLoginSession(); 
    checkReferralLink(); 
});

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
            return alert("❌ সিকিউরিটি এরর: এক ডিভাইসে একাধিক অ্যাকাউন্ট তৈরি সম্পূর্ণ নিষিদ্ধ!");
        }
        db.ref('users/' + u).once('value', async snapshot => {
            if (snapshot.exists()) {
                document.getElementById('auth-spinner').classList.add('hidden');
                document.getElementById('auth-btn').disabled = false;
                return alert("User configuration already exists!");
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
        alert("🎉 রেফার লিংক কপি হয়েছে:\n" + codeInput.value);
    }).catch(() => {
        codeInput.select(); document.execCommand('copy'); alert("লিংক কপি হয়েছে!");
    });
}

function switchTab(tabName, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    if(element) element.classList.add('active');
    if(tabName === 'profile') loadProfileData();
    if(tabName === 'leaderboard') loadLeaderboard();
    if(tabName === 'home' && currentUser) syncUserData();
}

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
    db.ref('sysNotice').set(text).then(() => { alert("Notice updated!"); });
}

function startFakeTransactions() {
    const container = document.getElementById('fake-transaction-list');
    if(!container) return;
    const methods = ['bKash', 'Nagad'], prefixes = ['017', '019', '018', '016'], amounts = [550, 750, 1200, 2500, 5000];
    function createSingleFakeTx() {
        let m = methods[Math.floor(Math.random() * methods.length)], p = prefixes[Math.floor(Math.random() * prefixes.length)];
        let num = p + '******' + Math.floor(10 + Math.random() * 90), amt = amounts[Math.floor(Math.random() * amounts.length)];
        let txCardHtml = `<div class="fake-proof-card animate__animated animate__fadeInDown"><div class="left"><span class="method ${m === 'bKash'?'bkash-bg':'nagad-bg'}">${m}</span><span class="num">নম্বর: ${num}</span></div><div class="right"><span class="amt">+ ৳ ${amt}</span><span class="status">Success</span></div></div>`;
        container.insertAdjacentHTML('afterbegin', txCardHtml);
        if (container.children.length > 3) container.removeChild(container.lastChild);
    }
    clearInterval(fakeTxInterval); fakeTxInterval = setInterval(createSingleFakeTx, 4000);
}

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

function withdrawRequest() {
    let amtInput = document.getElementById('withdraw-amount'), phoneInput = document.getElementById('withdraw-phone');
    let amt = parseFloat(amtInput.value) || 0, phone = phoneInput.value.trim();
    if (amt < 500 || !phone) return alert("সঠিক অ্যামাউন্ট বা নাম্বার দিন।");
    if (amt > currentUser.balance || (currentUser.balance - amt) < 50) return alert("পর্যাপ্ত ব্যালেন্স নেই।");

    db.ref('withdraws').once('value', snapshot => {
        let hasPending = false;
        snapshot.forEach(c => { if(c.val().username === currentUser.username && c.val().status === "pending") hasPending = true; });
        if (hasPending) return alert("আগের রিকোয়েস্ট পেন্ডিং আছে।");

        let fee = parseFloat((amt * 0.02).toFixed(2)), net = parseFloat((amt - fee).toFixed(2)), updatedBal = parseFloat((currentUser.balance - amt).toFixed(2));
        db.ref('users/' + currentUser.username + '/balance').set(updatedBal).then(() => {
            let wId = Date.now();
            db.ref('withdraws/' + wId).set({ id: wId, username: currentUser.username, reqAmount: amt, netPayable: net, phone: phone, method: 'bKash', status: 'pending' })
            .then(() => { alert("উইথড্র সাবমিট হয়েছে!"); amtInput.value = ''; phoneInput.value = ''; loadProfileData(); });
        });
    });
}

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

function renderMarketBots() {
    db.ref('bots').once('value', snapshot => {
        let market = document.getElementById('bot-market'); if(!market) return; market.innerHTML = '';
        snapshot.forEach(child => {
            let bot = child.val();
            market.innerHTML += `<div class="bot-card"><h4>🤖 ${bot.name}</h4><p>Price: ${bot.price} TK | Profit: +${bot.profit} TK</p><button onclick="buyBot('${child.key}')">Purchase Bot</button></div>`;
        });
    });
}

function buyBot(botKey) {
    db.ref('bots/' + botKey).once('value', snapshot => {
        let bot = snapshot.val();
        if (currentUser.balance < bot.price) return alert("পর্যাপ্ত ব্যালেন্স নেই।");
        let newBal = parseFloat((currentUser.balance - bot.price).toFixed(2));
        db.ref('users/' + currentUser.username + '/balance').set(newBal).then(() => {
            let pId = Date.now(), endTime = Date.now() + (bot.days * 24 * 60 * 60 * 1000);
            db.ref('globalPurchases/' + pId).set({ id: pId, username: currentUser.username, botName: bot.name, price: bot.price, profitAmount: bot.profit, endTime: endTime, status: "running" })
            .then(() => { alert("বট অ্যাক্টিভ হয়েছে!"); });
        });
    });
}

function startLiveTimerLoop() { liveInterval = setInterval(() => { if(currentUser && currentUser.username !== 'admin') triggerCloudBotsEvaluation(); }, 1000); }

function triggerCloudBotsEvaluation() {
    db.ref('globalPurchases').once('value', snapshot => {
        let container = document.getElementById('my-bots'); if(!container) return; container.innerHTML = '';
        snapshot.forEach(child => {
            let p = child.val(); if(p.username !== currentUser.username) return;
            let timeLeft = p.endTime - Date.now();
            if (p.status === "running" && timeLeft <= 0) db.ref('globalPurchases/' + child.key + '/status').set("claimable");
            container.innerHTML += `<div class="bot-card"><h5>${p.botName}</h5><p>Status: ${p.status}</p></div>`;
        });
    });
}

function loadLeaderboard() {
    let listContainer = document.getElementById('leaderboardList');
    if (!listContainer) return;

    // ২৫ জনের ফুল প্রফেশনাল ডেটা পুল
    const allUsersPool = [
        { name: "Md. Rafiqul Islam", phone: "01734******", baseEarn: 5420, baseRef: 48, tag: 'キング মেম্বার' },
        { name: "Al Amin Hossain", phone: "01952******", baseEarn: 4850, baseRef: 35, tag: 'প্রো elite' },
        { name: "Sumaiya Akter", phone: "01811******", baseEarn: 4120, baseRef: 29, tag: 'এলিট মেম্বার' },
        { name: "Tariqul Islam", phone: "01721******", baseEarn: 3950, baseRef: 26, tag: 'গোল্ড মেম্বার' },
        { name: "Nayeem Ahmed", phone: "01685******", baseEarn: 3820, baseRef: 24, tag: 'গোল্ড মেম্বার' },
        { name: "Farhana Yeasmin", phone: "01511******", baseEarn: 3710, baseRef: 22, tag: 'গোল্ড মেম্বার' },
        { name: "Sajid Khan", phone: "01302******", baseEarn: 3650, baseRef: 21, tag: 'প্লাটিনাম মেম্বার' },
        { name: "Arifur Rahman", phone: "01404******", baseEarn: 3420, baseRef: 19, tag: 'প্লাটিনাম মেম্বার' },
        { name: "Mst. Rokeya Begum", phone: "01988******", baseEarn: 3200, baseRef: 18, tag: 'প্লাটিনাম মেম্বার' },
        { name: "Jahid Hasan", phone: "01755******", baseEarn: 3110, baseRef: 16, tag: 'প্লাটিনাম মেম্বার' },
        { name: "Sabbir Hossain", phone: "01822******", baseEarn: 2950, baseRef: 15, tag: 'সিলভার মেম্বার' },
        { name: "Anika Tabassum", phone: "01633******", baseEarn: 2840, baseRef: 13, tag: 'সিলভার মেম্বার' },
        { name: "Roni Mia", phone: "01522******", baseEarn: 2710, baseRef: 12, tag: 'সিলভার মেম্বার' },
        { name: "Abir Hasan", phone: "01799******", baseEarn: 2600, baseRef: 11, tag: 'সিলভার মেম্বার' },
        { name: "Nusrat Jahan", phone: "01911******", baseEarn: 2450, baseRef: 10, tag: 'সিলভার মেম্বার' },
        { name: "Md. Shakil", phone: "01315******", baseEarn: 2320, baseRef: 9, tag: 'মেম্বার' },
        { name: "Mehedi Hasan", phone: "01416******", baseEarn: 2200, baseRef: 8, tag: 'মেম্বার' },
        { name: "Tamanna Akter", phone: "01855******", baseEarn: 2110, baseRef: 8, tag: 'মেম্বার' },
        { name: "Asif Iqbal", phone: "01766******", baseEarn: 1980, baseRef: 7, tag: 'মেম্বার' },
        { name: "Riyad Ahmed", phone: "01933******", baseEarn: 1850, baseRef: 6, tag: 'মেম্বার' },
        { name: "Sadia Afrin", phone: "01566******", baseEarn: 1720, baseRef: 5, tag: 'মেম্বার' },
        { name: "Imran Khan", phone: "01622******", baseEarn: 1600, baseRef: 5, tag: 'মেম্বার' },
        { name: "Liza Akter", phone: "01344******", baseEarn: 1450, baseRef: 4, tag: 'মেম্বার' },
        { name: "Hasan Ali", phone: "01712******", baseEarn: 1300, baseRef: 4, tag: 'মেম্বার' },
        { name: "Rubel Hossain", phone: "01944******", baseEarn: 1150, baseRef: 3, tag: 'মেম্বার' }
    ];

    function renderRandomTopTen() {
        let shuffled = allUsersPool.sort(() => 0.5 - Math.random());
        let selectedTen = shuffled.slice(0, 10);
        selectedTen.sort((a, b) => b.baseEarn - a.baseEarn);
        listContainer.innerHTML = ''; 
        
        selectedTen.forEach((u, index) => {
            let rank = index + 1;
            let rankClass = '';
            let rankIconOrNum = rank;

            if (rank === 1) {
                rankClass = 'rank-1'; 
                rankIconOrNum = '<i class="fas fa-crown animate__animated animate__pulse animate__infinite"></i>';
            } else if (rank === 2) { rankClass = 'rank-2'; } 
              else if (rank === 3) { rankClass = 'rank-3'; }

            listContainer.innerHTML += `
                <div class="leaderboard-row ${rankClass} animate__animated animate__fadeInRight" style="animation-duration: 0.4s;">
                    <div class="rank-info">
                        <div class="rank-number">${rankIconOrNum}</div>
                        <div class="user-details">
                            <span class="user-name">${u.name}</span>
                            <span class="user-phone">${u.phone} <span style="color: #64748b; font-size: 9px; font-weight:normal;">(${u.tag})</span></span>
                        </div>
                    </div>
                    <div class="earn-info">
                        <span class="earn-amount">৳ ${u.baseEarn.toLocaleString('bn-BD')}.০০</span>
                        <div class="ref-count">রেফার: ${u.baseRef} জন</div>
                    </div>
                </div>`;
        });
    }

    renderRandomTopTen();
    if(leaderboardInterval) clearInterval(leaderboardInterval);
    leaderboardInterval = setInterval(renderRandomTopTen, 10000);
}


function loadAdminData() {
    db.ref('users').once('value', snap => {
        let body = document.getElementById('user-list-admin'); if(body) body.innerHTML = '';
        snap.forEach(c => { if(body) body.innerHTML += `<tr><td>${c.key}</td><td>${c.val().balance} TK</td></tr>`; });
    });
    db.ref('deposits').once('value', snap => {
        let body = document.getElementById('admin-deposit-list'); if(body) body.innerHTML = '';
        snap.forEach(c => {
            if(c.val().status === 'pending' && body) {
                body.innerHTML += `<tr><td>${c.val().username}</td><td>${c.val().amount} TK</td><td><button onclick="manageDeposit('${c.key}', 'accept')">Approve</button></td></tr>`;
            }
        });
    });
}

function calculateAdminNetCash() {}

function manageDeposit(depKey, action) {
    db.ref('deposits/' + depKey).once('value', snapshot => {
        let req = snapshot.val();
        if(req) {
            let statusValue = action === 'accept' ? 'accepted' : 'rejected';
            db.ref('deposits/' + depKey + '/status').set(statusValue).then(() => {
                if(action === 'accept') {
                    db.ref('users/' + req.username + '/balance').once('value', balSnap => {
                        let finalBal = parseFloat(((balSnap.val() || 0) + req.amount).toFixed(2));
                        db.ref('users/' + req.username + '/balance').set(finalBal).then(() => { alert("অ্যাপ্রুভ হয়েছে!"); loadAdminData(); });
                    });
                } else { alert("রিজেক্ট হয়েছে।"); loadAdminData(); }
            });
        }
    });
}

function manageWithdraw(witKey, action) {
    db.ref('withdraws/' + witKey).once('value', snapshot => {
        let req = snapshot.val();
        if(req) {
            let statusValue = action === 'accept' ? 'accepted' : 'rejected';
            db.ref('withdraws/' + witKey + '/status').set(statusValue).then(() => {
                if(action === 'reject') {
                    db.ref('users/' + req.username + '/balance').once('value', balSnap => {
                        let finalBal = parseFloat(((balSnap.val() || 0) + req.reqAmount).toFixed(2));
                        db.ref('users/' + req.username + '/balance').set(finalBal).then(() => { alert("উইথড্র রিজেক্ট ও ব্যাক দেওয়া হয়েছে।"); loadAdminData(); });
                    });
                } else { alert("উইথড্র সেন্ট!"); loadAdminData(); }
            });
        }
    });
}
