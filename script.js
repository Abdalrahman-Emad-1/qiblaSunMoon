// Constants
const MAKKAH_LAT = 21.422487;
const MAKKAH_LNG = 39.826206;

// State
let state = {
    lang: 'en',
    mode: 'sun', // 'sun', 'moon', 'qibla'
    lat: null,
    lng: null,
    heading: 0, // Current device heading
    targetAngle: 0, // Angle of the target relative to North
    hasPermission: false
};

// Translations
const i18n = {
    en: {
        title: "Sky & Qibla Finder",
        sunBtn: "Sun Direction",
        moonBtn: "Moon Direction",
        qiblaBtn: "Qibla Direction",
        requestAccess: "Start & Calibrate",
        overlayTitle: "Compass Access Required",
        overlayDesc: "We need location and orientation access to show directions accurately.",
        loadingLocation: "Getting Location...",
        needCalibration: "Please move your phone in a figure 8",
        langToggle: "عربي",
        locationError: "Location access denied. Please enable GPS.",
        orientationError: "Device orientation not supported.",
        ready: "Point your phone to find the target!",
        sunLabel: "Sun",
        moonLabel: "Moon",
        qiblaLabel: "Qibla"
    },
    ar: {
        title: "الباحث عن السماء والقبلة",
        sunBtn: "اتجاه الشمس",
        moonBtn: "اتجاه القمر",
        qiblaBtn: "اتجاه القبلة",
        requestAccess: "البدء ومعايرة البوصلة",
        overlayTitle: "مطلوب الوصول للبوصلة",
        overlayDesc: "نحتاج للوصول إلى الموقع والاتجاه لإظهار الاتجاهات بدقة.",
        loadingLocation: "جاري تحديد الموقع...",
        needCalibration: "يرجى تحريك الهاتف على شكل رقم 8 للمعايرة",
        langToggle: "English",
        locationError: "تم رفض الوصول للموقع. يرجى تفعيل الـ GPS.",
        orientationError: "مستشعر الاتجاه غير مدعوم في هذا الجهاز.",
        ready: "وجه هاتفك للعثور على الهدف!",
        sunLabel: "الشمس",
        moonLabel: "القمر",
        qiblaLabel: "القبلة"
    }
};

// Icons (Iconify URLs)
const icons = {
    sun: "https://api.iconify.design/lucide:sun.svg?color=white",
    moon: "https://api.iconify.design/lucide:moon.svg?color=white",
    qibla: "https://api.iconify.design/lucide:box.svg?color=white"
};

// DOM Elements
const el = {
    body: document.body,
    compassCircle: document.getElementById('compass-circle'),
    orbitingContainer: document.getElementById('orbiting-container'),
    targetIcon: document.getElementById('target-icon'),
    iconImg: document.getElementById('icon-img'),
    statusMsg: document.getElementById('status-msg'),
    debugInfo: document.getElementById('debug-info'),
    permissionOverlay: document.getElementById('permission-overlay'),
    startBtn: document.getElementById('start-btn'),
    langBtn: document.getElementById('lang-btn'),
    appTitle: document.getElementById('app-title'),
    btnSun: document.getElementById('btn-sun'),
    btnMoon: document.getElementById('btn-moon'),
    btnQibla: document.getElementById('btn-qibla'),
    btnTextSun: document.getElementById('btn-text-sun'),
    btnTextMoon: document.getElementById('btn-text-moon'),
    btnTextQibla: document.getElementById('btn-text-qibla'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayDesc: document.getElementById('overlay-desc'),
    targetLabel: document.getElementById('target-label')
};

// Initialize
function init() {
    updateLanguage();
    setupEventListeners();
}

function setupEventListeners() {
    el.langBtn.addEventListener('click', toggleLanguage);
    el.startBtn.addEventListener('click', requestPermissions);

    el.btnSun.addEventListener('click', () => setMode('sun'));
    el.btnMoon.addEventListener('click', () => setMode('moon'));
    el.btnQibla.addEventListener('click', () => setMode('qibla'));
}

// Translations and UI
function toggleLanguage() {
    state.lang = state.lang === 'en' ? 'ar' : 'en';
    el.body.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
    updateLanguage();
}

function updateLanguage() {
    const t = i18n[state.lang];
    el.appTitle.textContent = t.title;
    el.btnTextSun.textContent = t.sunBtn;
    el.btnTextMoon.textContent = t.moonBtn;
    el.btnTextQibla.textContent = t.qiblaBtn;
    el.startBtn.textContent = t.requestAccess;
    el.langBtn.textContent = t.langToggle;
    el.overlayTitle.textContent = t.overlayTitle;
    el.overlayDesc.textContent = t.overlayDesc;
    el.targetLabel.textContent = t[state.mode + 'Label'];

    if (!state.hasPermission) {
        el.statusMsg.textContent = state.lang === 'en' ? "Waiting for permission..." : "في انتظار الإذن...";
    } else {
        el.statusMsg.textContent = t.ready;
    }
}

function setMode(mode) {
    state.mode = mode;

    // Update active button
    [el.btnSun, el.btnMoon, el.btnQibla].forEach(btn => btn.classList.remove('active'));
    if (mode === 'sun') el.btnSun.classList.add('active');
    if (mode === 'moon') el.btnMoon.classList.add('active');
    if (mode === 'qibla') el.btnQibla.classList.add('active');

    // Update body theme class
    el.body.className = `theme-${mode}`;

    // Update icon and label
    el.iconImg.src = icons[mode];
    el.targetLabel.textContent = i18n[state.lang][`${mode}Label`];

    // Recalculate if we have location
    if (state.lat && state.lng) {
        calculateTargetAngle();
        updateUI();
    }
}

// Permissions and Sensors
async function requestPermissions() {
    el.statusMsg.textContent = i18n[state.lang].loadingLocation;

    try {
        // Request Location
        await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation not supported"));
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    state.lat = pos.coords.latitude;
                    state.lng = pos.coords.longitude;
                    resolve();
                },
                (err) => reject(err),
                { enableHighAccuracy: true }
            );
        });

        // Request Orientation (iOS 13+ requires user interaction)
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') {
                throw new Error("Orientation permission denied");
            }
        }

        // Add Listener
        window.addEventListener('deviceorientation', handleOrientation, true);

        // Success
        state.hasPermission = true;
        el.permissionOverlay.classList.remove('active');
        el.statusMsg.textContent = i18n[state.lang].ready;

        // Initial Calculation
        calculateTargetAngle();

    } catch (error) {
        console.error("Permission error:", error);
        el.statusMsg.textContent = error.message.includes("location") || error.code === 1
            ? i18n[state.lang].locationError
            : i18n[state.lang].orientationError;
    }
}

function handleOrientation(event) {
    let heading = 0;

    // iOS provides absolute heading
    if (event.webkitCompassHeading) {
        heading = event.webkitCompassHeading;
    }
    // Android (usually event.alpha is absolute if absolute listener is used, or fallback)
    else if (event.absolute && event.alpha !== null) {
        heading = 360 - event.alpha; // Android compass goes counter-clockwise
    } else if (event.alpha !== null) {
        // Fallback (may not be true North without absolute)
        heading = 360 - event.alpha;
    } else {
        return; // No data
    }

    state.heading = heading;
    updateUI();
}

// Calculations
function calculateTargetAngle() {
    if (!state.lat || !state.lng) return;

    if (state.mode === 'qibla') {
        state.targetAngle = getQibla(state.lat, state.lng);
    }
    else if (state.mode === 'sun' || state.mode === 'moon') {
        if (typeof SunCalc !== 'undefined') {
            const date = new Date();
            if (state.mode === 'sun') {
                const pos = SunCalc.getPosition(date, state.lat, state.lng);
                // SunCalc azimuth is relative to South (0), North is Math.PI, East is Math.PI/2 relative to South? 
                // Suncalc docs: azimuth: sun azimuth in radians (direction along the horizon, measured from south to west), e.g. 0 is south and Math.PI * 3/4 is northwest
                // Let's convert to North-based degrees (0 is North, 90 is East)
                // azimuth from south to west. So South = 0. West = 90. North = 180. East = 270.
                let azimuthDeg = (pos.azimuth * 180) / Math.PI; // South = 0, West = 90, North = 180
                state.targetAngle = (azimuthDeg + 180) % 360; // Convert to North=0, East=90, South=180, West=270
            } else { // Moon
                const pos = SunCalc.getMoonPosition(date, state.lat, state.lng);
                let azimuthDeg = (pos.azimuth * 180) / Math.PI;
                state.targetAngle = (azimuthDeg + 180) % 360;
            }
        }
    }

    el.debugInfo.textContent = `T: ${state.mode.toUpperCase()} ${Math.round(state.targetAngle)}° | H: ${Math.round(state.heading)}°`;
}

function getQibla(lat, lng) {
    // Math to calculate great-circle bearing to Makkah
    const toRad = deg => (deg * Math.PI) / 180;
    const toDeg = rad => (rad * 180) / Math.PI;

    const phiK = toRad(MAKKAH_LAT);
    const lambdaK = toRad(MAKKAH_LNG);
    const phi = toRad(lat);
    const lambda = toRad(lng);

    const y = Math.sin(lambdaK - lambda);
    const x = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda);

    let qiblaRad = Math.atan2(y, x);
    let qiblaDeg = toDeg(qiblaRad);

    return (qiblaDeg + 360) % 360; // Normalize 0-360
}

// Update UI
function updateUI() {
    if (!state.hasPermission) return;

    // Rotate the whole compass to reflect true North pointing up based on device heading
    // If heading is 90 (East), North is rotated -90 degrees.
    const compassRotation = -state.heading;
    el.compassCircle.style.transform = `rotate(${compassRotation}deg)`;

    // Keep letters (N, E, S, W) pointing upright
    const marks = document.querySelectorAll('.compass-mark');
    marks.forEach(mark => {
        mark.style.transform = `translate(-50%, -50%) rotate(${-compassRotation}deg)`;
    });

    // The target icon container must be rotated to the target angle relative to North
    el.orbitingContainer.style.transform = `rotate(${state.targetAngle}deg)`;

    // But the icon itself should remain upright relative to the screen
    // Screen rotation of icon = compassRotation + targetAngle. So counter-rotate by that.
    const iconCounterRotation = -(compassRotation + state.targetAngle);
    el.targetIcon.style.transform = `translateX(-50%) rotate(${iconCounterRotation}deg)`;

    // Update debug info periodically
    if (Math.random() < 0.1) {
        el.debugInfo.textContent = `Lat/Lng (${state.lat.toFixed(2)},${state.lng.toFixed(2)}) | T: ${Math.round(state.targetAngle)}° | H: ${Math.round(state.heading)}°`;
    }
}

// Recalculate target positions every minute (sun/moon move)
setInterval(calculateTargetAngle, 60000);

// Run init
init();
