// ==========================================
// ১. TELEGRAM WEB APP INITIALIZATION
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready(); // টেলিগ্রাম অ্যাপকে রেডি করা
tg.expand(); // অ্যাপটি পুরো স্ক্রিন জুড়ে ওপেন হবে

// টেলিগ্রাম থেকে ইউজারের ডেটা নেওয়া
const tgUser = tg.initDataUnsafe?.user;

// টেস্ট করার সুবিধার্থে: টেলিগ্রামের বাইরে ব্রাউজারে ওপেন করলে একটি ডেমো আইডি ধরে নিবে
const userId = tgUser ? tgUser.id.toString() : "DEMO_USER_123";
const firstName = tgUser ? tgUser.first_name : "Guest User";

// 👑 আপনার অ্যাডমিন আইডি সেট করা হলো
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
// ৩. AUTOMATIC LOGIN & ROUTING SYSTEM
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // ক) আপনি নিজে ঢুকলে সরাসরি অ্যাডমিন প্যানেল ওপেন হবে
    if (userId === ADMIN_TELEGRAM_ID) {
        currentUser = { username: 'admin', role: 'admin', telegramId: userId };
        
        document.getElementById('auth-page').classList.add('hidden'); // লগইন পেজ হাইড
        document.getElementById('main-app').classList.add('hidden'); // ইউজার অ্যাপ হাইড
        document.getElementById('admin-panel').classList.remove('hidden'); // অ্যাডমিন প্যানেল শো
        
        if (typeof switchAdminTab === "function") switchAdminTab('dash');
        if (typeof loadAdminData === "function") loadAdminData();
        return;
    }

    // খ) সাধারণ ইউজার ঢুকলে অটো-রেজিস্ট্রেশন বা লগইন হবে
    db.ref('users/' + userId).once('value', snapshot => {
        let user = snapshot.val();

        if (user) {
            // ইউজার অলরেডি থাকলে সরাসরি লগইন
            if (user.isBlocked === true) {
                document.body.innerHTML = `<div class="flex items-center justify-center h-screen bg-gray-900 text-white p-6 text-center text-xl font-bold">You are banned from using this bot!</div>`;
                return;
            }
            loginUserFlow(user);
        } else {
            // নতুন ইউজার হলে অটোমেটিক অ্যাকাউন্ট তৈরি (কোনো ফর্ম ফিলাপ ছাড়াই)
            let randomDigits = Math.floor(1000 + Math.random() * 9000);
            let myNewPermanentRefCode = (firstName.substring(0,4).replace(/\s+/g, '') + randomDigits).toUpperCase();

            let newUserObject = { 
                username: firstName, 
                telegramId: userId,
                balance: 0,
                myOwnRefCode: myNewPermanentRefCode, 
                referredBy: "none",   
                parentReferrer: "none",
                refWalletPending: 0,
                refWalletSuccess: 0,
                hasBoughtBot: false,
                isBlocked: false,
                joinedAt: new Date().toISOString()
            };

            db.ref('users/' + userId).set(newUserObject).then(() => {
                loginUserFlow(newUserObject);
            });
        }
    });
});

// ==========================================
// ৪. USER LOGIN FLOW CONTROL
// ==========================================
function loginUserFlow(user) {
    currentUser = user;
    
    // লগইন পেজ লুকিয়ে মেইন অ্যাপ ওপেন করা
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    if (typeof switchTab === "function") {
        switchTab('home', document.querySelector('.bottom-nav .nav-item'));
    }
    
    // আপনার অ্যাপের আগের সকল রিয়েলটাইম ফাংশন রান করা
    if (typeof syncUserData === "function") syncUserData();
    if (typeof startLiveTimerLoop === "function") startLiveTimerLoop();
    if (typeof triggerNoticeModal === "function") triggerNoticeModal();
    if (typeof startFakeTransactions === "function") startFakeTransactions();
    if (typeof loadLeaderboard === "function") loadLeaderboard();
}

// ==========================================
// ৫. LOGOUT FUNCTION (টেলিগ্রামের জন্য রিলোড)
// ==========================================
function logout() {
    currentUser = null;
    tg.close(); // টেলিগ্রাম মিনি অ্যাপটি অটোমেটিক বন্ধ হয়ে যাবে
}
