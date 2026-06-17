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

// ২৫ জনের কাস্টম ডাইনামিক ফেক মেম্বার পুল (লিডারবোর্ডের জন্য)
let fakeLeaderboardData = [
    { name: "Rafiqul Islam", balance: 5420, tag: 'কিং মেম্বার' },
    { name: "Al Amin Hossain", balance: 4850, tag: 'প্রো Elite' },
    { name: "Sumaiya Akter", balance: 4120, tag: 'এলিট মেম্বার' },
    { name: "Tariqul Islam", balance: 3950, tag: 'গোল্ড মেম্বার' },
    { name: "Nayeem Ahmed", balance: 3820, tag: 'গোল্ড মেম্বার' },
    { name: "Sabbir Rahman", balance: 3540, tag: 'সিলভার মেম্বার' },
    { name: "Rokeya Begum", balance: 3120, tag: 'ম্যাট্রিক্স প্রো' },
    { name: "Ariful Islam", balance: 2950, tag: 'নিয়মিত মেম্বার' },
    { name: "Fahim Shahriar", balance: 2600, tag: 'নতুন মেম্বার' },
    { name: "Anika Tahsin", balance: 2450, tag: 'নতুন মেম্বার' },
    { name: "Zayan Ahmed", balance: 2310, tag: 'সিলভার মেম্বার' },
    { name: "Taskin Ahmed", balance: 2200, tag: 'নিয়মিত মেম্বার' },
    { name: "Nusrat Jahan", balance: 2150, tag: 'এলিট মেম্বার' },
    { name: "Hasan Al Banna", balance: 2050, tag: 'গোল্ড মেম্বার' },
    { name: "Tanvir Mahtab", balance: 1980, tag: 'সিলভার মেম্বার' },
    { name: "Sajid Afridi", balance: 1870, tag: 'নতুন মেম্বার' },
    { name: "Mehedi Hasan", balance: 1750, tag: 'নিয়মিত মেম্বার' },
    { name: "Riya Khandaker", balance: 1690, tag: 'ম্যাট্রিক্স প্রো' },
    { name: "Asif Ent.", balance: 1600, tag: 'প্রো Elite' },
    { name: "Imran Khan", balance: 1540, tag: 'সিলভার মেম্বার' },
    { name: "Sadia Afrin", balance: 1420, tag: 'নতুন মেম্বার' },
    { name: "Rakibul Pro", balance: 1350, tag: 'কিং মেম্বার' },
    { name: "Monir Hossain", balance: 1200, tag: 'নিয়মিত মেম্বার' },
    { name: "Tamanna Islam", balance: 1150, tag: 'নতুন মেম্বার' },
    { name: "Sakib ALL Round", balance: 1050, tag: 'গোল্ড মেম্বার' }
];

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
            if (user.isBlocked === true) {
                document.getElementById('auth-page').classList.add('hidden');
                document.getElementById('main-app').classList.add('hidden');
                document.getElementById('suspended-screen').classList.remove('hidden');
                return;
            }
            loginUserFlow(user);
        } else {
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
                deviceId: "TG-" + Math.floor(100000 + Math.random() * 900000), 
                hasBoughtBot: false,
                isBlocked: false,
                refWalletPending: 0,
                refWalletSuccess: 0,
                joinedAt: new Date().toISOString()
            };

            db.ref('users/' + userId).set(newUserObject).then(() => {
                // নতুন ইউজার জয়েন করলে: কাস্টম লেভেল ১ ও লেভেল ৩ বোনাস রেন্ডার করা (পেন্ডিং মোডে)
                if(startParam !== "none") {
                    processReferralActionChain(startParam, "REGISTRATION", userId);
                }
                loginUserFlow(newUserObject);
            });
        }
    });
});

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
    alert("Telegram Secure Gateway Auto-Verified Your Account! Loading Matrix...");
}

function loginUserFlow(user) {
    currentUser = user;
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    switchTab('home', document.querySelector('.bottom-nav .nav-item'));
    
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
    if(tabId === 'leaderboard') loadLeaderboard(); // ট্যাব সুইচ করলেই ফেক মেম্বার চেঞ্জ হবে
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
        
        triggerCloudBotsEvaluation(); // সার্ভার ট্র্যাকিং এভয়েড করে ডাইনামিক রেন্ডার
    });

    loadBotMarket();
}

function loadProfileData() {
    if(!currentUser) return;
    document.getElementById('profile-name').innerText = currentUser.username;
    document.getElementById('profile-balance').innerText = parseFloat(currentUser.balance).toFixed(2);
    document.getElementById('user-ref-pending').innerText = parseFloat(currentUser.refWalletPending || 0).toFixed(2);
    document.getElementById('user-ref-success').innerText = parseFloat(currentUser.refWalletSuccess || 0).toFixed(2);
    
    let botUsername = "QuantumProBD_bot"; 
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
// ৬. BOT MARKETPLACE & INCOME CORE LOGIC (হোল্ড ও ৪-ধাপের রেফার সিস্টেম মিশ্রিত)
// ==========================================
function loadBotMarket() {
    db.ref('bots').once('value', snapshot => {
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
                    <button id="btn-buy-${child.key}" onclick="buyBot('${child.key}', ${b.price})">Rent Bot</button>
                </div>
            `;
        });
    });
}

function buyBot(botId, price) {
    let buyBtn = document.getElementById(`btn-buy-${botId}`);
    if(buyBtn) buyBtn.disabled = true; // ডাবল সাবমিশন লোডিং প্রটেকশন

    if(parseFloat(currentUser.balance) < price) {
        if(buyBtn) buyBtn.disabled = false;
        return alert("Insufficient balance! Please deposit cash first.");
    }

    db.ref('bots/' + botId).once('value', snap => {
        let bData = snap.val();
        if(!bData) { if(buyBtn) buyBtn.disabled = false; return; }

        let newBalance = parseFloat((currentUser.balance - price).toFixed(2));
        let pId = Date.now();
        let endTime = pId + (bData.days * 24 * 60 * 60 * 1000);
        
        let globalPurchaseNode = {
            id: pId,
            username: currentUser.username,
            userId: userId,
            botName: bData.name,
            price: bData.price,
            profitAmount: bData.profit,
            endTime: endTime,
            status: "running"
        };

        // ইউজারের ব্যালেন্স কাটা এবং বট স্টেট দেওয়া
        db.ref('users/' + userId + '/balance').set(newBalance);
        db.ref('users/' + userId + '/hasBoughtBot').set(true);

        db.ref('globalPurchases/' + pId).set(globalPurchaseNode).then(() => {
            // একই লেভেলের পূর্বে আটকে থাকা বা হোল্ডে থাকা বটগুলোকে রিলিজ করা
            releaseOlderBotsOfSameLevel(bData.price, pId);

            // ৪-ধাপের অ্যাকশন ভিত্তিক রেফারেল বোনাস রিলিজ বা পেন্ডিং চেইন প্রসেসিং
            if(currentUser.referredBy && currentUser.referredBy !== "none") {
                processReferralActionChain(currentUser.referredBy, "BOT_PURCHASE", userId);
            }

            alert(`Successfully activated ${bData.name}!`);
            if(buyBtn) buyBtn.disabled = false;
        }).catch(() => { if(buyBtn) buyBtn.disabled = false; });
    });
}

// একই প্রাইসের পুরোনো হোল্ডে থাকা বট রিলিজ মেকানিজম
function releaseOlderBotsOfSameLevel(botPrice, currentPurchaseId) {
    db.ref('globalPurchases').once('value', snapshot => {
        snapshot.forEach(child => {
            let p = child.val();
            if (p.id !== currentPurchaseId && p.price === botPrice && p.status === 'waiting') {
                db.ref('globalPurchases/' + child.key + '/status').set('claimable');
            }
        });
    });
}

// বটের লাইভ এভালুয়েশন এবং ২ দিন এক্সটেনশন লুপ (সার্ভারে রিয়েলটাইম পুশ কমায়)
function triggerCloudBotsEvaluation() {
    db.ref('globalPurchases').once('value', snapshot => {
        let container = document.getElementById('my-bots');
        if(!container) return;
        container.innerHTML = '';
        let count = 0;

        snapshot.forEach(child => {
            let p = child.val();
            if(p.userId !== userId) return;
            count++;

            let now = Date.now();
            let timeLeft = p.endTime - now;

            // রানিং বটের সময় শেষ হলে অটো ২ দিন বাড়িয়ে 'waiting' করা
            if (p.status === "running" && timeLeft <= 0) {
                let extendedTime = now + (2 * 24 * 60 * 60 * 1000); 
                db.ref('globalPurchases/' + child.key).update({ status: "waiting", endTime: extendedTime });
                p.status = "waiting"; p.endTime = extendedTime; timeLeft = extendedTime - now;
            }
            
            // হোল্ড বটের ২ দিনও পার হয়ে গেলে পুনরায় মেয়াদ ২ দিন বৃদ্ধি করা
            if (p.status === "waiting" && timeLeft <= 0) {
                let extendedTime = now + (2 * 24 * 60 * 60 * 1000);
                db.ref('globalPurchases/' + child.key + '/endTime').set(extendedTime);
                p.endTime = extendedTime; timeLeft = extendedTime - now;
            }

            let cardHtml = `<div class="running-bot-card card-3d" style="margin-bottom: 10px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <h4 style="margin:0; font-size:14px; color:#fff;">🤖 ${p.botName} (Level: ৳ ${p.price})</h4>`;

            if (p.status === "running") {
                let days = Math.floor(timeLeft / (1000 * 60 * 60 * 24)), hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
                let minutes = Math.floor((timeLeft / (1000 * 60)) % 60), seconds = Math.floor((timeLeft / 1000) % 60);
                cardHtml += `
                    <p style="margin:4px 0; font-size:12px; color:#f59e0b;">Status: ⏳ Mining Running</p>
                    <p style="margin:0; font-size:12px; color:#2dd4bf;">Ends In: ${days}d ${hours}h ${minutes}m ${seconds}s</p>`;
            } else if (p.status === "waiting") {
                cardHtml += `
                    <p style="margin:4px 0; font-size:12px; color:#ef4444; font-weight:bold;">⚠️ Status: Hold / Funding Quota Empty</p>
                    <p style="font-size:11px; color:#94a3b8; margin:2px 0;">Profit unlocks when someone activates this level bot.</p>`;
            } else if (p.status === "claimable") {
                cardHtml += `
                    <p style="margin:4px 0; font-size:12px; color:#10b981;">Status: 🎉 Fund Unlocked</p>
                    <button class="btn-claim-income" style="padding:4px 10px; background:#10b981; font-size:12px; width:100%; margin-top:5px;" onclick="claimProfit('${child.key}')">Claim ৳ ${p.profitAmount}</button>`;
            } else {
                cardHtml += `<p style="margin:4px 0; font-size:12px; color:#64748b;">Status: ✅ Completed (+৳ ${p.profitAmount})</p>`;
            }
            cardHtml += `</div>`;
            container.innerHTML += cardHtml;
        });
        if(count === 0) container.innerHTML = '<p style="color:#94a3b8; font-size:12px; text-align:center; padding:10px;">You do not have any active bots.</p>';
    });
}

function claimProfit(purchaseKey) {
    db.ref('globalPurchases/' + purchaseKey).once('value', snapshot => {
        let p = snapshot.val();
        if(p && p.status === 'claimable') {
            let finalBal = parseFloat((parseFloat(currentUser.balance) + parseFloat(p.profitAmount)).toFixed(2));
            db.ref('users/' + userId + '/balance').set(finalBal);
            db.ref('globalPurchases/' + purchaseKey + '/status').set('completed').then(() => {
                alert(`🎉 ৳ ${p.profitAmount} successfully credited to main balance!`);
            });
        }
    });
}

// 👑 ৪-ধাপের অনন্য কাস্টম অ্যাকশন ভিত্তিক এমএলএম রেফারেল ইঞ্জিন (পেন্ডিং ও মেইন ওয়ালেট কন্ট্রোল)
function processReferralActionChain(refCode, actionType, triggeringUserId) {
    db.ref('sysSettings').once('value', settingsSnap => {
        let s = settingsSnap.val() || {};
        let lvl1Amt = parseFloat(s.referralBonus) || 0; // Level 1 (Registration)
        let lvl2Amt = parseFloat(s.lvl2Commission) || 0; // Level 2 (B buys bot)
        let lvl3Amt = parseFloat(s.lvl3Commission) || 0; // Level 3 (B refers C)
        let lvl4Amt = parseFloat(s.lvl4Commission) || 0; // Level 4 (C buys bot)

        db.ref('users').once('value', allUsersSnap => {
            let uMap = allUsersSnap.val();
            
            // ১. খুজে বের করা কে কাকে রেফার করেছে (চেইন ডিটেকশন)
            let userA_Key = null; // মূল আপলাইনার
            let userB_Key = null; // সরাসরি ইনভাইট হওয়া ইউজার

            // চেইন ডিটেক্ট করতে ট্রিগারিং ইউজারের ডাটা চেক
            let triggerUser = uMap[triggeringUserId];
            if(!triggerUser) return;

            if (actionType === "REGISTRATION") {
                // User A রেফার কোড দিয়ে B রেজিস্ট্রেশন করেছে
                for(let k in uMap) {
                    if(uMap[k].myOwnRefCode === refCode) userA_Key = k;
                }
                if(userA_Key) {
                    // Level 1 বোনাস জেনারেট হচ্ছে -> কন্ডিশনাল পেন্ডিং চেক
                    if(uMap[userA_Key].hasBoughtBot === true) {
                        // User A যদি অলরেডি বট কেনা থাকে তবে মেইন ব্যালেন্স ও সাকসেস যোগ
                        db.ref('users/' + userA_Key + '/balance').transaction(c => parseFloat((parseFloat(c || 0) + lvl1Amt).toFixed(2)));
                        db.ref('users/' + userA_Key + '/refWalletSuccess').transaction(c => parseFloat((parseFloat(c || 0) + lvl1Amt).toFixed(2)));
                    } else {
                        // অন্যথায় পেন্ডিং ব্যালেন্সে হোল্ড হবে
                        db.ref('users/' + userA_Key + '/refWalletPending').transaction(c => parseFloat((parseFloat(c || 0) + lvl1Amt).toFixed(2)));
                    }
                }
            } 
            
            else if (actionType === "BOT_PURCHASE") {
                // User B বট বাই করেছে -> User A পাবে Level 2 বোনাস
                for(let k in uMap) {
                    if(uMap[k].myOwnRefCode === triggerUser.referredBy) userA_Key = k;
                }
                if(userA_Key) {
                    // Level 2 বোনাস জেনারেট: B নিজে বট কিনেছে, তাই A এর প্রোফাইল অনুযায়ী চেক হবে
                    if(uMap[userA_Key].hasBoughtBot === true) {
                        db.ref('users/' + userA_Key + '/balance').transaction(c => parseFloat((parseFloat(c || 0) + lvl2Amt).toFixed(2)));
                        db.ref('users/' + userA_Key + '/refWalletSuccess').transaction(c => parseFloat((parseFloat(c || 0) + lvl2Amt).toFixed(2)));
                    } else {
                        db.ref('users/' + userA_Key + '/refWalletPending').transaction(c => parseFloat((parseFloat(c || 0) + lvl2Amt).toFixed(2)));
                    }

                    // গুরুত্বপূর্ণ: B এর প্রথম বট ক্রয়ে B এর নিজের প্রোফাইলে পূর্বে জমে থাকা সমস্ত পেন্ডিং বোনাস মেইন ওয়ালেটে রিলিজ করা
                    let bPending = parseFloat(uMap[triggeringUserId].refWalletPending || 0);
                    if(bPending > 0) {
                        db.ref('users/' + triggeringUserId + '/balance').transaction(c => parseFloat((parseFloat(c || 0) + bPending).toFixed(2)));
                        db.ref('users/' + triggeringUserId + '/refWalletSuccess').transaction(c => parseFloat((parseFloat(c || 0) + bPending).toFixed(2)));
                        db.ref('users/' + triggeringUserId + '/refWalletPending').set(0);
                    }

                    // Level 4 ডিপেন্ডেন্সি চেক (C যদি বট কিনে থাকে তবে তার ৩য় আপলাইনারকে ট্র্যাক করা)
                    let parentOfA_Key = null;
                    if(uMap[userA_Key].referredBy && uMap[userA_Key].referredBy !== "none") {
                        for(let k4 in uMap) {
                            if(uMap[k4].myOwnRefCode === uMap[userA_Key].referredBy) parentOfA_Key = k4;
                        }
                        if(parentOfA_Key) {
                            // এটি হলো Level 4 সিনারিও (C বট কিনেছে আর Parent of A বোনাস পাচ্ছে)
                            if(uMap[parentOfA_Key].hasBoughtBot === true) {
                                db.ref('users/' + parentOfA_Key + '/balance').transaction(c => parseFloat((parseFloat(c || 0) + lvl4Amt).toFixed(2)));
                                db.ref('users/' + parentOfA_Key + '/refWalletSuccess').transaction(c => parseFloat((parseFloat(c || 0) + lvl4Amt).toFixed(2)));
                            } else {
                                db.ref('users/' + parentOfA_Key + '/refWalletPending').transaction(c => parseFloat((parseFloat(c || 0) + lvl4Amt).toFixed(2)));
                            }
                        }
                    }
                }
            }
            
            // লেভেল ৩ ট্র্যাকিং লজিক (B যখন C কে রেফার করেছে, তখন চেইনের শেষ মাথা চেক করা)
            if (actionType === "REGISTRATION" && userA_Key) {
                let grandpaKey = null;
                if(uMap[userA_Key].referredBy && uMap[userA_Key].referredBy !== "none") {
                    for(let kg in uMap) {
                        if(uMap[kg].myOwnRefCode === uMap[userA_Key].referredBy) grandpaKey = kg;
                    }
                    if(grandpaKey) {
                        // Level 3 বোনাস বরাদ্দকরণ
                        if(uMap[grandpaKey].hasBoughtBot === true) {
                            db.ref('users/' + grandpaKey + '/balance').transaction(c => parseFloat((parseFloat(c || 0) + lvl3Amt).toFixed(2)));
                            db.ref('users/' + grandpaKey + '/refWalletSuccess').transaction(c => parseFloat((parseFloat(c || 0) + lvl3Amt).toFixed(2)));
                        } else {
                            db.ref('users/' + grandpaKey + '/refWalletPending').transaction(c => parseFloat((parseFloat(c || 0) + lvl3Amt).toFixed(2)));
                        }
                    }
                }
            }

        });
    });
}

// ==========================================
// ৭. USER TRANSACTION SYSTEM (DEPOSIT/WITHDRAW)
// ==========================================
function depositRequest() {
    let depBtn = document.getElementById('btn-submit-deposit');
    let amt = parseFloat(document.getElementById('deposit-amount').value);
    let trx = document.getElementById('deposit-txid').value.trim();

    if(!amt || !trx || amt < 100) return alert("Minimum deposit is 100 TK. Please fill data accurately.");
    if(depBtn) depBtn.disabled = true;

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
        if(depBtn) depBtn.disabled = false;
    }).catch(() => { if(depBtn) depBtn.disabled = false; });
}

function withdrawRequest() {
    let witBtn = document.getElementById('btn-submit-withdraw');
    let amt = parseFloat(document.getElementById('withdraw-amount').value);
    let phone = document.getElementById('withdraw-phone').value.trim();

    if(!amt || !phone || amt < 500) return alert("Minimum withdraw is 500 TK.");
    if((parseFloat(currentUser.balance) - amt) < 50) return alert("You must leave at least 50 TK in your balance!");
    if(witBtn) witBtn.disabled = true;

    let netPay = parseFloat((amt * 0.98).toFixed(2)); 

    let withdrawNode = {
        username: currentUser.username,
        amount: amt,
        netPay: netPay,
        phone: phone,
        status: "PENDING",
        timestamp: new Date().toISOString()
    };

    let finalBal = parseFloat((currentUser.balance - amt).toFixed(2));
    db.ref('users/' + userId + '/balance').set(finalBal).then(() => {
        db.ref('withdraws').push(withdrawNode).then(() => {
            db.ref('users/' + userId + '/withdrawHistory').push({ amount: amt, netPay: netPay, status: "PENDING" });
            alert("Withdraw request sent successfully!");
            document.getElementById('withdraw-amount').value = '';
            document.getElementById('withdraw-phone').value = '';
            if(witBtn) witBtn.disabled = false;
        });
    }).catch(() => { if(witBtn) witBtn.disabled = false; });
}

function loadUserHistory() {
    db.ref('users/' + userId + '/depositHistory').on('value', snap => {
        let body = document.getElementById('user-deposit-history');
        if(!body) return;
        body.innerHTML = '';
        snap.forEach(c => {
            let d = c.val();
            let col = d.status === "APPROVED" ? "#10b981" : d.status === "REJECTED" ? "#ef4444" : "#f59e0b";
            body.innerHTML += `<tr><td>${d.amount}</td><td>${d.trxId}</td><td style="color:${col}; font-weight:bold;">${d.status}</td></tr>`;
        });
    });

    db.ref('users/' + userId + '/withdrawHistory').on('value', snap => {
        let body = document.getElementById('user-withdraw-history');
        if(!body) return;
        body.innerHTML = '';
        snap.forEach(c => {
            let w = c.val();
            let col = w.status === "APPROVED" ? "#10b981" : w.status === "REJECTED" ? "#ef4444" : "#f59e0b";
            body.innerHTML += `<tr><td>${w.amount}</td><td>${w.netPay}</td><td style="color:${col}; font-weight:bold;">${w.status}</td></tr>`;
        });
    });
}

// ==========================================
// ৮. LEADERBOARD & LIVE POPUPS ENGINE (ডাইনামিক ফেক টপ ১০ মেম্বার রেন্ডারার)
// ==========================================
function loadLeaderboard() {
    let board = document.getElementById('leaderboardList');
    if (!board) return;

    // ২৫ জনের পুলে প্রতিবার ডাটা মিক্সিং-এর জন্য র্যান্ডম বোনাস যোগ করা
    fakeLeaderboardData.forEach(user => {
        let randomBonus = Math.floor(Math.random() * 50) + 5; 
        user.balance += randomBonus;
    });

    // বেশি ব্যালেন্স অনুযায়ী সাজানো
    fakeLeaderboardData.sort((a, b) => b.balance - a.balance);
    
    // সেরা টপ ১০ জন ফিল্টার করে আলাদা করা
    let topTen = fakeLeaderboardData.slice(0, 10);
    board.innerHTML = '';

    topTen.forEach((user, idx) => {
        let medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx+1}`;
        board.innerHTML += `
            <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.03); padding:12px; margin-bottom:6px; border-radius:8px; align-items:center;">
                <span><b>${medal}</b> ${user.name} <small style="color:#64748b; font-size:10px;">(${user.tag || "মেম্বার"})</small></span>
                <span style="color:#2dd4bf; font-weight:bold;">${parseFloat(user.balance).toFixed(2)} TK</span>
            </div>
        `;
    });
}

// প্রতি ৬০ সেকেন্ডে লিডারবোর্ড ব্যাকগ্রাউন্ডে ডাটা হালকা চেঞ্জ করবে (কোনো অতিরিক্ত ভারী লুপ নেই)
if(leaderboardInterval) clearInterval(leaderboardInterval);
leaderboardInterval = setInterval(loadLeaderboard, 60000);

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
        if(list.children.length > 5) list.removeChild(list.lastChild); // ৭ থেকে কমিয়ে ৫টি করা হলো পেজ হালকা রাখার জন্য
    }, 15000); 
}

// ==========================================
// ৯. LIVE NOTIFICATION SYSTEM
// ==========================================
function startLiveTimerLoop() {
    if(liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(() => {
        // লাইভ ঘড়ির কোড লাগলে দিতে পারেন, ডাটাবেজ প্রটেকশন করা হয়েছে
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
        if(!uBody) return;
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

    db.ref('deposits').on('value', snap => {
        let body = document.getElementById('admin-deposit-list');
        if(!body) return;
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

    db.ref('withdraws').on('value', snap => {
        let body = document.getElementById('admin-withdraw-list');
        if(!body) return;
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
        document.getElementById('bot-price').value
