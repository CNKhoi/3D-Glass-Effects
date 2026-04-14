const HOLD_DELAY_MS = 900;
const POSITION_THRESHOLD = 28;
const SIZE_THRESHOLD = 34;
const TAU = Math.PI * 2;
const STAR_STEP = Math.PI / 5;
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];

const videoEl = document.querySelector(".input-video");
const canvasEl = document.querySelector(".output-canvas");
const ctx = canvasEl.getContext("2d");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-screen");
const retryBtn = document.getElementById("retry-btn");
const captureBtn = document.getElementById("capture-btn");
const clearBtn = document.getElementById("clear-btn");
const cameraStatusEl = document.getElementById("camera-status");
const gestureTagEl = document.getElementById("gesture-tag");
const toastEl = document.getElementById("toast");
const flashOverlayEl = document.getElementById("flash-overlay");

const frozenCanvas = document.createElement("canvas");
const frozenCtx = frozenCanvas.getContext("2d");

const state = {
    hands: null,
    stream: null,
    rafId: 0,
    bootPromise: null,
    processing: false,
    cameraRunning: false,
    activeShape: null,
    activeLabel: "",
    lockedShape: null,
    lockedLabel: "",
    previousShape: null,
    stableSince: 0,
    progress: 0,
    toastTimer: 0
};

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function getMirroredPoint(landmarks, index, width, height) {
    return {
        x: (1 - landmarks[index].x) * width,
        y: landmarks[index].y * height
    };
}

function isFingerExtended(landmarks, tipIndex, pipIndex) {
    const wrist = landmarks[0];
    const tip = landmarks[tipIndex];
    const pip = landmarks[pipIndex];
    return Math.hypot(tip.x - wrist.x, tip.y - wrist.y) >
        Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
}

function getPalmCenter(landmarks, width, height) {
    const indices = [0, 5, 9, 13, 17];
    const points = indices.map((index) => getMirroredPoint(landmarks, index, width, height));
    return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    };
}

function checkTriangleGesture(landmarks) {
    return isFingerExtended(landmarks, 4, 3) &&
        isFingerExtended(landmarks, 8, 6) &&
        isFingerExtended(landmarks, 12, 10) &&
        !isFingerExtended(landmarks, 16, 14) &&
        !isFingerExtended(landmarks, 20, 18);
}

function checkPeaceGesture(landmarks) {
    const isPeaceShape = isFingerExtended(landmarks, 8, 6) &&
        isFingerExtended(landmarks, 12, 10) &&
        !isFingerExtended(landmarks, 16, 14) &&
        !isFingerExtended(landmarks, 20, 18);

    if (!isPeaceShape) {
        return false;
    }

    const tipSpread = Math.hypot(
        landmarks[8].x - landmarks[12].x,
        landmarks[8].y - landmarks[12].y
    );
    const baseSpread = Math.hypot(
        landmarks[5].x - landmarks[9].x,
        landmarks[5].y - landmarks[9].y
    );

    return tipSpread > baseSpread * 0.8;
}

function checkLFrameGesture(landmarks) {
    return isFingerExtended(landmarks, 4, 3) &&
        isFingerExtended(landmarks, 8, 6) &&
        !isFingerExtended(landmarks, 12, 10) &&
        !isFingerExtended(landmarks, 16, 14) &&
        !isFingerExtended(landmarks, 20, 18);
}

function checkStretchCircleGesture(handA, handB) {
    return isFingerExtended(handA, 4, 3) &&
        isFingerExtended(handB, 4, 3) &&
        isFingerExtended(handA, 8, 6) &&
        isFingerExtended(handB, 8, 6) &&
        !isFingerExtended(handA, 12, 10) &&
        !isFingerExtended(handB, 12, 10) &&
        !isFingerExtended(handA, 16, 14) &&
        !isFingerExtended(handB, 16, 14) &&
        isFingerExtended(handA, 20, 18) &&
        isFingerExtended(handB, 20, 18);
}

function buildStarPoints(cx, cy, outerRadius, innerRadius, angle) {
    const points = [];
    for (let index = 0; index < 10; index += 1) {
        const radius = index % 2 === 0 ? outerRadius : innerRadius;
        const theta = angle + STAR_STEP * index;
        points.push({
            x: cx + Math.cos(theta) * radius,
            y: cy + Math.sin(theta) * radius
        });
    }
    return points;
}

function getShapeRadius(shape) {
    if (shape.type === "ellipse") {
        return Math.max(shape.rx, shape.ry);
    }
    return Math.max(...shape.points.map((point) => distance(point, { x: shape.cx, y: shape.cy })));
}

function getShapeBounds(shape) {
    if (shape.type === "ellipse") {
        return {
            left: shape.cx - shape.rx,
            right: shape.cx + shape.rx,
            top: shape.cy - shape.ry,
            bottom: shape.cy + shape.ry
        };
    }

    const xs = shape.points.map((point) => point.x);
    const ys = shape.points.map((point) => point.y);
    return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys)
    };
}

function areShapesStable(shapeA, shapeB) {
    if (!shapeA || !shapeB || shapeA.type !== shapeB.type) {
        return false;
    }

    return distance(shapeA, shapeB) < POSITION_THRESHOLD &&
        Math.abs(getShapeRadius(shapeA) - getShapeRadius(shapeB)) < SIZE_THRESHOLD;
}

function buildTriangleShape(landmarks, width, height) {
    const p1 = getMirroredPoint(landmarks, 4, width, height);
    const p2 = getMirroredPoint(landmarks, 8, width, height);
    const p3 = getMirroredPoint(landmarks, 12, width, height);
    const cx = (p1.x + p2.x + p3.x) / 3;
    const cy = (p1.y + p2.y + p3.y) / 3;

    return {
        type: "triangle",
        cx,
        cy,
        points: [p1, p2, p3]
    };
}

function buildStarShape(landmarks, width, height) {
    const palmCenter = getPalmCenter(landmarks, width, height);
    const indexTip = getMirroredPoint(landmarks, 8, width, height);
    const middleTip = getMirroredPoint(landmarks, 12, width, height);
    const indexBase = getMirroredPoint(landmarks, 5, width, height);
    const pinkyBase = getMirroredPoint(landmarks, 17, width, height);
    const fingerMid = {
        x: (indexTip.x + middleTip.x) / 2,
        y: (indexTip.y + middleTip.y) / 2
    };
    const palmWidth = distance(indexBase, pinkyBase);
    const fingertipReach = Math.max(
        distance(indexTip, palmCenter),
        distance(middleTip, palmCenter)
    );
    const outerRadius = clamp(Math.max(fingertipReach * 0.94, palmWidth * 0.78), 46, Math.min(width, height) * 0.26);
    const innerRadius = outerRadius * 0.48;
    const angle = Math.atan2(fingerMid.y - palmCenter.y, fingerMid.x - palmCenter.x);

    return {
        type: "star",
        cx: palmCenter.x,
        cy: palmCenter.y,
        points: buildStarPoints(palmCenter.x, palmCenter.y, outerRadius, innerRadius, angle),
        outerRadius,
        innerRadius,
        angle
    };
}

function buildQuadShape(leftHand, rightHand, width, height) {
    const corners = [
        getMirroredPoint(leftHand, 8, width, height),
        getMirroredPoint(rightHand, 8, width, height),
        getMirroredPoint(rightHand, 4, width, height),
        getMirroredPoint(leftHand, 4, width, height)
    ];

    const cx = corners.reduce((sum, point) => sum + point.x, 0) / corners.length;
    const cy = corners.reduce((sum, point) => sum + point.y, 0) / corners.length;
    const expandFactor = 1.09;
    const points = corners.map((point) => ({
        x: cx + (point.x - cx) * expandFactor,
        y: cy + (point.y - cy) * expandFactor
    }));

    return {
        type: "quad",
        cx,
        cy,
        points
    };
}

function buildEllipseShape(leftHand, rightHand, width, height) {
    const leftIndex = getMirroredPoint(leftHand, 8, width, height);
    const rightIndex = getMirroredPoint(rightHand, 8, width, height);
    const leftThumb = getMirroredPoint(leftHand, 4, width, height);
    const rightThumb = getMirroredPoint(rightHand, 4, width, height);
    const leftPinky = getMirroredPoint(leftHand, 20, width, height);
    const rightPinky = getMirroredPoint(rightHand, 20, width, height);

    const leftAnchor = {
        x: (leftIndex.x + leftThumb.x) / 2,
        y: (leftIndex.y + leftThumb.y) / 2
    };
    const rightAnchor = {
        x: (rightIndex.x + rightThumb.x) / 2,
        y: (rightIndex.y + rightThumb.y) / 2
    };
    const cx = (leftAnchor.x + rightAnchor.x) / 2;
    const cy = (leftAnchor.y + rightAnchor.y) / 2;
    const pinkyCenter = {
        x: (leftPinky.x + rightPinky.x) / 2,
        y: (leftPinky.y + rightPinky.y) / 2
    };

    return {
        type: "ellipse",
        cx,
        cy,
        rx: clamp(distance(leftAnchor, rightAnchor) / 2 * 1.12, 52, width * 0.36),
        ry: clamp(distance({ x: cx, y: cy }, pinkyCenter) * 1.18, 42, height * 0.34),
        angle: Math.atan2(rightAnchor.y - leftAnchor.y, rightAnchor.x - leftAnchor.x)
    };
}

function detectGesture(handLandmarks, width, height) {
    if (!handLandmarks.length) {
        return null;
    }

    const sortedHands = [...handLandmarks].sort((handA, handB) => {
        const xA = getMirroredPoint(handA, 8, width, height).x;
        const xB = getMirroredPoint(handB, 8, width, height).x;
        return xA - xB;
    });

    if (sortedHands.length >= 2) {
        const leftHand = sortedHands[0];
        const rightHand = sortedHands[sortedHands.length - 1];

        if (checkLFrameGesture(leftHand) && checkLFrameGesture(rightHand)) {
            return {
                shape: buildQuadShape(leftHand, rightHand, width, height),
                label: "TỨ GIÁC 3D"
            };
        }

        if (checkStretchCircleGesture(leftHand, rightHand)) {
            return {
                shape: buildEllipseShape(leftHand, rightHand, width, height),
                label: "ELLIPSE KÉO DÃN"
            };
        }
    }

    for (const hand of sortedHands) {
        if (checkPeaceGesture(hand)) {
            return {
                shape: buildStarShape(hand, width, height),
                label: "NGÔI SAO"
            };
        }

        if (checkTriangleGesture(hand)) {
            return {
                shape: buildTriangleShape(hand, width, height),
                label: "TAM GIÁC"
            };
        }
    }

    return null;
}

function buildShapePath(shape) {
    ctx.beginPath();
    if (shape.type === "ellipse") {
        ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, shape.angle, 0, TAU);
        return;
    }

    shape.points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.closePath();
}

function paintSource(source, width, height, mirrored, options = {}) {
    const scale = options.scale ?? 1;
    const focusX = options.focusX ?? width / 2;
    const focusY = options.focusY ?? height / 2;
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const drawX = focusX - focusX * scale;
    const drawY = focusY - focusY * scale;

    if (mirrored) {
        ctx.scale(-1, 1);
        ctx.drawImage(source, -(drawX + drawWidth), drawY, drawWidth, drawHeight);
        return;
    }

    ctx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
}

function drawBackground(source, width, height, mirrored) {
    ctx.save();
    paintSource(source, width, height, mirrored);
    ctx.restore();
}

function drawGlassEffect(source, width, height, shape, mirrored, locked, progress) {
    const bounds = getShapeBounds(shape);
    const radius = getShapeRadius(shape);
    const now = performance.now() * 0.001;
    const shimmerOffset = Math.sin(now * 1.7 + shape.cx * 0.01) * 18;
    const strokeAlpha = locked ? 0.96 : 0.46 + progress * 0.44;

    ctx.save();
    buildShapePath(shape);
    ctx.shadowColor = "rgba(0, 0, 0, 0.36)";
    ctx.shadowBlur = 32;
    ctx.fillStyle = "rgba(7, 14, 24, 0.22)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    buildShapePath(shape);
    ctx.clip();

    ctx.save();
    ctx.filter = `blur(${locked ? 22 : 14 + progress * 10}px) saturate(1.26) brightness(1.08)`;
    paintSource(source, width, height, mirrored, {
        scale: 1.06 + progress * 0.03,
        focusX: shape.cx,
        focusY: shape.cy
    });
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const fillGradient = ctx.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
    fillGradient.addColorStop(0, "rgba(124, 247, 255, 0.24)");
    fillGradient.addColorStop(0.35, "rgba(255, 255, 255, 0.08)");
    fillGradient.addColorStop(0.68, "rgba(255, 191, 105, 0.12)");
    fillGradient.addColorStop(1, "rgba(255, 141, 183, 0.18)");
    ctx.fillStyle = fillGradient;
    ctx.fillRect(bounds.left - 24, bounds.top - 24, bounds.right - bounds.left + 48, bounds.bottom - bounds.top + 48);
    ctx.restore();

    ctx.save();
    const sheen = ctx.createLinearGradient(
        bounds.left - shimmerOffset,
        bounds.top,
        bounds.right + shimmerOffset,
        bounds.bottom
    );
    sheen.addColorStop(0, "rgba(255, 255, 255, 0)");
    sheen.addColorStop(0.22, "rgba(255, 255, 255, 0.12)");
    sheen.addColorStop(0.5, "rgba(255, 255, 255, 0.22)");
    sheen.addColorStop(0.78, "rgba(255, 255, 255, 0.08)");
    sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(bounds.left - 32, bounds.top - 32, bounds.right - bounds.left + 64, bounds.bottom - bounds.top + 64);
    ctx.restore();

    ctx.restore();

    ctx.save();
    buildShapePath(shape);
    const bevel = ctx.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
    bevel.addColorStop(0, `rgba(255, 255, 255, ${strokeAlpha})`);
    bevel.addColorStop(0.4, "rgba(124, 247, 255, 0.18)");
    bevel.addColorStop(1, "rgba(255, 255, 255, 0.42)");
    ctx.lineWidth = locked ? 7 : 3 + progress * 4;
    ctx.strokeStyle = bevel;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    buildShapePath(shape);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.74)";
    ctx.lineWidth = 1.35;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    if (shape.type === "ellipse") {
        ctx.ellipse(shape.cx, shape.cy, shape.rx * 1.14, shape.ry * 1.14, shape.angle, 0, TAU);
    } else {
        ctx.ellipse(shape.cx, shape.cy, radius * 1.12, radius * 1.12, 0, 0, TAU);
    }
    ctx.strokeStyle = locked ? "rgba(124, 247, 255, 0.22)" : `rgba(124, 247, 255, ${0.08 + progress * 0.12})`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([10, 12]);
    ctx.stroke();
    ctx.restore();
}

function drawProgressHalo(shape, progress) {
    const radius = getShapeRadius(shape) * 1.16;
    const haloRy = shape.type === "ellipse" ? shape.ry * 1.16 : radius;
    const haloRx = shape.type === "ellipse" ? shape.rx * 1.16 : radius;
    const rotation = shape.type === "ellipse" ? shape.angle : 0;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(shape.cx, shape.cy, haloRx, haloRy, rotation, 0, TAU);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([8, 10]);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(shape.cx, shape.cy, haloRx, haloRy, rotation, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
    ctx.strokeStyle = `rgba(87, 227, 209, ${0.5 + progress * 0.4})`;
    ctx.lineWidth = 3.2;
    ctx.setLineDash([]);
    ctx.shadowColor = "rgba(87, 227, 209, 0.48)";
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
}

function drawHandGuides(handLandmarks, width, height) {
    ctx.save();
    for (const hand of handLandmarks) {
        const mirrored = hand.map((point) => ({
            ...point,
            x: 1 - point.x
        }));

        for (const [fromIndex, toIndex] of HAND_CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo(mirrored[fromIndex].x * width, mirrored[fromIndex].y * height);
            ctx.lineTo(mirrored[toIndex].x * width, mirrored[toIndex].y * height);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        for (const point of mirrored) {
            ctx.beginPath();
            ctx.arc(point.x * width, point.y * height, 3, 0, TAU);
            ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
            ctx.fill();
        }
    }
    ctx.restore();
}

function drawFrame(source, width, height, mirrored, handLandmarks) {
    ctx.clearRect(0, 0, width, height);
    drawBackground(source, width, height, mirrored);

    const shape = state.lockedShape || state.activeShape;
    if (shape) {
        drawGlassEffect(source, width, height, shape, mirrored, Boolean(state.lockedShape), state.progress);
    }

    if (state.activeShape && !state.lockedShape) {
        drawProgressHalo(state.activeShape, state.progress);
    }

    if (handLandmarks.length && !state.lockedShape) {
        drawHandGuides(handLandmarks, width, height);
    }
}

function setGestureTag(text) {
    if (!text) {
        gestureTagEl.textContent = "";
        gestureTagEl.classList.add("is-hidden");
        return;
    }

    gestureTagEl.textContent = text;
    gestureTagEl.classList.remove("is-hidden");
}

function setCameraStatus(text, variant) {
    cameraStatusEl.textContent = text;
    cameraStatusEl.classList.remove("is-waiting", "is-live", "is-lock", "is-error");
    cameraStatusEl.classList.add(variant);
}

function toggleLoading(isVisible) {
    loadingEl.classList.toggle("is-hidden", !isVisible);
}

function toggleError(isVisible) {
    errorEl.classList.toggle("is-hidden", !isVisible);
}

function toggleClearButton() {
    clearBtn.classList.toggle("is-hidden", !state.lockedShape);
}

function showToast(message) {
    window.clearTimeout(state.toastTimer);
    toastEl.textContent = message;
    toastEl.classList.remove("is-hidden");
    state.toastTimer = window.setTimeout(() => {
        toastEl.classList.add("is-hidden");
    }, 2200);
}

function triggerFlash() {
    flashOverlayEl.classList.add("is-visible");
    window.setTimeout(() => {
        flashOverlayEl.classList.remove("is-visible");
    }, 140);
}

function clearLock() {
    state.lockedShape = null;
    state.lockedLabel = "";
    state.activeShape = null;
    state.activeLabel = "";
    state.previousShape = null;
    state.stableSince = 0;
    state.progress = 0;
    toggleClearButton();
    setGestureTag("");
    if (state.cameraRunning) {
        setCameraStatus("Camera đang chạy", "is-live");
    }
}

function copyCurrentFrameToFrozen(width, height) {
    frozenCanvas.width = width;
    frozenCanvas.height = height;
    frozenCtx.clearRect(0, 0, width, height);
    frozenCtx.save();
    frozenCtx.scale(-1, 1);
    frozenCtx.drawImage(videoEl, -width, 0, width, height);
    frozenCtx.restore();
}

function handleGestureState(detected) {
    if (state.lockedShape) {
        state.activeShape = null;
        state.activeLabel = "";
        state.progress = 1;
        return;
    }

    if (!detected) {
        state.activeShape = null;
        state.activeLabel = "";
        state.previousShape = null;
        state.stableSince = 0;
        state.progress = 0;
        return;
    }

    const now = performance.now();
    if (!areShapesStable(detected.shape, state.previousShape)) {
        state.previousShape = detected.shape;
        state.stableSince = now;
        state.activeShape = detected.shape;
        state.activeLabel = detected.label;
        state.progress = 0.02;
        return;
    }

    state.previousShape = detected.shape;
    state.activeShape = detected.shape;
    state.activeLabel = detected.label;
    state.progress = clamp((now - state.stableSince) / HOLD_DELAY_MS, 0, 1);

    if (state.progress >= 1 && canvasEl.width && canvasEl.height) {
        state.lockedShape = detected.shape;
        state.lockedLabel = detected.label;
        state.activeShape = null;
        state.activeLabel = "";
        state.previousShape = null;
        state.stableSince = 0;
        state.progress = 1;
        copyCurrentFrameToFrozen(canvasEl.width, canvasEl.height);
        toggleClearButton();
        setCameraStatus("Đã khóa khung kính", "is-lock");
        showToast("Đã khóa khung kính. Nhấn Esc để xóa.");
    }
}

function onResults(results) {
    if (!videoEl.videoWidth || !videoEl.videoHeight) {
        return;
    }

    const width = videoEl.videoWidth;
    const height = videoEl.videoHeight;
    if (canvasEl.width !== width || canvasEl.height !== height) {
        canvasEl.width = width;
        canvasEl.height = height;
    }

    toggleLoading(false);
    toggleError(false);

    const landmarks = results.multiHandLandmarks ?? [];
    const detected = detectGesture(landmarks, width, height);

    handleGestureState(detected);

    const source = state.lockedShape ? frozenCanvas : videoEl;
    const isSourceMirrored = !state.lockedShape;
    drawFrame(source, width, height, isSourceMirrored, landmarks);

    if (state.lockedShape) {
        setGestureTag(state.lockedLabel);
    } else {
        setGestureTag(state.activeLabel);
        setCameraStatus("Camera đang chạy", "is-live");
    }
}

async function frameLoop() {
    if (!state.cameraRunning) {
        return;
    }

    if (!state.processing && videoEl.readyState >= 2) {
        state.processing = true;
        try {
            await state.hands.send({ image: videoEl });
        } catch (error) {
            console.error("Frame processing error:", error);
        } finally {
            state.processing = false;
        }
    }

    state.rafId = window.requestAnimationFrame(frameLoop);
}

async function startCamera() {
    if (state.cameraRunning) {
        return;
    }

    toggleError(false);
    toggleLoading(true);
    setCameraStatus("Đang xin quyền camera", "is-waiting");

    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ getUserMedia.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    });

    state.stream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();
    state.cameraRunning = true;
    setCameraStatus("Camera đang chạy", "is-live");
    state.rafId = window.requestAnimationFrame(frameLoop);
}

function stopCamera() {
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    state.cameraRunning = false;
    state.processing = false;

    if (state.stream) {
        state.stream.getTracks().forEach((track) => track.stop());
        state.stream = null;
    }

    videoEl.pause();
    videoEl.srcObject = null;
}

function handleCameraError(error) {
    console.error("Camera error:", error);
    stopCamera();
    toggleLoading(false);
    toggleError(true);
    setCameraStatus("Lỗi camera", "is-error");
}

function exportCanvasAsPng() {
    if (!canvasEl.width || !canvasEl.height) {
        showToast("Camera chưa sẵn sàng để chụp.");
        return;
    }

    triggerFlash();
    canvasEl.toBlob((blob) => {
        if (!blob) {
            showToast("Không thể tạo ảnh chụp.");
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `glass-effects-${timestamp}.png`;
        link.click();
        URL.revokeObjectURL(url);
        showToast("Đã lưu ảnh PNG.");
    }, "image/png");
}

function handleKeydown(event) {
    if (event.code === "Space") {
        event.preventDefault();
        exportCanvasAsPng();
    }

    if (event.code === "Escape") {
        clearLock();
    }
}

function initHands() {
    if (state.hands) {
        return;
    }

    if (typeof Hands !== "function") {
        throw new Error("Không tải được MediaPipe Hands.");
    }

    state.hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    state.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
    });

    state.hands.onResults(onResults);
}

async function boot() {
    if (state.bootPromise) {
        return state.bootPromise;
    }

    state.bootPromise = (async () => {
        try {
            initHands();
            await startCamera();
        } catch (error) {
            handleCameraError(error);
        } finally {
            state.bootPromise = null;
        }
    })();

    return state.bootPromise;
}

captureBtn.addEventListener("click", exportCanvasAsPng);
clearBtn.addEventListener("click", clearLock);
retryBtn.addEventListener("click", boot);
canvasEl.addEventListener("click", () => {
    if (state.lockedShape) {
        clearLock();
    }
});
document.addEventListener("keydown", handleKeydown);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopCamera();
        return;
    }

    if (!state.cameraRunning) {
        boot();
    }
});
window.addEventListener("pagehide", stopCamera);
window.addEventListener("beforeunload", stopCamera);

boot();
