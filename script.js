// Constants
const MAKKAH_LAT = 21.4225;
const MAKKAH_LNG = 39.8262;

// State
let state = {
    mode: 'sun', // 'sun', 'moon', 'qibla'
    lat: null,
    lng: null,
    heading: 0, // Current device heading
    targetAngle: 0, // Angle of the target relative to North
    hasPermission: false
};

// UI Text (English Only)
const textUI = {
    title: "Sky & Qibla Finder",
    sunBtn: "Sun Direction",
    moonBtn: "Moon Direction",
    qiblaBtn: "Qibla Direction",
    requestAccess: "Enable Compass",
    overlayTitle: "Compass Access Required",
    overlayDesc: "We need location and orientation access to show directions accurately.",
    loadingLocation: "Getting Location...",
    needCalibration: "Please move your phone in a figure 8",
    locationError: "Location access denied. Please enable GPS.",
    orientationError: "Device orientation not supported.",
    ready: "Point your phone to find the target!",
    sunLabel: "Sun",
    moonLabel: "Moon",
    qiblaLabel: "Qibla"
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
    updateUIStrings();
    setupEventListeners();
}

function setupEventListeners() {
    el.startBtn.addEventListener('click', requestPermissions);

    el.btnSun.addEventListener('click', () => setMode('sun'));
    el.btnMoon.addEventListener('click', () => setMode('moon'));
    el.btnQibla.addEventListener('click', () => setMode('qibla'));
}

// Translations and UI
function updateUIStrings() {
    el.btnTextSun.textContent = textUI.sunBtn;
    el.btnTextMoon.textContent = textUI.moonBtn;
    el.btnTextQibla.textContent = textUI.qiblaBtn;
    el.startBtn.textContent = textUI.requestAccess;
    el.overlayTitle.textContent = textUI.overlayTitle;
    el.overlayDesc.textContent = textUI.overlayDesc;
    el.targetLabel.textContent = textUI[`${state.mode}Label`];

    if (!state.hasPermission) {
        el.statusMsg.textContent = "Waiting for permission...";
    } else {
        el.statusMsg.textContent = textUI.ready;
    }
}

function setMode(mode) {
    state.mode = mode;

    // Dynamic H1
    if (mode === 'sun') el.appTitle.textContent = textUI.sunBtn;
    if (mode === 'moon') el.appTitle.textContent = textUI.moonBtn;
    if (mode === 'qibla') el.appTitle.textContent = textUI.qiblaBtn;

    // Update active button
    [el.btnSun, el.btnMoon, el.btnQibla].forEach(btn => btn.classList.remove('active'));
    if (mode === 'sun') el.btnSun.classList.add('active');
    if (mode === 'moon') el.btnMoon.classList.add('active');
    if (mode === 'qibla') el.btnQibla.classList.add('active');

    // Update body theme class
    el.body.className = `theme-${mode}`;

    // Update icon and label
    el.iconImg.src = icons[mode];
    el.targetLabel.textContent = textUI[`${mode}Label`];

    // Recalculate if we have location
    if (state.lat && state.lng) {
        calculateTargetAngle();
        updateUI();
    }
}

// Permissions and Sensors
async function requestPermissions() {
    el.statusMsg.textContent = textUI.loadingLocation;

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
                { enableHighAccuracy: true } /* High Accuracy GPS applied here */
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
        el.statusMsg.textContent = textUI.ready;

        // Initial Calculation
        calculateTargetAngle();

    } catch (error) {
        console.error("Permission error:", error);
        el.statusMsg.textContent = error.message.includes("location") || error.code === 1
            ? textUI.locationError
            : textUI.orientationError;
    }
}

let smoothedHeading = 0;

function handleOrientation(event) {
    let rawHeading = 0;

    // iOS provides absolute heading
    if (event.webkitCompassHeading) {
        rawHeading = event.webkitCompassHeading;
    }
    // Android
    else if (event.absolute && event.alpha !== null) {
        rawHeading = 360 - event.alpha; // Android compass goes counter-clockwise
    } else if (event.alpha !== null) {
        // Fallback
        rawHeading = 360 - event.alpha;
    } else {
        return; // No data
    }

    // Low-pass filter for smoothing the device orientation data
    let delta = rawHeading - smoothedHeading;
    // Handle wrap-around at 360/0 boundary
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    smoothedHeading = smoothedHeading + delta * 0.15; // smooth factor
    smoothedHeading = (smoothedHeading + 360) % 360;

    state.heading = smoothedHeading;
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
                let azimuthDeg = (pos.azimuth * 180) / Math.PI;
                state.targetAngle = (azimuthDeg + 180) % 360;
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
    // Great-circle bearing to Makkah (Math formula check)
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
    const compassRotation = -state.heading;
    el.compassCircle.style.transform = `rotate(${compassRotation}deg)`;

    // Keep letters (N, E, S, W) pointing upright
    const marks = document.querySelectorAll('.compass-mark');
    marks.forEach(mark => {
        mark.style.transform = `translate(-50%, -50%) rotate(${-compassRotation}deg)`;
    });

    // The target icon container must be rotated to the target angle relative to North
    el.orbitingContainer.style.transform = `rotate(${state.targetAngle}deg)`;

    // Keep the icon upright relative to screen
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
