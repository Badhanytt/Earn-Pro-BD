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

// SECURITY CONFIG
const ADMIN_USER = "admin";
const ADMIN_PASS = "BDN2026YT";

// HARDCODED LIVE DOMAIN (আপনার আসল ওয়েবসাইট লিংক)
const LIVE_WEBSITE_URL = "https://bdearnpro.github.io/EARNPRO/";

// Document Ready Auto Hooks
document.addEventListener("DOMContentLoaded", () => {
    loadLeaderboard();
    checkAutoLoginSession(); 
    checkReferralLink(); // লিংক থেকে রেফার কোড চেক করার জন্য
});

// লিংকের মাধ্যমে কোনো রেফার কোড এসেছে কিনা তা চেক করার ফাংশন
function checkReferralLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const refCodeFromUrl = urlParams.get('ref'); // URL থেকে ?ref=CODE অংশটি নেবে

    if (refCodeFromUrl) {
        // ইউজারকে সরাসরি রেজিস্টার ট্যাবে নিয়ে যাবে
        switchAuth('register');
        
        // ইনপুট বক্সে কোডটি অটোমেটিক বসিয়ে দেবে এবং ক্যাপিটাল লেটার করবে
        const refInput = document.getElementById('ref-code-input');
        if (refInput) {
            refInput.value = refCodeFromUrl.toUpperCase();
            // ইউজার যাতে ভুল করে কোড কেটে না ফেলে তাই বক্সটি রিড-অনলি করে দেওয়া হলো
            refInput.readOnly = true; 
            refInput.style.borderColor = "#2dd4bf";
        }
    }
}

// অটো-লগইন সেশন ট্র্যাকার ফাংশন
function checkAutoLoginSession() {
    let savedUser = localStorage.getItem("quantum_user");
    let savedPass = localStorage.getItem("quantum_pass");

    if (savedUser && savedPass) {
        if (savedUser === ADMIN_USER && savedPass === ADMIN_PASS) {
            currentUser = { username: 'admin', role: 'admin' };
            document.getElementById('auth-page').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            switchAdminTab('dash');
            return;
        }

        db.ref('users/' + savedUser).once('value', snapshot => {
            let user = snapshot.val();
            if (user && user.password === savedPass) {
                currentUser = user;
                document.getElementById('auth-page').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                switchTab('home', document.querySelector('.bottom-nav .nav-item'));
                
                syncUserData();
                startLiveTimerLoop();
                triggerNoticeModal();
                startFakeTransactions();
            } else {
                localStorage.clear();
            }
        });
    }
}

// লগইন এবং রেজিস্টার ট্যাব সুইচ মেকানিজম (কোড বক্স হ্যান্ডলিং সহ)
function switchAuth(mode) {
    currentAuthMode = mode;
    document.getElementById('auth-btn-text').innerText = mode === 'login' ? 'Login' : 'Register';
    document.getElementById('tab-login-btn').className = mode === 'login' ? 'active-tab-btn' : '';
    document.getElementById('tab-reg-btn').className = mode === 'register' ? 'active-tab-btn' : '';
    
    // রেজিস্টার ট্যাবে থাকলে রেফার কোড ইনপুট বক্সটি দেখাবে, লগইনে লুকাবে
    if(mode === 'register') {
        document.getElementById('ref-field-container').classList.remove('hidden');
    } else {
        document.getElementById('ref-field-container').classList.add('hidden');
    }
}

// সিকিউর ডিভাইস রেজিস্ট্রি এবং কোড ভিত্তিক রেজিষ্ট্রেশন
function handleAuth() {
    let u = document.getElementById('username').value.trim();
    let p = document.getElementById('password').value.trim();
    let enteredRefCode = document.getElementById('ref-code-input').value.trim().toUpperCase();

    if(!u || !p) return alert("Please enter all credentials");

    // লোডিং স্পিকার চালু
    document.getElementById('auth-spinner').classList.remove('hidden');
    document.getElementById('auth-btn').disabled = true;

    // অ্যাডমিন ড্যাশবোর্ড বাইপাস
    if (u === ADMIN_USER && p === ADMIN_PASS) {
        localStorage.setItem("quantum_user", ADMIN_USER);
        localStorage.setItem("quantum_pass", ADMIN_PASS);
        currentUser = { username: 'admin', role: 'admin' };
        document.getElementById('auth-spinner').classList.add('hidden');
        document.getElementById('auth-btn').disabled = false;
        document.getElementById('auth-page').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        switchAdminTab('dash'); 
        return;
    }

    if (currentAuthMode === 'register') {
        // অ্যান্টি-মাল্টি অ্যাকাউন্ট সিকিউরিটি চেক
        if(localStorage.getItem('device_locked_account')) {
            document.getElementById('auth-spinner').classList.add('hidden');
            document.getElementById('auth-btn').disabled = false;
            return alert("❌ সিকিউরিটি এরর: এক ডিভাইসে একাধিক অ্যাকাউন্ট তৈরি করা সম্পূর্ণ নিষিদ্ধ!");
        }

        db.ref('users/' + u).once('value', async snapshot => {
            if (snapshot.exists()) {
                document.getElementById('auth-spinner').classList.add('hidden');
                document.getElementById('auth-btn').disabled = false;
                return alert("User configuration already exists!");
            }
            
            let finalReferrerUsername = "none";

            // যদি ইউজার বক্সে কোনো রেফার কোড বসায়
            if(enteredRefCode !== "") {
                let foundReferrer = await findUserByReferCode(enteredRefCode);
                if(!foundReferrer) {
                    document.getElementById('auth-spinner').classList.add('hidden');
                    document.getElementById('auth-btn').disabled = false;
                    return alert("❌ ভুল রেফার কোড! দয়া করে সঠিক কোড দিন অথবা বক্সটি খালি রাখুন।");
                }
                finalReferrerUsername = foundReferrer;
            }

            // প্রতিটা ইউজারের জন্য ৪ ডিজিটের র্যান্ডম সংখ্যা দিয়ে পার্মানেন্ট কোড জেনারেট
            let randomDigits = Math.floor(1000 + Math.random() * 9000);
            let myNewPermanentRefCode = (u.substring(0,4) + randomDigits).toUpperCase();

            let newUserObject = { 
                username: u, 
                password: p, 
                balance: 0,
                myOwnRefCode: myNewPermanentRefCode, // স্থায়ী নিজস্ব কোড
                referredBy: finalReferrerUsername,   // কার মাধ্যমে রেফারেড হলো
                refWalletPending: 0,
                refWalletSuccess: 0,
                hasBoughtBot: false 
            };

            db.ref('users/' + u).set(newUserObject)
            .then(() => {
                localStorage.setItem('device_locked_account', u);

                if(finalReferrerUsername !== "none") {
                    processReferralSetup(finalReferrerUsername, u);
                } else {
                    completeRegistrationFlow();
                }
            });
        });
    } else {
        // লগইন লজিক
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
            
            syncUserData();
            startLiveTimerLoop();
            triggerNoticeModal();
            startFakeTransactions();
        });
    }
}

// ডাটাবেজ থেকে ইনপুট দেওয়া রেফার কোডটির আসল মালিক খুঁজে বের করার হেল্পার ফাংশন
function findUserByReferCode(code) {
    return new Promise((resolve) => {
        db.ref('users').once('value', snapshot => {
            let foundUser = null;
            snapshot.forEach(child => {
                let userData = child.val();
                if(userData.myOwnRefCode === code) {
                    foundUser = child.key;
                }
            });
            resolve(foundUser);
        });
    });
}

// রেজিষ্ট্রেশন কম্পপ্লিট ও লগইনে ট্রান্সফার
function completeRegistrationFlow() {
    document.getElementById('auth-spinner').classList.add('hidden');
    document.getElementById('auth-btn').disabled = false;
    // ইনপুট বক্স রিসেট
    const refInput = document.getElementById('ref-code-input');
    if (refInput) {
        refInput.value = '';
        refInput.readOnly = false; 
    }
    alert("Registration Successful!");
    switchAuth('login');
    window.history.replaceState({}, document.title, window.location.pathname);
}

// অ্যাডমিন কন্ট্রোলড রেফার বোনাস ডিস্ট্রিবিউশন
function processReferralSetup(referrerUsername, newUserName) {
    db.ref('sysSettings/referralBonus').once('value', snapshot => {
        let bonusAmount = parseFloat(snapshot.val()) || 0;
        
        if(bonusAmount > 0) {
            db.ref('users/' + referrerUsername).once('value', refSnap => {
                if(refSnap.exists()){
                    let refUserData = refSnap.val();
                    let currentPending = parseFloat(refUserData.refWalletPending || 0);
                    let newPending = parseFloat((currentPending + bonusAmount).toFixed(2));
                    
                    db.ref('users/' + referrerUsername + '/refWalletPending').set(newPending).then(() => {
                        completeRegistrationFlow();
                    });
                } else {
                    completeRegistrationFlow();
                }
            });
        } else {
            completeRegistrationFlow();
        }
    });
}

// লাইভ সিঙ্ক স্টেপ আপগ্রেড
function syncUserData() {
    if(!currentUser || currentUser.username === 'admin') return;
    
    db.ref('users/' + currentUser.username).on('value', snapshot => {
        let updatedUser = snapshot.val();
        if(updatedUser) {
            currentUser = updatedUser; // গ্লোবাল স্টেট আপডেট
            
            // ব্যালেন্স ও নাম আপডেট
            if(document.getElementById('user-balance')) document.getElementById('user-balance').innerText = currentUser.balance;
            if(document.getElementById('user-display-name')) document.getElementById('user-display-name').innerText = currentUser.username;
            
            // প্রোফাইল পেজের ডেটা রেন্ডার (যদি প্রোফাইল পেজ এলিমেন্টগুলো উপস্থিত থাকে)
            if(document.getElementById('user-ref-pending')) {
                document.getElementById('user-ref-pending').innerText = currentUser.refWalletPending || 0;
            }
            if(document.getElementById('user-ref-success')) {
                document.getElementById('user-ref-success').innerText = currentUser.refWalletSuccess || 0;
            }
            
            // ইউনিক রেফারেল কোড/লিংক জেনারেটর ফিক্স (এখানে আপনার লাইভ ডোমেন সেট করা হয়েছে)
            let permanentRefInput = document.getElementById('permanent-ref-code');
            if(permanentRefInput) {
                if (currentUser.myOwnRefCode) {
                    permanentRefInput.value = `${LIVE_WEBSITE_URL}?ref=${currentUser.myOwnRefCode}`;
                } else {
                    permanentRefInput.value = "N/A";
                }
            }

            renderMarketBots();
            renderMyBots();
        }
    });
}

// পার্মানেন্ট কোড এবং "রেফার লিংক" কপি করার ফাংশন (আপডেটেড ও বাগ-ফ্রি)
function copyRefCode() {
    let codeInput = document.getElementById("permanent-ref-code");
    if(!codeInput || codeInput.value === "N/A" || codeInput.value === "") {
        return alert("কোড এখনো লোড হয়নি! অনুগ্রহ করে ১ সেকেন্ড অপেক্ষা করুন।");
    }
    
    let fullReferralLink = codeInput.value;

    // ক্লিপবোর্ডে ফুল লিংকটি কপি করা হচ্ছে
    navigator.clipboard.writeText(fullReferralLink).then(() => {
        alert("🎉 আপনার ইউনিক রেফার লিংক সফলভাবে কপি হয়েছে:\n" + fullReferralLink);
    }).catch(err => {
        console.error("Copy failed", err);
        // ব্যাকআপ হিসেবে ইনপুট সিলেক্ট করে কপি করার ব্যবস্থা
        codeInput.select();
        document.execCommand('copy');
        alert("আপনার রেফার লিংকটি কপি হয়েছে!");
    });
}

function switchTab(tabName, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    if(element) element.classList.add('active');

    if(tabName === 'profile') {
        loadProfileData();
        // প্রোফাইল ট্যাবে যাওয়ার সাথে সাথে যাতে কোড জেনারেট নিশ্চিত হয়
        if(currentUser && currentUser.username !== 'admin') {
            let permanentRefInput = document.getElementById('permanent-ref-code');
            if(permanentRefInput && currentUser.myOwnRefCode) {
                permanentRefInput.value = `${LIVE_WEBSITE_URL}?ref=${currentUser.myOwnRefCode}`;
            }
        }
    }
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
    if(viewType === 'deposit') {
        depSec.classList.remove('hidden'); witSec.classList.add('hidden');
    } else {
        witSec.classList.remove('hidden'); depSec.classList.add('hidden');
    }
}

function logout() {
    if(currentUser && currentUser.username !== 'admin') {
        db.ref('users/' + currentUser.username).off();
    }
    clearInterval(liveInterval);
    clearInterval(fakeTxInterval);
    clearInterval(leaderboardInterval);
    currentUser = null;
    localStorage.removeItem("quantum_user");
    localStorage.removeItem("quantum_pass");
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}


// --- CLOUD SYSTEM POPUP NOTICE ---
function triggerNoticeModal() {
    db.ref('sysNotice').on('value', snapshot => {
        let currentNotice = snapshot.val();
        if(currentNotice) {
            document.getElementById('notice-text-content').innerText = currentNotice;
            document.getElementById('notice-modal').classList.remove('hidden');
        }
    });
}
function closeNotice() { document.getElementById('notice-modal').classList.add('hidden'); }
function pushNotice() {
    let text = document.getElementById('admin-notice-input').value.trim();
    if(!text) return alert("Notice cannot be empty");
    db.ref('sysNotice').set(text).then(() => {
        alert("System Public Notice updated!");
        document.getElementById('admin-notice-input').value = '';
    });
}

// --- FAKE TRANSACTION MATRIX ENGINE ---
function startFakeTransactions() {
    const container = document.getElementById('fake-transaction-list');
    if(!container) return;
    container.innerHTML = '';

    const methods = ['bKash', 'Nagad'];
    const prefixes = ['017', '019', '018', '015', '016', '013', '014'];
    const amounts = [550, 620, 750, 880, 1200, 1500, 2000, 2500, 3200, 4500, 5000];
    
    function generateRandomTrxID() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 10; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }

    function createSingleFakeTx() {
        const randomMethod = methods[Math.floor(Math.random() * methods.length)];
        const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const randomNumber = randomPrefix + '******' + Math.floor(10 + Math.random() * 90);
        const randomAmount = amounts[Math.floor(Math.random() * amounts.length)];
        const randomTrx = randomMethod.substring(0,2).toUpperCase() + generateRandomTrxID().substring(2);
        const methodClass = randomMethod === 'bKash' ? 'bkash-bg' : 'nagad-bg';

        const txCardHtml = `
            <div class="fake-proof-card animate__animated animate__fadeInDown">
                <div class="left">
                    <span class="method ${methodClass}">${randomMethod}</span>
                    <span class="num">নম্বর: ${randomNumber}</span>
                    <span class="trx">TrxID: ${randomTrx}</span>
                </div>
                <div class="right">
                    <span class="amt">+ ৳ ${randomAmount}</span>
                    <span class="status">Success</span>
                    <span class="time">Just Now</span>
                </div>
            </div>
        `;
        if(container) {
            container.insertAdjacentHTML('afterbegin', txCardHtml);
            if (container.children.length > 3) container.removeChild(container.lastChild);
        }
    }
    createSingleFakeTx();
    setTimeout(createSingleFakeTx, 1500);
    clearInterval(fakeTxInterval);
    fakeTxInterval = setInterval(createSingleFakeTx, 4000);
}

// --- CLOUD DEPOSIT & WITHDRAW MATRIX ---
function depositRequest() {
    let amt = parseFloat(document.getElementById('deposit-amount').value);
    let txid = document.getElementById('deposit-txid').value.trim();

    if (!amt || amt < 100) return alert("Minimum deposit amount is 100 TK");
    if (!txid) return alert("Please enter bKash TrxID");

    let depId = Date.now();
    db.ref('deposits/' + depId).set({
        id: depId, username: currentUser.username, amount: amt, txid: txid, status: 'pending'
    }).then(() => {
        alert("bKash Deposit submitted! View status below in history.");
        document.getElementById('deposit-amount').value = '';
        document.getElementById('deposit-txid').value = '';
        loadProfileData();
    });
}

function withdrawRequest() {
    let amt = parseFloat(document.getElementById('withdraw-amount').value);
    let phone = document.getElementById('withdraw-phone').value.trim();

    if (!amt || amt < 500) return alert("সর্বনিম্ন উইথড্র ৫০০ টাকা!");
    if (!phone) return alert("বিকাশ পার্সোনাল নাম্বার দিন!");
    
    if ((currentUser.balance - amt) < 50) return alert("অ্যাকাউন্টে সর্বদা কমপক্ষে ৫০ টাকা ব্যালেন্স থাকতে হবে!");

    let fee = parseFloat((amt * 0.02).toFixed(2));
    let netPayable = parseFloat((amt - fee).toFixed(2));
    let updatedBal = parseFloat((currentUser.balance - amt).toFixed(2));
    
    db.ref('users/' + currentUser.username + '/balance').set(updatedBal).then(() => {
        let witId = Date.now();
        db.ref('withdraws/' + witId).set({
            id: witId, username: currentUser.username, reqAmount: amt, netPayable: netPayable, phone: phone, status: 'pending'
        }).then(() => {
            alert("উইথড্র রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!");
            document.getElementById('withdraw-amount').value = '';
            document.getElementById('withdraw-phone').value = '';
            loadProfileData();
        });
    });
}

function loadProfileData() {
    if(!currentUser || currentUser.username === 'admin') return;
    
    document.getElementById('profile-name').innerText = currentUser.username;
    document.getElementById('profile-balance').innerText = currentUser.balance;

    db.ref('deposits').once('value', snapshot => {
        let depHistoryBody = document.getElementById('user-deposit-history');
        if(!depHistoryBody) return;
        depHistoryBody.innerHTML = '';
        let count = 0;
        snapshot.forEach(child => {
            let d = child.val();
            if(d.username === currentUser.username) {
                count++;
                depHistoryBody.insertAdjacentHTML('afterbegin', `<tr><td>${d.amount} TK</td><td>${d.txid}</td><td class="status-${d.status}">${d.status.toUpperCase()}</td></tr>`);
            }
        });
        if(count === 0) depHistoryBody.innerHTML = '<tr><td colspan="3">No records</td></tr>';
    });

    db.ref('withdraws').once('value', snapshot => {
        let witHistoryBody = document.getElementById('user-withdraw-history');
        if(!witHistoryBody) return;
        witHistoryBody.innerHTML = '';
        let count = 0;
        snapshot.forEach(child => {
            let w = child.val();
            if(w.username === currentUser.username) {
                count++;
                witHistoryBody.insertAdjacentHTML('afterbegin', `<tr><td>${w.reqAmount} TK</td><td>${w.netPayable} TK</td><td class="status-${w.status}">${w.status.toUpperCase()}</td></tr>`);
            }
        });
        if(count === 0) witHistoryBody.innerHTML = '<tr><td colspan="3">No records</td></tr>';
    });
}

// --- BOT CORE CLOUD LOGIC ---
function renderMarketBots() {
    db.ref('bots').once('value', snapshot => {
        let market = document.getElementById('bot-market');
        if(!market) return;
        market.innerHTML = '';
        if(!snapshot.exists()) { market.innerHTML = '<p>No bots in market.</p>'; return; }

        snapshot.forEach(child => {
            let bot = child.val();
            market.innerHTML += `
                <div class="bot-card">
                    <h4>🤖 ${bot.name}</h4>
                    <p style="margin:4px 0; font-size:12px; color:#94a3b8;">Duration: ${bot.days} Days</p>
                    <p style="margin:4px 0; font-size:12px;">Price: <b>${bot.price} TK</b> | Profit: <b style="color:#10b981;">+${bot.profit} TK</b></p>
                    <button class="btn-glow" onclick="buyBot('${child.key}')">Purchase Bot</button>
                </div>
            `;
        });
    });
}

function buyBot(botKey) {
    db.ref('bots/' + botKey).once('value', snapshot => {
        let bot = snapshot.val();
        
        db.ref('globalPurchases').once('value', gSnap => {
            let myActiveBotsCount = 0;
            let duplicateRunning = false;

            gSnap.forEach(child => {
                let p = child.val();
                if(p.username === currentUser.username && p.status !== "completed") {
                    myActiveBotsCount++;
                    if(p.botName === bot.name) duplicateRunning = true;
                }
            });

            if (myActiveBotsCount >= 2) return alert("❌ আপনি একসাথে সর্বোচ্চ ২টি একটিভ বট রাখতে পারবেন!");
            if (duplicateRunning) return alert("❌ এই বটটি আপনার অলরেডি চালু আছে!");

            let confirmPurchase = confirm(`আপনি কি নিশ্চিত ভাবে ${bot.name} বটটি ${bot.price} টাকা দিয়ে চালু করতে চান?`);
            if(!confirmPurchase) return;

            if (currentUser.balance < bot.price) return alert("পর্যাপ্ত ব্যালেন্স নেই! দয়া করে ডিপোজিট করুন।");

            let newBal = parseFloat((currentUser.balance - bot.price).toFixed(2));
            
            db.ref('users/' + currentUser.username + '/balance').set(newBal).then(() => {
                let pId = Date.now();
                let endTime = Date.now() + (bot.days * 24 * 60 * 60 * 1000);

                db.ref('globalPurchases/' + pId).set({
                    id: pId, username: currentUser.username, botName: bot.name,
                    price: bot.price, profitAmount: bot.profit, endTime: endTime, status: "running"
                }).then(() => {
                    
                    if(!currentUser.hasBoughtBot && currentUser.referredBy && currentUser.referredBy !== "none") {
                        triggerReferralReleaseLogic(currentUser.referredBy, currentUser.username);
                    } else {
                        alert("🎉 " + bot.name + " সফলভাবে চালু করা হয়েছে!");
                    }
                });
            });
        });
    });
}

function triggerReferralReleaseLogic(referrer, referee) {
    db.ref('sysSettings/referralBonus').once('value', bonusSnap => {
        let bonus = parseFloat(bonusSnap.val()) || 0;
        
        db.ref('users/' + referrer).once('value', refUserSnap => {
            if(refUserSnap.exists()) {
                let rUser = refUserSnap.val();
                let oldPending = parseFloat(rUser.refWalletPending || 0);
                let oldSuccess = parseFloat(rUser.refWalletSuccess || 0);
                let oldBalance = parseFloat(rUser.balance || 0);

                let newPending = oldPending - bonus < 0 ? 0 : parseFloat((oldPending - bonus).toFixed(2));
                let newSuccess = parseFloat((oldSuccess + bonus).toFixed(2));
                let newBalance = parseFloat((oldBalance + bonus).toFixed(2));

                db.ref('users/' + referrer).update({
                    balance: newBalance,
                    refWalletPending: newPending,
                    refWalletSuccess: newSuccess
                }).then(() => {
                    db.ref('users/' + referee + '/hasBoughtBot').set(true).then(() => {
                        alert("🎉 বট সফলভাবে চালু করা হয়েছে এবং আপনার ইনভাইটার রেফার বোনাস লাভ করেছে!");
                    });
                });
            } else {
                db.ref('users/' + referee + '/hasBoughtBot').set(true);
            }
        });
    });
}

function startLiveTimerLoop() {
    liveInterval = setInterval(() => {
        if(!currentUser || currentUser.username === 'admin') return;
        triggerCloudBotsEvaluation();
    }, 1000);
}

function triggerCloudBotsEvaluation() {
    db.ref('globalPurchases').once('value', snapshot => {
        let myBotsContainer = document.getElementById('my-bots');
        if(!myBotsContainer) return;
        
        myBotsContainer.innerHTML = '';
        let count = 0;

        snapshot.forEach(child => {
            let p = child.val();
            if(p.username !== currentUser.username) return;
            count++;

            let now = Date.now();
            let timeLeft = p.endTime - now;

            let cardHtml = `<div class="bot-card" style="border-left:4px solid #3b82f6;">
                <h5 style="margin:0; font-size:13px; color:#60a5fa;">${p.botName}</h5>`;

            if (p.status === "running") {
                if (timeLeft > 0) {
                    let days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                    let hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
                    let minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
                    let seconds = Math.floor((timeLeft / 1000) % 60);
                    cardHtml += `<p style="margin:4px 0; font-size:11px;">Status: <span style="color:#f59e0b;">Running Cycle</span></p>
                                 <p style="margin:0; font-size:12px;">Timer: <span class="countdown-text">${days}d ${hours}h ${minutes}m ${seconds}s</span></p>`;
                } else {
                    let matchFound = false;
                    snapshot.forEach(innerChild => {
                        let o = innerChild.val();
                        if(o.price === p.price && o.username !== p.username && o.id > p.id) {
                            matchFound = true;
                        }
                    });

                    if (matchFound) {
                        db.ref('globalPurchases/' + child.key + '/status').set("claimable");
                    } else {
                        let extendedTime = Date.now() + (2 * 24 * 60 * 60 * 1000);
                        db.ref('globalPurchases/' + child.key + '/endTime').set(extendedTime);
                    }
                }
            } else if (p.status === "claimable") {
                cardHtml += `<p style="margin:4px 0; font-size:11px;">Status: <span style="color:#10b981;">Cycle Ready!</span></p>
                             <button style="padding:5px; font-size:11px; background:#10b981;" onclick="claimProfit('${child.key}')">Claim ${p.profitAmount} TK</button>`;
            } else {
                cardHtml += `<p style="margin:4px 0; font-size:11px;">Status: <span style="color:#64748b;">Completed</span></p>
                             <p style="margin:0; font-size:11px; color:#10b981;">Claimed: +${p.profitAmount} TK</p>`;
            }
            cardHtml += `</div>`;
            myBotsContainer.innerHTML += cardHtml;
        });

        if(count === 0) myBotsContainer.innerHTML = '<p style="color:#64748b; font-size:12px;">You do not have any active bots currently.</p>';
    });
}

function claimProfit(purchaseKey) {
    db.ref('globalPurchases/' + purchaseKey).once('value', snapshot => {
        let purchase = snapshot.val();
        if (purchase && purchase.status === 'claimable') {
            let freshBalance = parseFloat((currentUser.balance + purchase.profitAmount).toFixed(2));
            
            db.ref('users/' + currentUser.username + '/balance').set(freshBalance).then(() => {
                db.ref('globalPurchases/' + purchaseKey + '/status').set("completed").then(() => {
                    alert("আপনার প্রফিট ব্যালেন্সে যুক্ত হয়েছে!");
                });
            });
        }
    });
}

let leaderboardInterval = null;

// --- ১০ সেকেন্ড পর পর র্যান্ডম ১০ ইউজার চেঞ্জ করার স্মার্ট ইঞ্জিন ---
function loadLeaderboard() {
    let listContainer = document.getElementById('leaderboardList');
    if (!listContainer) return;

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
            } else if (rank === 2) {
                rankClass = 'rank-2';
            } else if (rank === 3) {
                rankClass = 'rank-3';
            }

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


// --- ADMIN CONTROLLED CLOUD DASHBOARD ---
function loadAdminData() {
    db.ref('sysSettings/referralBonus').once('value', snapshot => {
        if(snapshot.exists()) {
            document.getElementById('admin-ref-commission-input').value = snapshot.val();
        }
    });

    db.ref('users').once('value', snapshot => {
        let totalUserBalance = 0;
        let tbody = document.getElementById('user-list-admin');
        if(!tbody) return;
        tbody.innerHTML = '';

        snapshot.forEach(child => {
            let u = child.val();
            totalUserBalance += (u.balance || 0);
            tbody.innerHTML += `<tr><td>${u.username}</td><td>${u.balance} TK</td></tr>`;
        });

        document.getElementById('stat-total-balance').innerText = totalUserBalance.toFixed(2);
    });

    db.ref('deposits').once('value', snapshot => {
        let totalDeposited = 0;
        let depBody = document.getElementById('admin-deposit-list');
        if(!depBody) return;
        depBody.innerHTML = '';
        let pendingCount = 0;

        snapshot.forEach(child => {
            let d = child.val();
            if(d.status === 'accepted') totalDeposited += d.amount;
            if(d.status === 'pending') {
                pendingCount++;
                depBody.innerHTML += `
                    <tr>
                        <td>${d.username}</td><td>${d.amount} TK</td><td><small style="color:#2dd4bf;">${d.txid}</small></td>
                        <td>
                            <button class="btn-approve" onclick="manageDeposit('${child.key}', 'accept')">Approve</button>
                            <button class="btn-reject" onclick="manageDeposit('${child.key}', 'reject')">Reject</button>
                        </td>
                    </tr>`;
            }
        });
        if(pendingCount === 0) depBody.innerHTML = '<tr><td colspan="4">No pending deposits.</td></tr>';
        document.getElementById('stat-total-deposited').innerText = totalDeposited.toFixed(2);
        calculateAdminNetCash();
    });

    db.ref('withdraws').once('value', snapshot => {
        let totalWithdrawn = 0;
        let witBody = document.getElementById('admin-withdraw-list');
        if(!witBody) return;
        witBody.innerHTML = '';
        let pendingCount = 0;

        snapshot.forEach(child => {
            let w = child.val();
            if(w.status === 'accepted') totalWithdrawn += w.reqAmount;
            if(w.status === 'pending') {
                pendingCount++;
                witBody.innerHTML += `
                    <tr>
                        <td>${w.username}</td><td>${w.reqAmount} TK</td><td style="color:#10b981; font-weight:bold;">${w.netPayable} TK</td><td>${w.phone}</td>
                        <td>
                            <button class="btn-approve" onclick="manageWithdraw('${child.key}', 'accept')">Send</button>
                            <button class="btn-reject" onclick="manageWithdraw('${child.key}', 'reject')">Reject</button>
                        </td>
                    </tr>`;
            }
        });
        if(pendingCount === 0) witBody.innerHTML = '<tr><td colspan="5">No pending withdraws.</td></tr>';
        document.getElementById('stat-total-withdrawn').innerText = totalWithdrawn.toFixed(2);
        calculateAdminNetCash();
    });

    db.ref('bots').once('value', snapshot => {
        let botsTableBody = document.getElementById('admin-bots-list');
        if(!botsTableBody) return;
        botsTableBody.innerHTML = '';
        if(!snapshot.exists()) botsTableBody.innerHTML = '<tr><td colspan="4">No bots configured yet</td></tr>';
        snapshot.forEach(child => {
            let b = child.val();
            botsTableBody.innerHTML += `<tr><td><b>🤖 ${b.name}</b></td><td>${b.price} TK</td><td>${b.profit} TK</td><td>${b.days} Days</td></tr>`;
        });
    });
}

function updateReferralCommission() {
    let amt = parseFloat(document.getElementById('admin-ref-commission-input').value);
    if(isNaN(amt) || amt < 0) return alert("দয়া করে সঠিক বোনাস অ্যামাউন্ট ইনপুট করুন");

    db.ref('sysSettings/referralBonus').set(amt).then(() => {
        alert("🎉 গ্লোবাল রেফারেল বোনাস কমিশন সিস্টেম আপডেট হয়েছে!");
        loadAdminData();
    });
}

function calculateAdminNetCash() {
    setTimeout(() => {
        let depContainer = document.getElementById('stat-total-deposited');
        let witContainer = document.getElementById('stat-total-withdrawn');
        let adminContainer = document.getElementById('stat-admin-cash');
        
        if(depContainer && witContainer && adminContainer) {
            let dep = parseFloat(depContainer.innerText) || 0;
            let wit = parseFloat(witContainer.innerText) || 0;
            adminContainer.innerText = (dep - wit).toFixed(2);
        }
    }, 300);
}

function manageDeposit(depKey, action) {
    db.ref('deposits/' + depKey).once('value', snapshot => {
        let req = snapshot.val();
        if(req) {
            let statusValue = action === 'accept' ? 'accepted' : 'rejected';
            db.ref('deposits/' + depKey + '/status').set(statusValue).then(() => {
                if(action === 'accept') {
                    db.ref('users/' + req.username + '/balance').once('value', balSnap => {
                        let currentBal = balSnap.val() || 0;
                        db.ref('users/' + req.username + '/balance').set(parseFloat((currentBal + req.amount).toFixed(2)));
                    });
                }
                alert("Deposit Responded!");
                loadAdminData();
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
                        let currentBal = balSnap.val() || 0;
                        db.ref('users/' + req.username + '/balance').set(parseFloat((currentBal + req.reqAmount).toFixed(2)));
                    });
                }
                alert("Withdraw Responded!");
                loadAdminData();
            });
        }
    });
}

function createBot() {
    let name = document.getElementById('bot-name').value.trim();
    let price = parseFloat(document.getElementById('bot-price').value);
    let profit = parseFloat(document.getElementById('bot-profit').value);
    let days = parseInt(document.getElementById('bot-days').value);

    if(!name || !price || !profit || !days) return alert("All fields required");

    let bId = Date.now();
    db.ref('bots/' + bId).set({ name, price, profit, days }).then(() => {
        alert("Bot published successfully in Live Cloud Market!");
        loadAdminData();
        document.getElementById('bot-name').value = '';
        document.getElementById('bot-price').value = '';
        document.getElementById('bot-profit').value = '';
        document.getElementById('bot-days').value = '';
    });
}
