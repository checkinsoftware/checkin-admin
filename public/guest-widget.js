/* Checkin guest widget — golden theme. Login = bottom-sheet popup. The SMS
   notifications page renders IN THE PAGE (between the site header and footer),
   so it is a real, responsive page — not a separate overlay. Menu items live in
   the site's own nav. Same-origin APIs, no deps. */
(function () {
  if (window.__ckGuest) return;
  window.__ckGuest = true;

  var API = { me: "/api/user/messages", send: "/api/user/otp/send", verify: "/api/user/otp/verify", pwlogin: "/api/user/password/login", setpw: "/api/user/password", logout: "/api/user/logout", pushCfg: "/api/push/config", device: "/api/user/device" };
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  // Defaults to today's SMS — "Clear Filters" drops this to show every message ever.
  var st = { loggedIn: false, mobile: "", name: "", total: 0, messages: [], date: todayStr(), step: "mobile", code: "", password: "", dev: null, skip: false, busy: false, err: "", view: "messages", profile: {} };

  var css =
    "#ckfab{position:fixed;right:16px;bottom:16px;z-index:900;background:#5E1B22;color:#FBF4E8;border:1.5px solid #E0952A;border-radius:999px;padding:12px 20px;font:700 15px 'Figtree',system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 10px 26px rgba(67,16,22,.4);cursor:pointer}" +
    "#ckov{position:fixed;inset:0;z-index:2000;display:none;align-items:flex-end;justify-content:center;background:rgba(43,16,22,.5);font:400 15px 'Figtree',system-ui,-apple-system,Segoe UI,sans-serif}" +
    "#ckov.on{display:flex}" +
    "#cksheet{position:relative;width:100%;max-width:440px;max-height:92vh;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:16px 16px 24px;box-shadow:0 -8px 40px rgba(43,16,22,.28)}" +
    "@media(min-width:640px){#ckov{align-items:center}#cksheet{border-radius:22px}}" +
    ".ckgrip{width:44px;height:5px;border-radius:999px;background:#eaddc4;margin:2px auto 12px}" +
    ".ckban{position:relative;overflow:hidden;border-radius:16px;background:linear-gradient(120deg,#5E1B22,#7A2A31);color:#FBF4E8;padding:12px 36px 12px 12px}" +
    ".ckx{position:absolute;right:8px;top:8px;width:26px;height:26px;border:none;border-radius:999px;background:rgba(255,255,255,.2);color:#fff;font-size:14px;cursor:pointer}" +
    ".ckbanrow{display:flex;align-items:center;gap:12px}" +
    ".ckbadge{width:46px;height:46px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:999px;background:#E0952A;color:#431016;font-size:20px}" +
    ".ckh{font-size:19px;font-weight:700;color:#2C231B;margin:16px 2px 2px}" +
    ".cksub{font-size:14px;color:#7C6A55;margin:0 2px 14px}" +
    ".ckrow{display:flex;gap:8px}" +
    ".ckpre{display:flex;align-items:center;gap:4px;border:1px solid #E7D9BF;background:#FBF4E8;border-radius:12px;padding:0 12px;font-weight:700;color:#5E1B22}" +
    ".ckinp{width:100%;border:1px solid #E7D9BF;border-radius:12px;padding:13px 14px;font-size:16px;outline:none;box-sizing:border-box;color:#2C231B;background:#fff}" +
    ".ckinp:focus{border-color:#E0952A;box-shadow:0 0 0 3px rgba(224,149,42,.18)}" +
    "select.ckinp{-webkit-appearance:none;appearance:none}" +
    ".ckinp[disabled]{background:#FBF4E8;color:#7C6A55}" +
    ".ckbtn{width:100%;border:none;border-radius:12px;background:#5E1B22;color:#FBF4E8;padding:14px;font-size:16px;font-weight:700;cursor:pointer;margin-top:12px}" +
    ".ckbtn:disabled{opacity:.6}" +
    ".ckskip{width:100%;border:none;background:none;color:#a08a6e;font-size:14px;font-weight:600;padding:10px;cursor:pointer}" +
    ".ckerr{background:#fbeaea;color:#8a1f1f;border-radius:10px;padding:8px 12px;font-size:14px;margin-top:10px}" +
    ".ckinfo{background:#FBF4E8;color:#7a4d0a;border:1px solid #F1CB86;border-radius:10px;padding:8px 12px;font-size:14px;margin-top:10px}" +
    ".cklbl{font-size:13px;font-weight:700;color:#5E1B22;margin:14px 2px 6px}" +
    /* auto-shown "install this app" banner, top of page */
    "#ck-install{position:fixed;left:10px;right:10px;top:10px;z-index:1200;display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #E7D9BF;border-radius:16px;padding:12px 12px 12px 14px;box-shadow:0 10px 30px rgba(67,16,22,.2);max-width:440px;margin:0 auto}" +
    "#ck-install img{width:42px;height:42px;border-radius:11px;flex:none}" +
    "#ck-install .txt{flex:1;min-width:0}" +
    "#ck-install .txt b{display:block;font-size:.9rem;color:#5E1B22;font-weight:800}" +
    "#ck-install .txt span{display:block;font-size:.76rem;color:#7C6A55;margin-top:1px}" +
    "#ck-install .btns{display:flex;align-items:center;gap:4px;flex:none}" +
    "#ck-install .go{border:none;border-radius:10px;padding:9px 14px;font-weight:700;font-size:.8rem;cursor:pointer;background:#E0952A;color:#431016}" +
    "#ck-install .x{border:none;background:none;color:#a08a6e;font-size:18px;cursor:pointer;padding:4px 6px;line-height:1}" +
    /* in-page SMS section */
    "#ck-sms{max-width:760px;margin:0 auto;padding:0 16px 84px;min-height:60vh}" +
    "#ck-bar{position:fixed;bottom:0;left:0;right:0;z-index:800;display:none;gap:8px;padding:8px 12px calc(8px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #E7D9BF;box-shadow:0 -4px 16px rgba(67,16,22,.08)}" +
    "#ck-bar.on{display:flex}" +
    "#ck-bar button{flex:1;border:1px solid #E7D9BF;background:#FBF4E8;color:#5E1B22;border-radius:12px;padding:11px;font-weight:700;font-size:.92rem;cursor:pointer}" +
    "#ck-bar button.pri{background:#5E1B22;color:#FBF4E8;border-color:#5E1B22}" +
    // Total + date-filter stick together at the top of the message list so
    // they stay visible while the guest scrolls through SMS.
    "#ck-sms .sticktop{position:sticky;top:var(--ck-hh,0px);z-index:5;background:#FBF4E8;margin:0 -16px;padding:10px 16px 0;transition:box-shadow .2s,border-color .2s;border-bottom:1px solid transparent}" +
    "body.ck-stuck #ck-sms .sticktop{border-bottom-color:#E7D9BF;box-shadow:0 4px 12px rgba(94,27,34,.08)}" +
    "#ck-sms .top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}" +
    "#ck-sms .ttl{font-size:.82rem;font-weight:700;color:#5E1B22}" +
    "#ck-sms .ttl .ttldate{font-weight:600;color:#A9660F}" +
    "#ck-sms .num{display:inline-flex;align-items:center;gap:5px;background:#FBF0DC;border:1px solid #E7D9BF;border-radius:999px;padding:4px 11px;font-size:.72rem;color:#5E1B22;font-weight:700;white-space:nowrap}" +
    "#ck-sms .num:before{content:'📱'}" +
    "#ck-sms .filt{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap}" +
    "#ck-sms .dt{flex:1;min-width:150px;border:1px solid #E7D9BF;border-radius:12px;padding:11px 12px;font-size:15px;background:#fff;color:#2C231B;outline:none}" +
    "#ck-sms .rf{width:46px;height:46px;flex:none;border:none;border-radius:12px;background:#E0952A;color:#431016;font-size:18px;cursor:pointer}" +
    "#ck-sms .clr{border:none;background:none;color:#A9660F;font-size:.85rem;font-weight:700;cursor:pointer;padding:2px 0 10px}" +
    "#ck-sms .card{background:#fff;border:1px solid #ecdfc6;border-radius:10px;padding:9px 11px;margin-bottom:7px;transition:box-shadow .3s,border-color .3s,background .3s}" +
    "#ck-sms .card p{margin:0;font-size:.86rem;color:#431016;line-height:1.4}" +
    "#ck-sms .card small{display:block;margin-top:4px;color:#a08a6e;font-size:.72rem}" +
    "#ck-sms .card.hl{background:#FFF7E6;border:2px solid #E0952A;box-shadow:0 0 0 3px rgba(224,149,42,.18)}" +
    "#ck-sms .card .nb{display:inline-block;background:#E0952A;color:#431016;font-size:.62rem;font-weight:700;padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px}" +
    "#ck-sms .empty{text-align:center;color:#a08a6e;padding:40px 0}" +
    "#ck-sms .back{border:1px solid #E7D9BF;background:#fff;color:#5E1B22;border-radius:999px;padding:7px 14px;font-weight:700;font-size:.8rem;cursor:pointer;white-space:nowrap}" +
    "#ck-sms .form{max-width:520px}" +
    "#ck-sms .fld{margin-bottom:10px}" +
    "nav.main a.ck-navitem{color:#5E1B22 !important;display:flex;align-items:center;justify-content:space-between;gap:10px}" +
    ".ck-sw{width:38px;height:22px;border-radius:999px;background:#d8c7ad;position:relative;flex:none}" +
    ".ck-sw.on{background:#198754}" +
    ".ck-sw::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:999px;background:#fff;transition:.15s}" +
    ".ck-sw.on::after{left:18px}" +
    "nav.main .ck-prof{display:flex;align-items:center;gap:10px;margin:0 0 4px;padding:10px 14px;border-bottom:1px solid #E7D9BF}" +
    "nav.main .ck-av{width:38px;height:38px;flex:0 0 38px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:17px;background:#5E1B22;color:#E0952A;border:2px solid #E0952A;cursor:pointer}" +
    "nav.main .ck-pi{flex:1;min-width:0;line-height:1.25}" +
    "nav.main .ck-pn{font-weight:700;font-size:.9rem;color:#5E1B22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    "nav.main .ck-pm{font-size:.72rem;color:#7C6A55}" +
    "nav.main .ck-ep{flex:0 0 auto;border:1px solid #E0952A;background:#FBF4E8;color:#5E1B22;border-radius:999px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer}" +
    "nav.main .ck-prof.guest{display:block;text-align:center;padding:12px 18px}" +
    "nav.main .ck-prof.guest .ck-av{margin:0 auto 6px}" +
    "nav.main .ck-prof.guest .ck-ep{width:auto;height:auto;padding:5px 14px;font-weight:700;font-size:.78rem;margin-top:6px}" +
    // Desktop: profile block lives in the header, next to the phone number (compact).
    ".hactions .ck-prof{display:flex;align-items:center;gap:8px;margin:0;padding:0;border:none}" +
    ".hactions .ck-av{width:34px;height:34px;flex:0 0 34px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:15px;background:#5E1B22;color:#E0952A;border:2px solid #E0952A;cursor:pointer}" +
    ".hactions .ck-pi{line-height:1.15;min-width:0}" +
    ".hactions .ck-pn{font-weight:700;font-size:.82rem;color:#5E1B22;white-space:nowrap}" +
    ".hactions .ck-pm{font-size:.68rem;color:#7C6A55}" +
    ".hactions .ck-ep{border:1px solid #E0952A;background:#FBF4E8;color:#5E1B22;border-radius:999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;cursor:pointer;flex:0 0 auto}" +
    ".hactions .ck-prof.guest .ck-pn{display:none}" +
    ".hactions .ck-prof.guest .ck-ep{width:auto;height:auto;padding:6px 14px;font-weight:700;font-size:.78rem}" +
    /* magic-link welcome landing */
    "#ck-wel{max-width:440px;margin:18px auto 40px;padding:0 14px}" +
    "#ck-wel .card{background:#FBF4E8;border:1px solid #E7D9BF;border-radius:16px;overflow:hidden}" +
    "#ck-wel .hero{background:linear-gradient(135deg,#5E1B22,#7A2A31);color:#F1CB86;padding:26px 20px 22px;text-align:center}" +
    "#ck-wel .chk{width:56px;height:56px;border-radius:999px;background:rgba(224,149,42,.18);border:2px solid #E0952A;display:flex;align-items:center;justify-content:center;font-size:28px;color:#E0952A;margin:0 auto 12px}" +
    "#ck-wel .ty{font:700 1.35rem 'Fraunces',Georgia,serif;color:#fff;line-height:1.28}" +
    "#ck-wel .mob{margin-top:14px;display:inline-flex;align-items:center;gap:7px;background:rgba(251,244,232,.14);padding:8px 15px;border-radius:999px;font-size:.9rem;color:#FBF4E8}" +
    "#ck-wel .mob b{color:#fff}" +
    "#ck-wel .otp{margin-top:8px;display:inline-flex;align-items:center;gap:7px;background:rgba(224,149,42,.16);padding:7px 14px;border-radius:999px;font-size:.85rem;color:#5E1B22}" +
    "#ck-wel .otp b{color:#431016;letter-spacing:1px}" +
    "#ck-wel .already{display:inline-block;margin-bottom:12px;background:rgba(251,244,232,.16);border:1px solid rgba(241,203,134,.5);color:#F1CB86;padding:5px 13px;border-radius:999px;font-size:.72rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase}" +
    "#ck-wel .skipmsg{padding:14px 4px;text-align:center;font-size:.88rem;color:#5E1B22;font-weight:600}" +
    "#ck-wel .body{padding:18px 18px 6px}" +
    "#ck-wel .lead{font-size:.92rem;font-weight:700;color:#5E1B22;margin-bottom:13px}" +
    "#ck-wel .it{display:flex;align-items:center;gap:11px;font-size:.94rem;color:#431016;margin-bottom:12px}" +
    "#ck-wel .ic{width:34px;height:34px;flex:0 0 34px;border-radius:9px;background:#FBEFD8;display:flex;align-items:center;justify-content:center;font-size:17px}" +
    "#ck-wel .acts{padding:8px 18px 22px}" +
    "#ck-wel .allow{width:100%;background:#E0952A;color:#431016;border:none;border-radius:12px;padding:15px;font-size:1rem;font-weight:800;cursor:pointer}" +
    "#ck-wel .skip{width:100%;background:none;color:#7C6A55;border:none;padding:12px;font-size:.9rem;font-weight:600;cursor:pointer;margin-top:2px}" +
    // Hide the marketing footer entirely on the SMS page so the message list
    // isn't fighting it for space — this isn't the marketing site anymore.
    "body.ck-sms-mode footer{display:none}" +
    // Shrink the site's own sticky header on this page too — smaller logo,
    // tighter padding, smaller call/menu buttons — so it doesn't eat the
    // screen that used to also have the footer competing for space.
    "body.ck-sms-mode .topbar{padding:8px 0}" +
    "body.ck-sms-mode .brand img{height:32px}" +
    "body.ck-sms-mode .brand .iso{font-size:.62rem}" +
    "body.ck-sms-mode .menu-btn,body.ck-sms-mode .mcall{width:36px;height:36px;border-radius:9px}" +
    "body.ck-sms-mode .menu-btn svg,body.ck-sms-mode .mcall svg{width:19px;height:19px}";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(v) { var d = new Date(v); if (isNaN(d)) return ""; return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  function elem(h) { var d = document.createElement("div"); d.innerHTML = h.trim(); return d.firstChild; }

  var fab, ov, sheet, marketMain, smsBox, bar, welBox;

  function setPath(p) { try { if (location.pathname !== p) history.pushState({}, "", p); } catch (e) {} }
  function closeSiteMenu() { var h = document.querySelector("header"); if (h) h.classList.remove("nav-open"); }

  function ensureSmsBox() {
    if (smsBox) return;
    marketMain = document.querySelector("main#home") || document.querySelector("main");
    smsBox = document.createElement("main");
    smsBox.id = "ck-sms";
    smsBox.hidden = true;
    smsBox.addEventListener("click", onSmsClick);
    if (marketMain && marketMain.parentNode) marketMain.parentNode.insertBefore(smsBox, marketMain.nextSibling);
    else document.body.appendChild(smsBox);
  }

  // ---- login bottom sheet ----
  function openLogin() { renderLogin(); ov.classList.add("on"); }
  function closeLogin() { ov.classList.remove("on"); try { sessionStorage.setItem("ck_skip", "1"); } catch (e) {} }

  async function refreshMe() {
    try {
      var url = API.me + (st.date ? "?date=" + encodeURIComponent(st.date) : "");
      var r = await fetch(url, { credentials: "same-origin" });
      var d = await r.json();
      st.loggedIn = !!d.loggedIn; st.mobile = d.mobile || ""; st.name = d.name || ""; st.messages = d.messages || []; st.total = d.total || 0; st.profile = d.profile || {};
    } catch (e) { st.loggedIn = false; }
    if (fab) fab.textContent = st.loggedIn ? "My SMS" : "Login";
    injectMenu();
    checkNewSms();
  }
  // Detect a newer SMS (only when not date-filtered) and pop a browser notification.
  function checkNewSms() {
    if (st.date) return;
    var top = st.messages && st.messages[0];
    if (!top) return;
    if (st.lastTop === undefined) { st.lastTop = top.created_at; return; } // first load: baseline only
    if (top.created_at === st.lastTop) return;
    var prev = st.lastTop; st.lastTop = top.created_at;
    if (prev && top.created_at > prev) notifyNewSms(top);
  }
  function notifyNewSms(m) {
    // Foreground fallback: fires only while a tab is open. Real background push
    // (Chrome closed) is delivered by the FCM service worker, registered in askPush.
    if (st.fcmOn) return; // avoid a double notification when FCM is active
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      var n = new Notification("CHECKIN", { body: (m.message || "").slice(0, 120), tag: "ck-sms-" + m.id, icon: "/icon-192.png" });
      n.onclick = function () { try { window.focus(); } catch (e) {} openSmsHighlight(m.id); n.close(); };
    } catch (e) {}
  }
  function openSmsHighlight(ts) {
    st.hl = ts; st.view = "messages";
    // Same reasoning as the ?hl= cold-start path: always re-fetch unfiltered
    // so the message being jumped to is guaranteed to be in the list.
    if (st.date) {
      st.date = "";
      refreshMe().then(function () {
        if (document.body.classList.contains("ck-sms-mode")) renderSms(); else showSms("messages");
      });
    } else if (document.body.classList.contains("ck-sms-mode")) renderSms(); else showSms("messages");
  }
  function startPolling() {
    clearInterval(st.pollTimer);
    st.pollTimer = setInterval(function () { if (st.loggedIn && !document.hidden) refreshMe(); }, 90000);
  }
  async function sendOtp() {
    if (st.busy) return; st.busy = true; st.err = ""; renderLogin();
    try {
      var r = await fetch(API.send, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ mobile: st.mobile }) });
      var d = await r.json();
      if (!r.ok) st.err = d.error || "Could not send code."; else { st.dev = d.devCode || null; st.skip = !!d.skipVerification; st.step = "otp"; }
    } catch (e) { st.err = "Network error."; }
    st.busy = false; renderLogin();
  }
  async function verify() {
    if (st.busy) return; st.busy = true; st.err = ""; renderLogin();
    try {
      var r = await fetch(API.verify, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ mobile: st.mobile, code: st.code }) });
      var d = await r.json();
      if (!r.ok) { st.err = d.error || "Wrong code."; st.busy = false; renderLogin(); return; }
      st.busy = false; closeLogin(); await refreshMe(); showSms("messages");
      if (typeof Notification !== "undefined" && Notification.permission === "granted") askPush();
      else startPolling();
      setTimeout(showInstallBanner, 600);
    } catch (e) { st.err = "Network error."; st.busy = false; renderLogin(); }
  }
  // Password login — the fallback when OTP delivery isn't available. Same
  // shape as verify(), just a different endpoint/payload.
  async function passwordLogin() {
    if (st.busy) return; st.busy = true; st.err = ""; renderLogin();
    try {
      var r = await fetch(API.pwlogin, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ mobile: st.mobile, password: st.password }) });
      var d = await r.json();
      if (!r.ok) { st.err = d.error || "Wrong mobile number or password."; st.busy = false; renderLogin(); return; }
      st.busy = false; st.password = ""; closeLogin(); await refreshMe(); showSms("messages");
      if (typeof Notification !== "undefined" && Notification.permission === "granted") askPush();
      else startPolling();
      setTimeout(showInstallBanner, 600);
    } catch (e) { st.err = "Network error."; st.busy = false; renderLogin(); }
  }
  async function logout() {
    if (st.fcmToken) { try { await fetch(API.device, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ token: st.fcmToken }) }); } catch (e) {} }
    try { await fetch(API.logout, { method: "POST", credentials: "same-origin" }); } catch (e) {}
    clearInterval(st.pollTimer);
    st.loggedIn = false; st.step = "mobile"; st.mobile = ""; st.code = ""; st.password = ""; st.date = todayStr(); st.view = "messages"; st.lastTop = undefined; st.fcmOn = false; st.fcmToken = null;
    hideSms(); await refreshMe();
  }

  function renderLogin() {
    var h = '<div class="ckgrip"></div>';
    h += '<div class="ckban"><button class="ckx" data-a="closeLogin">✕</button><div class="ckbanrow"><div class="ckbadge">🔔</div><div><div style="font-weight:700">Login Now</div><div style="font-size:12px;opacity:.92">Login karke apne hotel messages &amp; alerts turant paayein ✨</div></div></div></div>';
    h += '<div class="ckh">Login with Mobile</div><div class="cksub">Hum aapke number par OTP bhejenge.</div>';
    if (st.step === "mobile") {
      var pwMode = !!(st.password && st.password.length);
      h += '<div class="ckrow"><span class="ckpre">🇮🇳 +91</span><input class="ckinp" id="ckmob" inputmode="numeric" maxlength="10" placeholder="Enter mobile number" value="' + esc(st.mobile) + '"></div>';
      h += '<input class="ckinp" id="ckpw" type="password" placeholder="Password (agar set ho) — optional" style="margin-top:8px" value="' + esc(st.password || "") + '">';
      if (st.err) h += '<div class="ckerr">' + esc(st.err) + "</div>";
      h += '<button class="ckbtn" id="ckmainbtn" data-a="' + (pwMode ? "pwlogin" : "send") + '"' + (st.busy ? " disabled" : "") + ">" + (st.busy ? (pwMode ? "Logging in…" : "Sending…") : (pwMode ? "Login →" : "Send OTP →")) + "</button>";
      h += '<button class="ckskip" data-a="closeLogin">Skip for now</button>';
    } else {
      h += '<div class="cksub" style="margin-bottom:8px">Code sent to <b>+91 ' + esc(st.mobile) + '</b> · <a href="#" data-a="back" style="color:#A9660F">Change</a></div>';
      if (st.skip) h += '<div class="ckinfo">SMS abhi connect nahi hai — koi bhi code chalega.' + (st.dev ? " Aapka code: <b>" + esc(st.dev) + "</b>" : "") + "</div>";
      h += '<input class="ckinp" id="ckcode" style="text-align:center;letter-spacing:.4em" inputmode="numeric" maxlength="6" placeholder="••••••" value="' + esc(st.code || "") + '">';
      if (st.err) h += '<div class="ckerr">' + esc(st.err) + "</div>";
      h += '<button class="ckbtn" data-a="verify"' + (st.busy ? " disabled" : "") + ">" + (st.busy ? "Verifying…" : "Verify & continue") + "</button>";
    }
    sheet.innerHTML = h;
    // Enter key submits, same as tapping the main button for that step.
    function onEnter(el, btn) { if (el) el.addEventListener("keydown", function (e) { if (e.key === "Enter" && btn) { e.preventDefault(); btn.click(); } }); }
    var mob = sheet.querySelector("#ckmob"); if (mob) mob.oninput = function () { st.mobile = this.value.replace(/\D/g, ""); };
    var cod = sheet.querySelector("#ckcode"); if (cod) { cod.oninput = function () { st.code = this.value.replace(/\D/g, ""); }; cod.focus(); }
    // Typing any character into the password field swaps "Send OTP" for
    // "Login" (and back) without a full re-render, so focus/cursor stays put.
    var pw = sheet.querySelector("#ckpw");
    var mainBtn = sheet.querySelector("#ckmainbtn");
    if (pw) pw.oninput = function () {
      st.password = this.value;
      if (!mainBtn || st.busy) return;
      var has = st.password.length > 0;
      mainBtn.setAttribute("data-a", has ? "pwlogin" : "send");
      mainBtn.textContent = has ? "Login →" : "Send OTP →";
    };
    onEnter(mob, mainBtn);
    onEnter(pw, mainBtn);
    onEnter(cod, sheet.querySelector('[data-a="verify"]'));
  }
  function onSheetClick(e) {
    var t = e.target.closest("[data-a]"); if (!t) return; e.preventDefault();
    var a = t.getAttribute("data-a");
    if (a === "closeLogin") closeLogin();
    else if (a === "send") { if ((st.mobile || "").length >= 8) sendOtp(); else { st.err = "Sahi mobile number daalein."; renderLogin(); } }
    else if (a === "verify") verify();
    else if (a === "pwlogin") { if ((st.mobile || "").length >= 8 && st.password) passwordLogin(); else { st.err = "Mobile number aur password dono daalein."; renderLogin(); } }
    else if (a === "back") { st.step = "mobile"; st.code = ""; st.err = ""; renderLogin(); }
  }

  // ---- magic-link welcome landing (thank-you + notification opt-in) ----
  function ensureWelBox() {
    if (welBox) return;
    if (!marketMain) marketMain = document.querySelector("main#home") || document.querySelector("main");
    welBox = document.createElement("main");
    welBox.id = "ck-wel";
    welBox.hidden = true;
    welBox.addEventListener("click", onWelClick);
    if (marketMain && marketMain.parentNode) marketMain.parentNode.insertBefore(welBox, marketMain.nextSibling);
    else document.body.appendChild(welBox);
  }
  function showWelcome(hotel, otp, already) {
    ensureWelBox();
    st.welHotel = hotel || "";
    st.welOtp = otp || "";
    st.welAlready = !!already;
    if (marketMain) marketMain.hidden = true;
    if (smsBox) smsBox.hidden = true;
    if (bar) bar.classList.remove("on");
    welBox.hidden = false;
    document.body.classList.add("ck-sms-mode");
    var q = []; if (hotel) q.push("h=" + encodeURIComponent(hotel)); if (otp) q.push("otp=" + encodeURIComponent(otp)); if (already) q.push("already=1");
    setPath("/welcome" + (q.length ? "?" + q.join("&") : ""));
    try { window.scrollTo(0, 0); } catch (e) {}
    renderWelcome();
    try { document.documentElement.classList.remove("ck-sms-boot"); } catch (e) {}
  }
  function hideWelcome() {
    if (welBox) welBox.hidden = true;
    document.body.classList.remove("ck-sms-mode");
  }
  function renderWelcome() {
    if (!welBox) return;
    var hotel = st.welHotel ? esc(st.welHotel) : ("+91 " + esc(mob10())); // no hotel tag on this link — show the guest's own number instead
    var items = [
      ["🔔", "Room rate / tariff & offers"],
      ["🛎️", "Check-in & Check-out updates"],
      ["🍽️", "F&B order & KOT status"],
      ["🧾", "Bill & payment receipt"],
      ["✨", "Har activity ka update"]
    ];
    var li = "";
    items.forEach(function (x) { li += '<div class="it"><span class="ic">' + x[0] + '</span>' + esc(x[1]) + "</div>"; });
    welBox.innerHTML =
      '<div class="card">' +
        '<div class="hero">' +
          (st.welAlready ? '<div class="already">Already logged in</div>' : "") +
          '<div class="chk">✓</div>' +
          '<div class="ty">Thank you for choosing<br>' + hotel + "</div>" +
          '<div class="mob">📱 Logged in as <b>+91 ' + esc(mob10()) + "</b></div>" +
          (st.welOtp ? '<div class="otp">🔐 OTP <b>' + esc(st.welOtp) + "</b></div>" : "") +
        "</div>" +
        '<div class="body"><div class="lead">Aapko in sab ka notification milega:</div>' + li + "</div>" +
        '<div class="acts">' +
          '<button class="allow" data-a="allow">🔔 Allow Notifications</button>' +
          '<button class="skip" data-a="skip">Skip for now</button>' +
        "</div>" +
      "</div>";
  }
  function welToSms() { hideWelcome(); showSms("messages"); }
  function onWelClick(e) {
    var t = e.target.closest("[data-a]"); if (!t) return;
    var a = t.getAttribute("data-a");
    if (a === "allow") { askPush().then(welToSms, welToSms); }
    else if (a === "skip") {
      var acts = welBox && welBox.querySelector(".acts");
      if (acts) acts.innerHTML = '<div class="skipmsg">Aapne skip kar diya hai — ab is number par koi notification nahi aayega.</div>';
      setTimeout(welToSms, 1500);
    }
  }

  // ---- in-page SMS section ----
  function showSms(view) {
    ensureSmsBox();
    st.view = view || "messages";
    if (marketMain) marketMain.hidden = true;
    smsBox.hidden = false;
    if (bar) bar.classList.add("on");
    document.body.classList.add("ck-sms-mode");
    setPath("/sms");
    try { window.scrollTo(0, 0); } catch (e) {}
    renderSms();
  }
  function hideSms() {
    if (marketMain) marketMain.hidden = false;
    if (smsBox) smsBox.hidden = true;
    if (bar) bar.classList.remove("on");
    document.body.classList.remove("ck-sms-mode");
    setPath("/");
  }
  function renderSms() {
    if (!smsBox) return;
    syncHeaderH(); // header shrinks in ck-sms-mode; keep the sticky offset in sync
    smsBox.innerHTML = st.view === "edit" ? editHtml() : pageHtml();
    var dt = smsBox.querySelector("#cksmsdate"); if (dt) dt.onchange = function () { st.date = this.value; refreshMe().then(renderSms); };
    if (st.hl && st.view !== "edit") {
      var hc = smsBox.querySelector(".card.hl");
      if (hc) {
        try { hc.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {}
        var t = st.hl;
        clearTimeout(st.hlTimer);
        st.hlTimer = setTimeout(function () { if (st.hl === t) { st.hl = ""; renderSms(); } }, 5000);
      }
    }
  }
  function mob10() { return (st.mobile || "").replace(/^\+?91/, ""); }
  function dateLabel(v) { var d = new Date(v); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  function pageHtml() {
    var count = st.date ? st.messages.length : st.total;
    var dateSuffix = st.date ? ' <span class="ttldate">· ' + esc(dateLabel(st.date)) + "</span>" : "";
    var h = '<div class="sticktop">';
    h += '<div class="top"><span class="ttl">Total SMS - ' + count + dateSuffix + '</span><span class="num">+91 ' + esc(mob10()) + "</span></div>";
    h += '<div class="filt"><input class="dt" type="date" id="cksmsdate" value="' + esc(st.date) + '"><button class="rf" data-a="refresh" title="Refresh">⟳</button></div>';
    if (st.date) h += '<button class="clr" data-a="clear">Clear Filters</button>';
    h += "</div>";
    if (!st.messages.length) h += '<div class="empty">Koi SMS nahi mila.' + (st.date ? " (is date par)" : "") + "</div>";
    st.messages.forEach(function (m) {
      var isHl = st.hl && String(m.id) === String(st.hl);
      h += '<div class="card' + (isHl ? " hl" : "") + '" data-id="' + esc(String(m.id || "")) + '">' + (isHl ? '<span class="nb">New</span>' : "") + "<p>" + esc(m.message) + "</p><small>" + esc(fmt(m.created_at)) + "</small></div>";
    });
    return h;
  }
  function editHtml() {
    var p = st.profile || {}, titles = ["", "Mr.", "Mrs.", "Ms.", "Dr."], mm = [], dd = [], yy = [];
    for (var i = 1; i <= 12; i++) mm.push(("0" + i).slice(-2));
    for (var j = 1; j <= 31; j++) dd.push(("0" + j).slice(-2));
    for (var y = new Date().getFullYear(); y >= 1940; y--) yy.push("" + y);
    var dob = (p.dob || "").split("-"), cy = dob[0] || "", cm = dob[1] || "", cd = dob[2] || "";
    function opts(arr, cur, ph) { var s = '<option value="">' + ph + "</option>"; arr.forEach(function (v) { if (v) s += '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + v + "</option>"; }); return s; }
    var h = '<div class="top"><h1>Edit Profile</h1><button class="back" data-a="tomsg">← Back</button></div><div class="form">';
    h += '<div class="fld"><select class="ckinp" id="pt">';
    titles.forEach(function (t) { h += '<option value="' + t + '"' + (t === (p.title || "") ? " selected" : "") + ">" + (t || "Title") + "</option>"; });
    h += "</select></div>";
    h += '<div class="ckrow"><input class="ckinp" id="pf" placeholder="First Name" value="' + esc(p.firstName || "") + '"><input class="ckinp" id="pl" placeholder="Last Name" value="' + esc(p.lastName || "") + '"></div>';
    h += '<input class="ckinp" id="pe" style="margin-top:10px" type="email" placeholder="Email Address" value="' + esc(p.email || "") + '">';
    h += '<div class="ckrow" style="margin-top:10px"><span class="ckpre">🇮🇳 +91</span><input class="ckinp" value="' + esc(mob10()) + '" disabled></div>';
    h += '<div class="cklbl">Date of Birth</div>';
    h += '<div class="ckrow"><select class="ckinp" id="pm">' + opts(mm, cm, "MM") + '</select><select class="ckinp" id="pd">' + opts(dd, cd, "DD") + '</select><select class="ckinp" id="py">' + opts(yy, cy, "YYYY") + "</select></div>";
    if (st.err) h += '<div class="ckerr">' + esc(st.err) + "</div>";
    h += '<button class="ckbtn" style="background:#E0952A;color:#431016;margin-top:16px" data-a="savep">Save Profile</button>';
    h += '<div class="cklbl" style="margin-top:18px">Password</div>';
    h += '<div class="cksub" style="margin:0 0 8px">Set kar lo to jab kabhi OTP na aaye, isi se login ho sakega.</div>';
    h += '<input class="ckinp" id="ppw" type="password" placeholder="Naya password">';
    if (st.pwMsg) h += '<div style="color:#2e7d32;font-size:13px;margin-top:6px">' + esc(st.pwMsg) + "</div>";
    h += '<button class="ckbtn" style="background:#fff;color:#5E1B22;border:1px solid #E7D9BF;margin-top:10px" data-a="savepw">Save Password</button>';
    h += '<button class="ckbtn" style="background:#fff;color:#b3261e;border:1px solid #e6a9a9;margin-top:10px" data-a="logout">Logout</button></div>';
    return h;
  }
  function onSmsClick(e) {
    var t = e.target.closest("[data-a]"); if (!t) return; e.preventDefault();
    var a = t.getAttribute("data-a");
    if (a === "home") hideSms();
    else if (a === "refresh") refreshMe().then(renderSms);
    else if (a === "clear") { st.date = ""; refreshMe().then(renderSms); }
    else if (a === "tomsg") { st.view = "messages"; renderSms(); }
    else if (a === "editprofile") { st.view = "edit"; renderSms(); }
    else if (a === "logout") logout();
    else if (a === "savep") saveProfileForm();
    else if (a === "savepw") savePasswordForm();
  }
  async function saveProfileForm() {
    var g = function (id) { var e = smsBox.querySelector("#" + id); return e ? e.value : ""; };
    var mm = g("pm"), dd = g("pd"), yy = g("py"), dob = (yy && mm && dd) ? yy + "-" + mm + "-" + dd : "";
    var body = { title: g("pt"), firstName: g("pf"), lastName: g("pl"), email: g("pe"), dob: dob };
    st.err = "";
    try {
      var r = await fetch("/api/user/profile", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
      var d = await r.json();
      if (!r.ok) { st.err = d.error || "Save failed."; renderSms(); return; }
      await refreshMe(); st.view = "messages"; renderSms();
    } catch (e) { st.err = "Network error."; renderSms(); }
  }
  async function savePasswordForm() {
    var g = function (id) { var e = smsBox.querySelector("#" + id); return e ? e.value : ""; };
    var pw = g("ppw");
    st.err = ""; st.pwMsg = "";
    if (pw.length < 4) { st.err = "Password kam se kam 4 characters ka ho."; renderSms(); return; }
    try {
      var r = await fetch(API.setpw, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ password: pw }) });
      var d = await r.json();
      if (!r.ok) { st.err = d.error || "Save failed."; renderSms(); return; }
      st.pwMsg = "Password set ho gaya."; renderSms();
    } catch (e) { st.err = "Network error."; renderSms(); }
  }

  // ---- site menu integration ----
  // Load a script once, resolving when ready.
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error("load failed: " + src)); };
      document.head.appendChild(s);
    });
  }
  var FB = "https://www.gstatic.com/firebasejs/10.14.1/";
  // Registers this browser for real background push via FCM so notifications
  // arrive even when Chrome is closed. Falls back to in-page notifications when
  // Firebase isn't configured or the browser can't do push.
  async function askPush() {
    if (typeof Notification === "undefined") { alert("Is browser me notifications support nahi."); return; }
    var cfg = null;
    try { cfg = await (await fetch(API.pushCfg, { credentials: "same-origin" })).json(); } catch (e) {}

    var perm = Notification.permission;
    if (perm !== "granted") { try { perm = await Notification.requestPermission(); } catch (e) {} }
    if (perm !== "granted") {
      st.push = false; injectMenu();
      if (perm === "denied") alert("Notifications block hain. Address bar ke lock icon → Permissions → Notifications → Allow karke reload karein.");
      return;
    }
    st.push = true; injectMenu();

    // Real background push needs Firebase config + service worker support.
    if (!cfg || !cfg.configured || !("serviceWorker" in navigator)) { startPolling(); return; }
    try {
      var params = new URLSearchParams({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId });
      var reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js?" + params.toString(), { scope: "/" });
      await loadScript(FB + "firebase-app-compat.js");
      await loadScript(FB + "firebase-messaging-compat.js");
      var fb = window.firebase;
      if (!fb.apps.length) fb.initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, messagingSenderId: cfg.messagingSenderId, appId: cfg.appId });
      var messaging = fb.messaging();
      var token = await messaging.getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
      if (token) {
        await fetch(API.device, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ token: token }) });
        st.fcmOn = true; st.fcmToken = token;
        // While a tab is open FCM delivers here instead of the SW.
        messaging.onMessage(function (payload) {
          var d = (payload && payload.data) || {};
          var note = (payload && payload.notification) || {};
          if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              var n = new Notification(note.title || "CHECKIN", { body: note.body || "", tag: "ck-sms-" + (d.smsId || ""), icon: "/icon-192.png" });
              n.onclick = function () { try { window.focus(); } catch (e) {} if (d.smsId) openSmsHighlight(d.smsId); n.close(); };
            } catch (e) {}
          } else if (d.smsId) {
            refreshMe().then(function () { openSmsHighlight(d.smsId); });
          }
        });
      }
    } catch (e) { startPolling(); } // FCM failed — keep the foreground fallback
  }
  function ckNav(a) {
    if (a === "push") { askPush(); return; }
    if (a === "install") { doInstall(); return; }
    closeSiteMenu();
    if (a === "dologin") { if (st.loggedIn) showSms("messages"); else { st.step = "mobile"; st.password = ""; openLogin(); } }
    else if (a === "sms") { if (st.loggedIn) showSms("messages"); else { st.step = "mobile"; st.password = ""; openLogin(); } }
    else if (a === "editprofile") { if (st.loggedIn) showSms("edit"); else openLogin(); }
    else if (a === "logout") logout();
  }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent || ""); }
  function isStandalone() {
    try { return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; }
  }
  // Add-to-Home-Screen: Android/Chrome uses the captured beforeinstallprompt;
  // iOS Safari has no such API, so we show the manual Share → Add steps.
  async function doInstall() {
    if (st.installPrompt) {
      closeSiteMenu();
      try { st.installPrompt.prompt(); await st.installPrompt.userChoice; } catch (e) {}
      st.installPrompt = null; injectMenu();
    } else if (isIOS()) {
      alert("iPhone par install karne ke liye: Safari me neeche Share button (⬆️) dabayein → 'Add to Home Screen' chunein.");
    } else {
      alert("Is browser ke menu (⋮) me 'Install app' ya 'Add to Home screen' option se install karein.");
    }
  }
  var installBox;
  function installDismissed() { try { return sessionStorage.getItem("ck_install_x") === "1"; } catch (e) { return false; } }
  function showInstallBanner() {
    if (isStandalone() || installDismissed() || (installBox && !installBox.hidden)) return;
    if (!st.installPrompt && !isIOS()) return; // no install path available on this browser
    if (!installBox) {
      installBox = elem(
        '<div id="ck-install"><img src="/icon-192.png" alt=""><div class="txt"><b>CHECKIN install karein</b><span>' +
          (isIOS() ? "Share ⬆️ → Add to Home Screen" : "Home screen se seedha messages dekhein") +
          '</span></div><div class="btns">' +
          (isIOS() ? "" : '<button class="go" data-a="go">Install</button>') +
          '<button class="x" data-a="x">✕</button></div></div>'
      );
      installBox.addEventListener("click", function (e) {
        var t = e.target.closest("[data-a]"); if (!t) return;
        if (t.getAttribute("data-a") === "go") doInstall();
        hideInstallBanner(true);
      });
      document.body.appendChild(installBox);
    }
    installBox.hidden = false;
  }
  function hideInstallBanner(dismiss) {
    if (installBox) installBox.hidden = true;
    if (dismiss) { try { sessionStorage.setItem("ck_install_x", "1"); } catch (e) {} }
  }
  function injectMenu() {
    var nav = document.querySelector("nav.main");
    var ul = nav ? nav.querySelector("ul") : null;
    if (!nav || !ul) return;
    if (typeof Notification !== "undefined") st.push = Notification.permission === "granted";
    // Profile block placement: desktop -> header next to the phone (.hactions);
    // mobile -> drawer header (nav.main, above Home).
    var desktop = false; try { desktop = window.matchMedia("(min-width: 821px)").matches; } catch (e) {}
    var hact = document.querySelector(".hactions");
    var prof = document.querySelector(".ck-prof");
    if (!prof) { prof = document.createElement("div"); prof.className = "ck-prof"; }
    if (desktop && hact) {
      if (prof.parentNode !== hact) hact.insertBefore(prof, hact.querySelector(".mcall"));
    } else {
      if (prof.parentNode !== nav) nav.insertBefore(prof, ul);
    }
    if (st.loggedIn) {
      prof.className = "ck-prof";
      prof.innerHTML = '<div class="ck-av" data-cka="editprofile">👤</div><div class="ck-pi"><div class="ck-pn">' + esc(st.name || "User") + '</div><div class="ck-pm">+91 ' + esc(mob10()) + '</div></div><button class="ck-ep" data-cka="editprofile" aria-label="Edit Profile" title="Edit Profile">✎</button>';
    } else {
      prof.className = "ck-prof guest";
      prof.innerHTML = '<div class="ck-av" data-cka="dologin">👤</div><div class="ck-pn">Guest</div><button class="ck-ep" data-cka="dologin">Login / Sign in</button>';
    }
    Array.prototype.slice.call(prof.querySelectorAll("[data-cka]")).forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); ckNav(b.getAttribute("data-cka")); });
    });
    // Menu list items (Edit Profile is now the top profile block).
    Array.prototype.slice.call(ul.querySelectorAll("li.ck-li")).forEach(function (x) { x.remove(); });
    var items = st.loggedIn
      ? [{ t: "My SMS Notifications", a: "sms" }, { t: "Push Notification", a: "push", sw: st.push ? "on" : "" }, { t: "Logout", a: "logout" }]
      : [{ t: "My SMS / Login", a: "dologin" }];
    // Add-to-Home / Install — only when the app can be installed and isn't already.
    if (!isStandalone() && (st.installPrompt || isIOS())) {
      var pos = st.loggedIn ? items.length - 1 : items.length; // before Logout when present
      items.splice(pos, 0, { t: "📲 Add to Home Screen", a: "install" });
    }
    items.forEach(function (it) {
      var li = document.createElement("li"); li.className = "ck-li";
      var a = document.createElement("a"); a.href = "#"; a.className = "ck-navitem";
      a.innerHTML = esc(it.t) + (it.sw !== undefined ? '<span class="ck-sw ' + it.sw + '"></span>' : "");
      a.addEventListener("click", function (e) { e.preventDefault(); ckNav(it.a); });
      li.appendChild(a); ul.appendChild(li);
    });
  }

  function fabClick() { if (st.loggedIn) showSms("messages"); else { st.step = "mobile"; st.password = ""; openLogin(); } }

  // The site's own <header> is position:sticky and its height varies (nav
  // wraps at some widths), so the SMS page's sticky Total/date bar needs to
  // sit right below it, not underneath it — track that height in a CSS var.
  function syncHeaderH() {
    var h = document.querySelector("header");
    try { document.documentElement.style.setProperty("--ck-hh", (h ? h.offsetHeight : 0) + "px"); } catch (e) {}
  }

  function boot() {
    var s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);
    syncHeaderH();
    window.addEventListener("load", syncHeaderH);
    window.addEventListener("resize", syncHeaderH);
    // Shadow/border on the sticky Total bar once the page has scrolled under it.
    window.addEventListener("scroll", function () {
      if (!document.body.classList.contains("ck-sms-mode")) return;
      document.body.classList.toggle("ck-stuck", window.scrollY > 30);
    }, { passive: true });
    // Capture the install prompt so the drawer can offer "Add to Home Screen".
    window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); st.installPrompt = e; injectMenu(); showInstallBanner(); });
    window.addEventListener("appinstalled", function () { st.installPrompt = null; injectMenu(); hideInstallBanner(false); });
    // iOS never fires beforeinstallprompt — there's no programmatic trigger,
    // just the manual Share -> Add to Home Screen steps — so show the banner
    // proactively there instead of waiting for an event that'll never come.
    if (isIOS() && !isStandalone()) setTimeout(showInstallBanner, 1200);
    // Re-place the profile block (header vs drawer) when crossing the breakpoint.
    try { var mq = window.matchMedia("(min-width: 821px)"); (mq.addEventListener ? mq.addEventListener("change", injectMenu) : mq.addListener(injectMenu)); } catch (e) {}
    ov = elem('<div id="ckov"><div id="cksheet"></div></div>');
    sheet = ov.querySelector("#cksheet");
    document.body.appendChild(ov);
    ensureSmsBox();
    ensureWelBox();
    bar = elem('<div id="ck-bar"><button data-a="barback">← Back</button><button class="pri" data-a="home">🏠 Home</button></div>');
    document.body.appendChild(bar);
    bar.addEventListener("click", function (e) {
      var t = e.target.closest("[data-a]"); if (!t) return;
      var a = t.getAttribute("data-a");
      if (a === "home") hideSms();
      else if (a === "barback") { if (st.view === "edit") { st.view = "messages"; renderSms(); } else hideSms(); }
    });
    ov.onclick = function (e) { if (e.target === ov) closeLogin(); };
    sheet.addEventListener("click", onSheetClick);
    // Logo = Home (also leaves the SMS page).
    var brand = document.querySelector(".brand");
    if (brand) { brand.style.cursor = "pointer"; brand.addEventListener("click", function () { if (smsBox && !smsBox.hidden) hideSms(); try { window.scrollTo(0, 0); } catch (e) {} }); }
    // A real site nav link (Home/About/…) while on the SMS page -> show the site first.
    var nav = document.querySelector("nav.main");
    if (nav) nav.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (a && !a.classList.contains("ck-navitem")) {
        if (smsBox && !smsBox.hidden) hideSms();
        if (welBox && !welBox.hidden) { hideWelcome(); if (marketMain) marketMain.hidden = false; }
      }
    });
    window.addEventListener("popstate", function () {
      if (location.pathname === "/welcome") { if (st.loggedIn) { var wh = "", wo = "", wa = ""; try { var wu = new URL(location.href); wh = wu.searchParams.get("h") || ""; wo = wu.searchParams.get("otp") || ""; wa = wu.searchParams.get("already") || ""; } catch (e) {} showWelcome(wh, wo, wa === "1"); } }
      else if (location.pathname === "/sms") { if (st.loggedIn) showSms("messages"); }
      else { hideWelcome(); hideSms(); }
    });
    // On a /sms deep-link, hide the marketing home immediately (before the login
    // check finishes) so the guest never sees a flash of the home page first.
    var onSmsPath = location.pathname === "/sms";
    var onWelPath = location.pathname === "/welcome";
    if (onSmsPath || onWelPath) {
      if (marketMain) marketMain.hidden = true;
      document.body.classList.add("ck-sms-mode");
      if (onSmsPath) {
        smsBox.hidden = false;
        smsBox.innerHTML = '<div class="empty">Loading…</div>';
        if (bar) bar.classList.add("on");
      }
      try { window.scrollTo(0, 0); } catch (e) {}
    }
    // JS now controls home visibility via marketMain.hidden — drop the first-paint guard.
    try { document.documentElement.classList.remove("ck-sms-boot"); } catch (e) {}
    // A notification/deep-link (?hl=) must always find its message, even if
    // it landed just past local midnight and today's date-filter (server
    // side, not timezone-aware) would otherwise exclude it — so the very
    // first fetch on a /sms?hl=... load goes out unfiltered.
    try { if (new URL(location.href).searchParams.get("hl")) st.date = ""; } catch (e) {}
    refreshMe().then(function () {
      var skipped = false; try { skipped = sessionStorage.getItem("ck_skip") === "1"; } catch (e) {}
      // Deep-link from a notification: /sms?hl=<created_at> highlights that SMS.
      var hlq = ""; try { hlq = new URL(location.href).searchParams.get("hl") || ""; } catch (e) {}
      if (hlq && st.loggedIn) st.hl = hlq;
      var welHotel = "", welOtp = "", welAlready = ""; try { var wlu = new URL(location.href); welHotel = wlu.searchParams.get("h") || ""; welOtp = wlu.searchParams.get("otp") || ""; welAlready = wlu.searchParams.get("already") || ""; } catch (e) {}
      if (onWelPath) { if (st.loggedIn) showWelcome(welHotel, welOtp, welAlready === "1"); else { if (marketMain) marketMain.hidden = false; document.body.classList.remove("ck-sms-mode"); openLogin(); } }
      else if (onSmsPath) { if (st.loggedIn) showSms("messages"); else { hideSms(); openLogin(); } }
      else if (!st.loggedIn && !skipped) setTimeout(openLogin, 700);
      if (st.loggedIn) {
        // Push-enabled guests don't need the poll loop running too — askPush()
        // falls back to startPolling() itself if FCM isn't actually available.
        if (typeof Notification !== "undefined" && Notification.permission === "granted") askPush();
        else startPolling();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
