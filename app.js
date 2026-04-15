const HOLD_DELAY_MS = 900;
const MISS_GRACE_MS = 180;
const DESKTOP_FRAME_INTERVAL_MS = 28;
const MOBILE_FRAME_INTERVAL_MS = 42;
const LOW_POWER_FRAME_INTERVAL_MS = 56;
const POSITION_THRESHOLD = 28;
const SIZE_THRESHOLD = 34;
const SHAPE_SMOOTHING = 0.34;
const MOBILE_BREAKPOINT = 820;
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
const freezeCanvasEl = document.querySelector(".freeze-canvas");
const canvasEl = document.querySelector(".output-canvas");
const freezeCtx = freezeCanvasEl.getContext("2d", { alpha: false, desynchronized: true });
const ctx = canvasEl.getContext("2d", { alpha: true, desynchronized: true });
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("error-screen");
const retryBtn = document.getElementById("retry-btn");
const captureBtn = document.getElementById("capture-btn");
const captureBtnImgEl = captureBtn.querySelector("img");
const clearBtn = document.getElementById("clear-btn");
const guideBtn = document.getElementById("guide-btn");
const guidePanel = document.getElementById("guide-panel");
const cameraStatusEl = document.getElementById("camera-status");
const gestureTagEl = document.getElementById("gesture-tag");
const toastEl = document.getElementById("toast");
const flashOverlayEl = document.getElementById("flash-overlay");
const menuBtnEl = document.getElementById("menu-btn");
const modeMenuEl = document.getElementById("mode-menu");
const historyModeBtnEl = document.getElementById("history-mode-btn");
const photobookModeBtnEl = document.getElementById("photobook-mode-btn");
const overlayBackdropEl = document.getElementById("overlay-backdrop");
const captureDelayBtnEl = document.getElementById("capture-delay-btn");
const captureDelayBtnImgEl = captureDelayBtnEl.querySelector("img");
const captureDelayValueEl = document.getElementById("capture-delay-value");
const captureDelayMenuEl = document.getElementById("capture-delay-menu");
const captureCountdownEl = document.getElementById("capture-countdown");
const captureCountdownValueEl = document.getElementById("capture-countdown-value");
const captureCountdownLabelEl = document.getElementById("capture-countdown-label");
const historyDrawerEl = document.getElementById("history-drawer");
const historyCloseBtnEl = document.getElementById("history-close-btn");
const historyEmptyEl = document.getElementById("history-empty");
const historyPreviewEl = document.getElementById("history-preview");
const historyPreviewImageEl = document.getElementById("history-preview-image");
const historyPreviewTitleEl = document.getElementById("history-preview-title");
const historyPreviewTimeEl = document.getElementById("history-preview-time");
const historySelectionCountEl = document.getElementById("history-selection-count");
const historyDownloadBtnEl = document.getElementById("history-download-btn");
const historyEditBtnEl = document.getElementById("history-edit-btn");
const historyDeleteBtnEl = document.getElementById("history-delete-btn");
const historyImportBtnEl = document.getElementById("history-import-btn");
const historyClearAllBtnEl = document.getElementById("history-clear-all-btn");
const historyClearSelectionBtnEl = document.getElementById("history-clear-selection-btn");
const historyListEl = document.getElementById("history-list");
const photoImportInputEl = document.getElementById("photo-import-input");
const researchModalEl = document.getElementById("research-modal");
const researchCloseBtnEl = document.getElementById("research-close-btn");
const editorOverlayEl = document.getElementById("editor-overlay");
const editorCanvasEl = document.getElementById("editor-canvas");
const editorCtx = editorCanvasEl.getContext("2d", { alpha: true, desynchronized: true });
const editorLayoutOptionsEl = document.getElementById("editor-layout-options");
const editorPhotoPickerEl = document.getElementById("editor-photo-picker");
const editorFrameOptionsEl = document.getElementById("editor-frame-options");
const stickerSearchInputEl = document.getElementById("sticker-search-input");
const stickerListEl = document.getElementById("sticker-list");
const stickerScaleRangeEl = document.getElementById("sticker-scale-range");
const stickerRotationRangeEl = document.getElementById("sticker-rotation-range");
const stickerEraserSizeValueEl = document.getElementById("sticker-eraser-size-value");
const stickerEraserRangeEl = document.getElementById("sticker-eraser-range");
const stickerEraserToggleBtnEl = document.getElementById("sticker-eraser-toggle-btn");
const stickerFlipXBtnEl = document.getElementById("sticker-flip-x-btn");
const stickerFlipYBtnEl = document.getElementById("sticker-flip-y-btn");
const stickerRemoveBtnEl = document.getElementById("sticker-remove-btn");
const editorSelectionNoteEl = document.getElementById("editor-selection-note");
const editorDownloadBtnEl = document.getElementById("editor-download-btn");
const editorCloseBtnEl = document.getElementById("editor-close-btn");
const editorExportCanvasEl = document.getElementById("editor-export-canvas");
const editorExportCtx = editorExportCanvasEl.getContext("2d", { alpha: true });

const MAX_CAPTURE_HISTORY = 10;
const STORAGE_CAPTURE_HISTORY_KEY = "glass-motion-history-v2";
const STORAGE_UI_PREFS_KEY = "glass-motion-ui-prefs-v1";
const COLLAGE_LAYOUTS = [
    { id: "single", label: "1 ảnh", hint: "Toàn khung" },
    { id: "split-v", label: "Ngang 2", hint: "Trái / phải" },
    { id: "split-h", label: "Dọc 2", hint: "Trên / dưới" },
    { id: "grid", label: "Lưới 4", hint: "Ghép nhiều ảnh" }
];
const FRAME_STYLES = [
    { id: "none", label: "Tối giản", hint: "Không viền" },
    { id: "classic", label: "Classic", hint: "Khung trắng" },
    { id: "polaroid", label: "Polaroid", hint: "Mé dưới dày" },
    { id: "neon", label: "Neon", hint: "Phát sáng" },
    { id: "film", label: "Film", hint: "Dải phim" }
];
const STICKER_LIBRARY = buildStickerLibrary();
const imageCache = new Map();

const state = {
    hands: null,
    handsLibraryPromise: null,
    stream: null,
    rafId: 0,
    useVideoFrameCallback: false,
    bootPromise: null,
    lastProcessedAt: 0,
    processing: false,
    cameraRunning: false,
    lowPowerMode: false,
    performanceProfile: null,
    activeShape: null,
    activeLabel: "",
    trackingShape: null,
    trackingLabel: "",
    lockedShape: null,
    lockedLabel: "",
    stableSince: 0,
    lastDetectionAt: 0,
    guideOpen: false,
    compactLayout: false,
    progress: 0,
    toastTimer: 0
};

let capturedPhotos = [];
let selectedHistoryPhotoId = "";
let selectedHistoryPhotoIds = [];
let selectedCaptureDelay = 0;
let captureCountdownTimeout = 0;
let captureCountdownInterval = 0;
let captureCountdownEndsAt = 0;
let captureCountdownLastValue = 0;

const editorState = {
    isOpen: false,
    selectedPhotoIds: [],
    collageLayout: "single",
    frameStyle: "classic",
    activeStickers: [],
    selectedStickerId: null,
    stickerSearch: "",
    dragStickerId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    eraserEnabled: false,
    eraserRadius: 24,
    erasingStickerId: null,
    eraseLastPoint: null,
    eraserCursorVisible: false,
    eraserCursorX: 0,
    eraserCursorY: 0,
    renderToken: 0
};

function isLowPowerDevice() {
    const memory = navigator.deviceMemory ?? 0;
    const cores = navigator.hardwareConcurrency ?? 0;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    return reducedMotion || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4);
}

function buildPerformanceProfile() {
    const compactLayout = window.innerWidth <= MOBILE_BREAKPOINT;
    const lowPowerMode = compactLayout || isLowPowerDevice();

    return {
        compactLayout,
        lowPowerMode,
        frameIntervalMs: lowPowerMode
            ? LOW_POWER_FRAME_INTERVAL_MS
            : compactLayout
                ? MOBILE_FRAME_INTERVAL_MS
                : DESKTOP_FRAME_INTERVAL_MS,
        drawGuides: !compactLayout && !lowPowerMode,
        videoConstraints: lowPowerMode
            ? {
                facingMode: "user",
                width: { ideal: 960 },
                height: { ideal: 540 },
                frameRate: { ideal: 24, max: 30 }
            }
            : {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 }
            },
        handsOptions: {
            maxNumHands: 2,
            modelComplexity: lowPowerMode ? 0 : 1,
            minDetectionConfidence: lowPowerMode ? 0.55 : 0.6,
            minTrackingConfidence: lowPowerMode ? 0.45 : 0.5
        }
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerp(start, end, amount) {
    return start + (end - start) * amount;
}

function normalizeAngle(angle) {
    let nextAngle = angle;
    while (nextAngle > Math.PI) {
        nextAngle -= TAU;
    }
    while (nextAngle < -Math.PI) {
        nextAngle += TAU;
    }
    return nextAngle;
}

function lerpAngle(start, end, amount) {
    return start + normalizeAngle(end - start) * amount;
}

function clonePoint(point) {
    return { x: point.x, y: point.y };
}

function cloneShape(shape) {
    if (shape.type === "ellipse") {
        return { ...shape };
    }

    return {
        ...shape,
        points: shape.points.map(clonePoint)
    };
}

function interpolateShape(currentShape, nextShape, amount) {
    if (!currentShape || currentShape.type !== nextShape.type) {
        return cloneShape(nextShape);
    }

    if (nextShape.type === "ellipse") {
        return {
            ...nextShape,
            cx: lerp(currentShape.cx, nextShape.cx, amount),
            cy: lerp(currentShape.cy, nextShape.cy, amount),
            rx: lerp(currentShape.rx, nextShape.rx, amount),
            ry: lerp(currentShape.ry, nextShape.ry, amount),
            angle: lerpAngle(currentShape.angle, nextShape.angle, amount)
        };
    }

    return {
        ...nextShape,
        cx: lerp(currentShape.cx, nextShape.cx, amount),
        cy: lerp(currentShape.cy, nextShape.cy, amount),
        points: nextShape.points.map((point, index) => {
            const currentPoint = currentShape.points[index] ?? point;
            return {
                x: lerp(currentPoint.x, point.x, amount),
                y: lerp(currentPoint.y, point.y, amount)
            };
        })
    };
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

function measureShapeDelta(shapeA, shapeB) {
    if (!shapeA || !shapeB || shapeA.type !== shapeB.type) {
        return Number.POSITIVE_INFINITY;
    }

    const centerDelta = distance(shapeA, shapeB);

    if (shapeA.type === "ellipse") {
        const sizeDelta = Math.abs(shapeA.rx - shapeB.rx) * 0.5 +
            Math.abs(shapeA.ry - shapeB.ry) * 0.5;
        const angleDelta = Math.abs(normalizeAngle(shapeA.angle - shapeB.angle)) * 18;
        return centerDelta * 0.55 + sizeDelta + angleDelta;
    }

    const pointDelta = shapeA.points.reduce((sum, point, index) => {
        const nextPoint = shapeB.points[index] ?? point;
        return sum + distance(point, nextPoint);
    }, 0) / shapeA.points.length;

    return centerDelta * 0.35 + pointDelta * 0.65;
}

function getShapeTolerance(shapeA, shapeB = shapeA) {
    const averageRadius = (getShapeRadius(shapeA) + getShapeRadius(shapeB)) / 2;
    return Math.max(POSITION_THRESHOLD, averageRadius * 0.18) + SIZE_THRESHOLD * 0.2;
}

function areShapesStable(shapeA, shapeB) {
    return measureShapeDelta(shapeA, shapeB) < getShapeTolerance(shapeA, shapeB);
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

function drawGlassEffect(source, width, height, shape, mirrored, locked, progress) {
    const bounds = getShapeBounds(shape);
    const radius = getShapeRadius(shape);
    const now = performance.now() * 0.001;
    const shimmerOffset = Math.sin(now * 1.7 + shape.cx * 0.01) * 18;
    const strokeAlpha = locked ? 0.96 : 0.46 + progress * 0.44;
    const lowPower = state.lowPowerMode;
    const shadowBlur = lowPower ? 12 : state.compactLayout ? 18 : 28;
    const blurAmount = locked
        ? (lowPower ? 10 : state.compactLayout ? 15 : 20)
        : (lowPower ? 6 + progress * 4 : state.compactLayout ? 10 + progress * 6 : 13 + progress * 8);

    ctx.save();
    buildShapePath(shape);
    ctx.shadowColor = "rgba(0, 0, 0, 0.36)";
    ctx.shadowBlur = shadowBlur;
    ctx.fillStyle = "rgba(7, 14, 24, 0.22)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    buildShapePath(shape);
    ctx.clip();

    ctx.save();
    ctx.filter = `blur(${blurAmount}px) saturate(1.26) brightness(1.08)`;
    paintSource(source, width, height, mirrored, {
        scale: 1.06 + progress * 0.03,
        focusX: shape.cx,
        focusY: shape.cy
    });
    ctx.restore();

    const fillGradient = ctx.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
    fillGradient.addColorStop(0, "rgba(124, 247, 255, 0.22)");
    fillGradient.addColorStop(0.4, lowPower ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.08)");
    fillGradient.addColorStop(1, "rgba(255, 191, 105, 0.12)");
    ctx.fillStyle = fillGradient;
    ctx.fillRect(bounds.left - 16, bounds.top - 16, bounds.right - bounds.left + 32, bounds.bottom - bounds.top + 32);

    if (!lowPower) {
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
        ctx.fillRect(bounds.left - 24, bounds.top - 24, bounds.right - bounds.left + 48, bounds.bottom - bounds.top + 48);
    }

    ctx.restore();

    ctx.save();
    buildShapePath(shape);
    const bevel = ctx.createLinearGradient(bounds.left, bounds.top, bounds.right, bounds.bottom);
    bevel.addColorStop(0, `rgba(255, 255, 255, ${strokeAlpha})`);
    bevel.addColorStop(0.4, "rgba(124, 247, 255, 0.18)");
    bevel.addColorStop(1, "rgba(255, 255, 255, 0.42)");
    ctx.lineWidth = locked ? (lowPower ? 4.5 : 7) : (lowPower ? 2.5 : 3) + progress * (lowPower ? 2.5 : 4);
    ctx.strokeStyle = bevel;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    buildShapePath(shape);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.74)";
    ctx.lineWidth = 1.35;
    ctx.stroke();
    ctx.restore();

    if (!lowPower) {
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
}

function drawProgressHalo(shape, progress) {
    if (state.lowPowerMode && progress < 0.16) {
        return;
    }

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
    ctx.lineWidth = state.lowPowerMode ? 2.2 : 3.2;
    ctx.setLineDash([]);
    if (!state.lowPowerMode) {
        ctx.shadowColor = "rgba(87, 227, 209, 0.48)";
        ctx.shadowBlur = 14;
    }
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

    const shape = state.lockedShape || state.activeShape;
    if (shape) {
        drawGlassEffect(source, width, height, shape, mirrored, Boolean(state.lockedShape), state.progress);
    }

    if (state.activeShape && !state.lockedShape) {
        drawProgressHalo(state.activeShape, state.progress);
    }

    if (handLandmarks.length && !state.lockedShape && state.performanceProfile?.drawGuides) {
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

function setFreezeVisible(isVisible) {
    freezeCanvasEl.classList.toggle("is-visible", isVisible);
}

function loadHandsLibrary() {
    if (typeof Hands === "function") {
        return Promise.resolve();
    }

    if (state.handsLibraryPromise) {
        return state.handsLibraryPromise;
    }

    state.handsLibraryPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector("script[data-hands-lib='true']");
        if (existingScript) {
            existingScript.addEventListener("load", resolve, { once: true });
            existingScript.addEventListener("error", () => reject(new Error("Không tải được MediaPipe Hands.")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
        script.async = true;
        script.crossOrigin = "anonymous";
        script.dataset.handsLib = "true";
        script.addEventListener("load", resolve, { once: true });
        script.addEventListener("error", () => reject(new Error("Không tải được MediaPipe Hands.")), { once: true });
        document.head.appendChild(script);
    });

    state.handsLibraryPromise = state.handsLibraryPromise.catch((error) => {
        state.handsLibraryPromise = null;
        throw error;
    });

    return state.handsLibraryPromise;
}

function setGuideOpen(nextOpen) {
    const shouldOpen = Boolean(nextOpen) && state.compactLayout;
    state.guideOpen = shouldOpen;
    guidePanel.classList.toggle("is-open", shouldOpen);
    guideBtn.setAttribute("aria-expanded", String(shouldOpen));
}

function syncLayoutMode() {
    state.performanceProfile = buildPerformanceProfile();
    state.compactLayout = state.performanceProfile.compactLayout;
    state.lowPowerMode = state.performanceProfile.lowPowerMode;
    document.body.classList.toggle("is-low-power", state.lowPowerMode);

    if (state.hands) {
        state.hands.setOptions(state.performanceProfile.handsOptions);
    }

    if (!state.compactLayout) {
        setGuideOpen(false);
    }
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

function resetTracking() {
    state.activeShape = null;
    state.activeLabel = "";
    state.trackingShape = null;
    state.trackingLabel = "";
    state.stableSince = 0;
    state.lastDetectionAt = 0;
    state.progress = 0;
}

function updateLiveStatus() {
    if (!state.cameraRunning) {
        return;
    }

    if (state.lockedShape) {
        setCameraStatus("Đã khóa khung kính", "is-lock");
        return;
    }

    if (state.activeLabel) {
        const percent = Math.max(1, Math.round(state.progress * 100));
        if (state.progress >= 0.08) {
            setCameraStatus(`Giữ ổn định ${state.activeLabel} ${percent}%`, "is-live");
        } else {
            setCameraStatus(`Đang nhận diện ${state.activeLabel}`, "is-waiting");
        }
        return;
    }

    setCameraStatus("Đưa tay vào khung", "is-waiting");
}

function clearLock() {
    state.lockedShape = null;
    state.lockedLabel = "";
    setFreezeVisible(false);
    resetTracking();
    toggleClearButton();
    setGestureTag("");
    updateLiveStatus();
}

function copyCurrentFrameToFrozen(width, height) {
    freezeCanvasEl.width = width;
    freezeCanvasEl.height = height;
    freezeCtx.clearRect(0, 0, width, height);
    freezeCtx.save();
    freezeCtx.scale(-1, 1);
    freezeCtx.drawImage(videoEl, -width, 0, width, height);
    freezeCtx.restore();
    setFreezeVisible(true);
}

function handleGestureState(detected) {
    const now = performance.now();

    if (state.lockedShape) {
        state.activeShape = null;
        state.activeLabel = "";
        state.progress = 1;
        return;
    }

    if (!detected) {
        if (state.activeShape && now - state.lastDetectionAt <= MISS_GRACE_MS) {
            state.progress = Math.max(state.progress - 0.02, 0.04);
            return;
        }

        resetTracking();
        return;
    }

    state.lastDetectionAt = now;
    state.activeShape = interpolateShape(state.activeShape, detected.shape, SHAPE_SMOOTHING);
    state.activeLabel = detected.label;

    const hasStableCandidate = state.trackingShape &&
        state.trackingLabel === detected.label &&
        areShapesStable(detected.shape, state.trackingShape);

    if (!hasStableCandidate) {
        state.trackingShape = cloneShape(detected.shape);
        state.trackingLabel = detected.label;
        state.stableSince = now;
        state.progress = 0.02;
        return;
    }

    state.trackingShape = cloneShape(detected.shape);
    state.progress = clamp((now - state.stableSince) / HOLD_DELAY_MS, 0, 1);

    if (state.progress >= 1 && canvasEl.width && canvasEl.height) {
        state.lockedShape = cloneShape(state.activeShape ?? detected.shape);
        state.lockedLabel = detected.label;
        copyCurrentFrameToFrozen(canvasEl.width, canvasEl.height);
        resetTracking();
        state.progress = 1;
        toggleClearButton();
        setGuideOpen(false);
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
        if (!state.lockedShape) {
            freezeCanvasEl.width = width;
            freezeCanvasEl.height = height;
        }
    }

    toggleLoading(false);
    toggleError(false);

    const landmarks = results.multiHandLandmarks ?? [];
    const detected = detectGesture(landmarks, width, height);

    handleGestureState(detected);

    const source = state.lockedShape ? freezeCanvasEl : videoEl;
    const isSourceMirrored = !state.lockedShape;
    drawFrame(source, width, height, isSourceMirrored, landmarks);

    if (state.lockedShape) {
        setGestureTag(state.lockedLabel);
    } else {
        setGestureTag(state.activeLabel);
    }

    updateLiveStatus();
}

function scheduleNextFrame() {
    if (!state.cameraRunning) {
        return;
    }

    if (typeof videoEl.requestVideoFrameCallback === "function") {
        state.useVideoFrameCallback = true;
        state.rafId = videoEl.requestVideoFrameCallback(() => {
            frameLoop();
        });
        return;
    }

    state.useVideoFrameCallback = false;
    state.rafId = window.requestAnimationFrame(() => {
        frameLoop();
    });
}

function cancelScheduledFrame() {
    if (state.useVideoFrameCallback && typeof videoEl.cancelVideoFrameCallback === "function") {
        videoEl.cancelVideoFrameCallback(state.rafId);
    } else {
        window.cancelAnimationFrame(state.rafId);
    }

    state.rafId = 0;
    state.useVideoFrameCallback = false;
}

async function frameLoop() {
    if (!state.cameraRunning || !state.hands) {
        return;
    }

    const now = performance.now();
    const frameInterval = state.performanceProfile?.frameIntervalMs ?? DESKTOP_FRAME_INTERVAL_MS;

    if (!state.processing && videoEl.readyState >= 2 && now - state.lastProcessedAt >= frameInterval) {
        state.processing = true;
        state.lastProcessedAt = now;
        try {
            await state.hands.send({ image: videoEl });
        } catch (error) {
            console.error("Frame processing error:", error);
        } finally {
            state.processing = false;
        }
    }

    if (!state.cameraRunning) {
        return;
    }

    scheduleNextFrame();
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
        video: state.performanceProfile?.videoConstraints ?? buildPerformanceProfile().videoConstraints
    });

    state.stream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();

    if (videoEl.videoWidth && videoEl.videoHeight) {
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        if (!state.lockedShape) {
            freezeCanvasEl.width = videoEl.videoWidth;
            freezeCanvasEl.height = videoEl.videoHeight;
        }
    }

    state.cameraRunning = true;
    state.lastProcessedAt = 0;
    toggleLoading(false);
    updateLiveStatus();
    if (state.hands) {
        scheduleNextFrame();
    }
}

function stopCamera() {
    if (state.rafId) {
        cancelScheduledFrame();
    }
    state.lastProcessedAt = 0;
    state.cameraRunning = false;
    state.processing = false;

    if (state.stream) {
        state.stream.getTracks().forEach((track) => track.stop());
        state.stream = null;
    }

    videoEl.pause();
    videoEl.srcObject = null;

    if (!state.lockedShape) {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        setFreezeVisible(false);
    }
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
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvasEl.width;
    exportCanvas.height = canvasEl.height;
    const exportCtx = exportCanvas.getContext("2d");

    if (state.lockedShape && freezeCanvasEl.width && freezeCanvasEl.height) {
        exportCtx.drawImage(freezeCanvasEl, 0, 0, exportCanvas.width, exportCanvas.height);
    } else {
        exportCtx.save();
        exportCtx.scale(-1, 1);
        exportCtx.drawImage(videoEl, -exportCanvas.width, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.restore();
    }

    exportCtx.drawImage(canvasEl, 0, 0, exportCanvas.width, exportCanvas.height);

    exportCanvas.toBlob((blob) => {
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
        if (state.guideOpen) {
            setGuideOpen(false);
            return;
        }

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

    state.hands.setOptions(state.performanceProfile?.handsOptions ?? buildPerformanceProfile().handsOptions);

    state.hands.onResults(onResults);
}

async function boot() {
    if (state.bootPromise) {
        return state.bootPromise;
    }

    state.bootPromise = (async () => {
        try {
            syncLayoutMode();
            await startCamera();
            setCameraStatus("Đang tải engine nhận diện", "is-waiting");
            await loadHandsLibrary();
            initHands();
            if (state.cameraRunning && !state.rafId) {
                scheduleNextFrame();
            }
            updateLiveStatus();
        } catch (error) {
            handleCameraError(error);
        } finally {
            state.bootPromise = null;
        }
    })();

    return state.bootPromise;
}

captureBtn.addEventListener("click", () => {
    setGuideOpen(false);
    exportCanvasAsPng();
});
clearBtn.addEventListener("click", clearLock);
guideBtn.addEventListener("click", () => {
    setGuideOpen(!state.guideOpen);
});
retryBtn.addEventListener("click", boot);
canvasEl.addEventListener("click", () => {
    if (state.compactLayout && state.guideOpen) {
        setGuideOpen(false);
        return;
    }

    if (state.lockedShape) {
        clearLock();
    }
});
document.addEventListener("click", (event) => {
    if (!state.compactLayout || !state.guideOpen) {
        return;
    }

    if (guidePanel.contains(event.target) || guideBtn.contains(event.target)) {
        return;
    }

    setGuideOpen(false);
});
document.addEventListener("keydown", handleKeydown);
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        setGuideOpen(false);
        stopCamera();
        return;
    }

    if (!state.cameraRunning) {
        boot();
    }
});
window.addEventListener("resize", syncLayoutMode);
window.addEventListener("pagehide", stopCamera);
window.addEventListener("beforeunload", stopCamera);

syncLayoutMode();
toggleClearButton();
boot();

function buildStickerLibrary() {
    const filenames = [
        "3d-glasses.png", "angry.png", "axolotl (1).png", "axolotl (2).png", "axolotl.png", "beanie.png",
        "chef-hat.png", "cherry-pie.png", "cigarette.png", "corgi.png", "fire.png", "frog (1).png", "frog.png",
        "glasses.png", "handcuff.png", "happy.png", "heart-glasses.png", "hello.png", "hipster.png",
        "necklace (1).png", "necklace (2).png", "necklace.png", "paper-plane.png", "party-hat.png", "pendant.png",
        "proud.png", "rainbow.png", "read.png", "relaxed.png", "rose.png", "sad.png", "santa-hat.png",
        "smile.png", "smoke.png", "studying.png", "sun.png", "tired.png"
    ];

    return filenames.map((name, index) => ({
        id: `sticker-def-${index}`,
        name,
        label: name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        src: `./sticker/${encodeURIComponent(name)}`
    }));
}

function formatCaptureTime(timestamp) {
    return new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
    }).format(timestamp);
}

function canUseStorage() {
    try {
        return typeof window !== "undefined" && "localStorage" in window;
    } catch (error) {
        return false;
    }
}

function createPhotoLabel(prefix = "Ảnh", createdAt = Date.now()) {
    return `${prefix} ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(createdAt)}`;
}

function sanitizeCapturedPhoto(entry) {
    if (!entry || typeof entry !== "object" || typeof entry.dataUrl !== "string" || !entry.dataUrl.startsWith("data:image/")) {
        return null;
    }

    const createdAt = Number(entry.createdAt) || Date.now();
    const prefix = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : "Ảnh";
    return {
        id: typeof entry.id === "string" && entry.id ? entry.id : `photo-${createdAt}-${Math.random().toString(36).slice(2, 7)}`,
        dataUrl: entry.dataUrl,
        createdAt,
        label: prefix
    };
}

function saveCaptureHistory() {
    if (!canUseStorage()) {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_CAPTURE_HISTORY_KEY, JSON.stringify(capturedPhotos.slice(0, MAX_CAPTURE_HISTORY)));
    } catch (error) {
        console.warn("Không lưu được lịch sử ảnh:", error);
    }
}

function loadCaptureHistory() {
    if (!canUseStorage()) {
        return;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_CAPTURE_HISTORY_KEY);
        if (!raw) {
            return;
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return;
        }

        capturedPhotos = parsed
            .map(sanitizeCapturedPhoto)
            .filter(Boolean)
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, MAX_CAPTURE_HISTORY);

        if (capturedPhotos.length) {
            selectedHistoryPhotoId = capturedPhotos[0].id;
            selectedHistoryPhotoIds = [capturedPhotos[0].id];
        }
    } catch (error) {
        console.warn("Không đọc được lịch sử ảnh:", error);
    }
}

function saveUiPreferences() {
    if (!canUseStorage()) {
        return;
    }

    try {
        window.localStorage.setItem(STORAGE_UI_PREFS_KEY, JSON.stringify({
            selectedCaptureDelay,
            collageLayout: editorState.collageLayout,
            frameStyle: editorState.frameStyle
        }));
    } catch (error) {
        console.warn("Không lưu được cấu hình giao diện:", error);
    }
}

function loadUiPreferences() {
    if (!canUseStorage()) {
        return;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_UI_PREFS_KEY);
        if (!raw) {
            return;
        }

        const parsed = JSON.parse(raw);
        if (typeof parsed.selectedCaptureDelay === "number") {
            selectedCaptureDelay = parsed.selectedCaptureDelay;
        }
        if (typeof parsed.collageLayout === "string") {
            editorState.collageLayout = parsed.collageLayout;
        }
        if (typeof parsed.frameStyle === "string") {
            editorState.frameStyle = parsed.frameStyle;
        }
    } catch (error) {
        console.warn("Không đọc được cấu hình giao diện:", error);
    }
}

function deleteHistoryPhoto(photoId) {
    if (!photoId) {
        return;
    }

    capturedPhotos = capturedPhotos.filter((photo) => photo.id !== photoId);
    selectedHistoryPhotoIds = selectedHistoryPhotoIds.filter((id) => id !== photoId);
    if (selectedHistoryPhotoId === photoId) {
        selectedHistoryPhotoId = capturedPhotos[0]?.id ?? "";
    }
    saveCaptureHistory();
    renderHistoryDrawer();
}

function clearAllHistoryPhotos() {
    capturedPhotos = [];
    selectedHistoryPhotoId = "";
    selectedHistoryPhotoIds = [];
    saveCaptureHistory();
    renderHistoryDrawer();
}

async function importPhotosFromFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
        showToast("Không có ảnh hợp lệ để nhập.", 1800);
        return;
    }

    const availableSlots = Math.max(0, MAX_CAPTURE_HISTORY - capturedPhotos.length);
    if (!availableSlots) {
        showToast("Lịch sử đã đầy. Hãy xóa bớt ảnh trước khi nhập.", 2200);
        return;
    }

    const selectedFiles = files.slice(0, availableSlots);
    const imported = [];

    for (const file of selectedFiles) {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`Không thể đọc file ${file.name}`));
            reader.readAsDataURL(file);
        });

        imported.push({
            id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            dataUrl,
            createdAt: Date.now(),
            label: file.name.replace(/\.[^.]+$/, "") || createPhotoLabel("Ảnh nhập")
        });
    }

    capturedPhotos = [...imported.reverse(), ...capturedPhotos].slice(0, MAX_CAPTURE_HISTORY);
    if (capturedPhotos.length) {
        selectedHistoryPhotoId = capturedPhotos[0].id;
        selectedHistoryPhotoIds = [capturedPhotos[0].id];
    }
    saveCaptureHistory();
    renderHistoryDrawer();
    showToast(`✓ Đã nhập ${imported.length} ảnh vào lịch sử.`, 2200);
}

function downloadDataUrl(dataUrl, filename) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
}

function getSelectedHistoryPhoto() {
    return capturedPhotos.find((photo) => photo.id === selectedHistoryPhotoId) ?? null;
}

function getHistorySelectedPhotos() {
    return selectedHistoryPhotoIds
        .map((photoId) => capturedPhotos.find((photo) => photo.id === photoId))
        .filter(Boolean);
}

function getHistoryPhotosForEditor() {
    const selectedPhotos = getHistorySelectedPhotos();
    if (selectedPhotos.length) {
        return selectedPhotos;
    }

    const focusedPhoto = getSelectedHistoryPhoto();
    return focusedPhoto ? [focusedPhoto] : [];
}

function updateOverlayBackdrop() {
    const visible = modeMenuEl.classList.contains("visible") ||
        historyDrawerEl.classList.contains("visible") ||
        researchModalEl.classList.contains("visible");
    overlayBackdropEl.classList.toggle("visible", visible);
    overlayBackdropEl.setAttribute("aria-hidden", String(!visible));
}

function toggleModeMenu(force) {
    const shouldOpen = typeof force === "boolean"
        ? force
        : !modeMenuEl.classList.contains("visible");

    modeMenuEl.classList.toggle("visible", shouldOpen);
    modeMenuEl.setAttribute("aria-hidden", String(!shouldOpen));
    menuBtnEl.setAttribute("aria-expanded", String(shouldOpen));
    updateOverlayBackdrop();
}

function renderCaptureDelayOptions() {
    captureDelayValueEl.textContent = `${selectedCaptureDelay}s`;
    captureDelayMenuEl.querySelectorAll("[data-capture-delay]").forEach((button) => {
        const isActive = Number(button.dataset.captureDelay) === selectedCaptureDelay;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
    saveUiPreferences();
}

function toggleCaptureDelayMenu(force) {
    const shouldOpen = typeof force === "boolean"
        ? force
        : !captureDelayMenuEl.classList.contains("visible");

    captureDelayMenuEl.classList.toggle("visible", shouldOpen);
    captureDelayMenuEl.setAttribute("aria-hidden", String(!shouldOpen));
    captureDelayBtnEl.setAttribute("aria-expanded", String(shouldOpen));
}

function renderCaptureCountdownValue() {
    if (!captureCountdownEndsAt) {
        return;
    }

    const remainingMs = Math.max(0, captureCountdownEndsAt - Date.now());
    const nextValue = Math.max(1, Math.ceil(remainingMs / 1000));
    if (nextValue === captureCountdownLastValue) {
        return;
    }

    captureCountdownLastValue = nextValue;
    captureCountdownValueEl.textContent = String(nextValue);
}

function stopCaptureCountdown(options = {}) {
    const { notifyCancel = false } = options;
    const hadCountdown = Boolean(captureCountdownEndsAt);

    window.clearTimeout(captureCountdownTimeout);
    window.clearInterval(captureCountdownInterval);
    captureCountdownTimeout = 0;
    captureCountdownInterval = 0;
    captureCountdownEndsAt = 0;
    captureCountdownLastValue = 0;
    captureCountdownEl.classList.remove("visible");
    captureBtn.classList.remove("countdown-active");
    captureDelayBtnEl.classList.remove("countdown-active");

    if (notifyCancel && hadCountdown) {
        showToast("Đã hủy hẹn giờ.", 1600);
    }
}

function composeCurrentFrame(targetCanvas) {
    if (!canvasEl.width || !canvasEl.height || (!state.cameraRunning && !state.lockedShape)) {
        return null;
    }

    targetCanvas.width = canvasEl.width;
    targetCanvas.height = canvasEl.height;
    const targetCtx = targetCanvas.getContext("2d", { alpha: false });
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    if (state.lockedShape && freezeCanvasEl.width && freezeCanvasEl.height) {
        targetCtx.drawImage(freezeCanvasEl, 0, 0, targetCanvas.width, targetCanvas.height);
    } else {
        targetCtx.save();
        targetCtx.scale(-1, 1);
        targetCtx.drawImage(videoEl, -targetCanvas.width, 0, targetCanvas.width, targetCanvas.height);
        targetCtx.restore();
    }

    targetCtx.drawImage(canvasEl, 0, 0, targetCanvas.width, targetCanvas.height);
    return targetCanvas;
}

function pushCapturedPhoto(dataUrl, options = {}) {
    const { labelPrefix = "Ảnh" } = options;
    const entry = {
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        dataUrl,
        createdAt: Date.now(),
        label: createPhotoLabel(labelPrefix)
    };

    capturedPhotos.unshift(entry);
    if (capturedPhotos.length > MAX_CAPTURE_HISTORY) {
        capturedPhotos = capturedPhotos.slice(0, MAX_CAPTURE_HISTORY);
    }

    selectedHistoryPhotoId = entry.id;
    selectedHistoryPhotoIds = [entry.id];
    saveCaptureHistory();
    renderHistoryDrawer();
}

function saveCurrentFrame() {
    if (!canvasEl.width || !canvasEl.height) {
        showToast("Camera chưa sẵn sàng để chụp.", 1800);
        return;
    }

    stopCaptureCountdown();
    triggerFlash();

    const snapshotCanvas = composeCurrentFrame(document.createElement("canvas"));
    if (!snapshotCanvas) {
        showToast("Không thể tạo ảnh chụp.", 1800);
        return;
    }

    const dataUrl = snapshotCanvas.toDataURL("image/png");
    pushCapturedPhoto(dataUrl);
    downloadDataUrl(dataUrl, `glass-effects-${Date.now()}.png`);
    if (navigator.vibrate) {
        navigator.vibrate(30);
    }
    showToast("✓ Đã lưu ảnh!", 2200);
}

function startCaptureFlow() {
    setGuideOpen(false);
    toggleModeMenu(false);
    toggleCaptureDelayMenu(false);

    if (captureCountdownEndsAt) {
        stopCaptureCountdown({ notifyCancel: true });
        return;
    }

    if (!selectedCaptureDelay) {
        saveCurrentFrame();
        return;
    }

    captureCountdownEndsAt = Date.now() + selectedCaptureDelay * 1000;
    captureCountdownLabelEl.textContent = "Chuẩn bị chụp";
    captureCountdownEl.classList.add("visible");
    captureBtn.classList.add("countdown-active");
    captureDelayBtnEl.classList.add("countdown-active");
    renderCaptureCountdownValue();

    captureCountdownInterval = window.setInterval(renderCaptureCountdownValue, 120);
    captureCountdownTimeout = window.setTimeout(() => {
        stopCaptureCountdown();
        saveCurrentFrame();
    }, selectedCaptureDelay * 1000);
}

function openHistoryDrawer() {
    toggleModeMenu(false);
    closeResearchModal();
    setGuideOpen(false);
    historyDrawerEl.classList.add("visible");
    historyDrawerEl.setAttribute("aria-hidden", "false");
    renderHistoryDrawer();
    updateOverlayBackdrop();
}

function closeHistoryDrawer() {
    historyDrawerEl.classList.remove("visible");
    historyDrawerEl.setAttribute("aria-hidden", "true");
    updateOverlayBackdrop();
}

function openResearchModal() {
    toggleModeMenu(false);
    closeHistoryDrawer();
    setGuideOpen(false);
    researchModalEl.classList.add("visible");
    researchModalEl.setAttribute("aria-hidden", "false");
    updateOverlayBackdrop();
}

function closeResearchModal() {
    researchModalEl.classList.remove("visible");
    researchModalEl.setAttribute("aria-hidden", "true");
    updateOverlayBackdrop();
}

function clearHistoryPhotoSelection() {
    selectedHistoryPhotoIds = [];
    renderHistoryDrawer();
}

function toggleHistoryPhotoSelection(photoId) {
    if (!photoId) {
        return;
    }

    const exists = selectedHistoryPhotoIds.includes(photoId);
    if (exists) {
        selectedHistoryPhotoIds = selectedHistoryPhotoIds.filter((id) => id !== photoId);
    } else {
        if (selectedHistoryPhotoIds.length >= 4) {
            showToast("Chỉ chọn tối đa 4 ảnh để ghép.", 2200);
            return;
        }

        selectedHistoryPhotoIds = [...selectedHistoryPhotoIds, photoId];
    }

    selectedHistoryPhotoId = photoId;
    renderHistoryDrawer();
}

function renderHistoryDrawer() {
    const hasPhotos = capturedPhotos.length > 0;
    historyEmptyEl.style.display = hasPhotos ? "none" : "block";
    historyListEl.innerHTML = "";

    if (!hasPhotos) {
        selectedHistoryPhotoId = "";
        selectedHistoryPhotoIds = [];
        historyPreviewEl.classList.remove("visible");
        historyPreviewImageEl.removeAttribute("src");
        historySelectionCountEl.textContent = "";
        historyDownloadBtnEl.disabled = true;
        historyEditBtnEl.disabled = true;
        historyDeleteBtnEl.disabled = true;
        historyClearSelectionBtnEl.disabled = true;
        historyClearAllBtnEl.disabled = true;
        return;
    }

    if (!getSelectedHistoryPhoto()) {
        selectedHistoryPhotoId = capturedPhotos[0].id;
    }

    selectedHistoryPhotoIds = selectedHistoryPhotoIds
        .filter((photoId) => capturedPhotos.some((photo) => photo.id === photoId))
        .slice(0, 4);

    for (const photo of capturedPhotos) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `history-item${photo.id === selectedHistoryPhotoId ? " focused" : ""}${selectedHistoryPhotoIds.includes(photo.id) ? " selected" : ""}`;
        item.dataset.photoId = photo.id;
        item.innerHTML = `
            <span class="history-item-toggle" data-toggle-photo-id="${photo.id}" aria-label="${selectedHistoryPhotoIds.includes(photo.id) ? "Bỏ chọn ảnh" : "Chọn ảnh để ghép"}">${selectedHistoryPhotoIds.includes(photo.id) ? "✓" : "+"}</span>
            <img src="${photo.dataUrl}" alt="${photo.label}">
            <div class="history-item-meta">
                <strong>${photo.label}</strong>
                <span>${formatCaptureTime(photo.createdAt)}</span>
            </div>
        `;
        historyListEl.appendChild(item);
    }

    const selectedPhoto = getSelectedHistoryPhoto();
    historyPreviewEl.classList.toggle("visible", Boolean(selectedPhoto));
    if (!selectedPhoto) {
        historyDownloadBtnEl.disabled = true;
        historyEditBtnEl.disabled = true;
        historyDeleteBtnEl.disabled = true;
        historyClearSelectionBtnEl.disabled = true;
        historyClearAllBtnEl.disabled = true;
        return;
    }

    historyPreviewImageEl.src = selectedPhoto.dataUrl;
    historyPreviewTitleEl.textContent = selectedPhoto.label;
    historyPreviewTimeEl.textContent = `Đã lưu lúc ${formatCaptureTime(selectedPhoto.createdAt)}`;
    historySelectionCountEl.textContent = selectedHistoryPhotoIds.length
        ? `Đã chọn ${selectedHistoryPhotoIds.length}/4 ảnh để ghép trong editor.`
        : "Chưa chọn ảnh ghép. Nếu mở editor ngay, hệ thống sẽ dùng ảnh đang xem.";

    const editorPhotos = getHistoryPhotosForEditor();
    historyDownloadBtnEl.disabled = false;
    historyEditBtnEl.disabled = editorPhotos.length === 0;
    historyDeleteBtnEl.disabled = false;
    historyEditBtnEl.textContent = editorPhotos.length > 1
        ? `Mở chỉnh sửa (${editorPhotos.length} ảnh)`
        : "Mở chỉnh sửa";
    historyClearSelectionBtnEl.disabled = selectedHistoryPhotoIds.length === 0;
    historyClearAllBtnEl.disabled = !capturedPhotos.length;
}

function loadImageCached(src) {
    if (imageCache.has(src)) {
        return imageCache.get(src);
    }

    const imagePromise = new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Không thể tải ảnh: ${src}`));
        image.src = src;
    });

    imageCache.set(src, imagePromise);
    return imagePromise;
}

function getEditorSelectedPhotos() {
    return editorState.selectedPhotoIds
        .map((photoId) => capturedPhotos.find((photo) => photo.id === photoId))
        .filter(Boolean);
}

function getEditorSelectedSticker() {
    return editorState.activeStickers.find((sticker) => sticker.id === editorState.selectedStickerId) ?? null;
}

function createStickerRenderSurface(image, width, height) {
    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = Math.max(1, Math.round(width));
    renderCanvas.height = Math.max(1, Math.round(height));
    const renderCtx = renderCanvas.getContext("2d", { willReadFrequently: true });
    renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
    renderCtx.drawImage(image, 0, 0, renderCanvas.width, renderCanvas.height);
    return { renderCanvas, renderCtx };
}

function getStickerCanvasCoordinates(sticker, stageX, stageY) {
    const dx = stageX - sticker.x;
    const dy = stageY - sticker.y;
    const cos = Math.cos(-sticker.rotation);
    const sin = Math.sin(-sticker.rotation);
    const rotatedX = dx * cos - dy * sin;
    const rotatedY = dx * sin + dy * cos;
    const scaledX = rotatedX / (sticker.scale * sticker.flipX);
    const scaledY = rotatedY / (sticker.scale * sticker.flipY);
    const canvasX = scaledX + sticker.width / 2;
    const canvasY = scaledY + sticker.height / 2;

    return {
        canvasX,
        canvasY,
        inside: canvasX >= 0 && canvasX <= sticker.width && canvasY >= 0 && canvasY <= sticker.height
    };
}

function isStickerPixelVisible(sticker, canvasX, canvasY) {
    if (!sticker.renderCtx || !sticker.renderCanvas) {
        return true;
    }

    const px = clamp(Math.floor(canvasX), 0, sticker.renderCanvas.width - 1);
    const py = clamp(Math.floor(canvasY), 0, sticker.renderCanvas.height - 1);
    return sticker.renderCtx.getImageData(px, py, 1, 1).data[3] > 8;
}

function getEditorCanvasPoint(event) {
    const rect = editorCanvasEl.getBoundingClientRect();
    return {
        x: (event.clientX - rect.left) * (editorCanvasEl.width / rect.width),
        y: (event.clientY - rect.top) * (editorCanvasEl.height / rect.height)
    };
}

function findStickerAtPoint(x, y) {
    for (let index = editorState.activeStickers.length - 1; index >= 0; index -= 1) {
        const sticker = editorState.activeStickers[index];
        const localPoint = getStickerCanvasCoordinates(sticker, x, y);
        if (!localPoint.inside) {
            continue;
        }
        if (!isStickerPixelVisible(sticker, localPoint.canvasX, localPoint.canvasY)) {
            continue;
        }
        return sticker;
    }

    return null;
}

function eraseStickerStroke(sticker, fromPoint, toPoint) {
    if (!sticker?.renderCtx) {
        return;
    }

    const from = getStickerCanvasCoordinates(sticker, fromPoint.x, fromPoint.y);
    const to = getStickerCanvasCoordinates(sticker, toPoint.x, toPoint.y);
    const brushRadius = editorState.eraserRadius / Math.max(0.01, sticker.scale);

    sticker.renderCtx.save();
    sticker.renderCtx.globalCompositeOperation = "destination-out";
    sticker.renderCtx.lineCap = "round";
    sticker.renderCtx.lineJoin = "round";
    sticker.renderCtx.lineWidth = brushRadius * 2;
    sticker.renderCtx.beginPath();
    sticker.renderCtx.moveTo(from.canvasX, from.canvasY);
    sticker.renderCtx.lineTo(to.canvasX, to.canvasY);
    sticker.renderCtx.stroke();
    sticker.renderCtx.beginPath();
    sticker.renderCtx.arc(to.canvasX, to.canvasY, brushRadius, 0, TAU);
    sticker.renderCtx.fill();
    sticker.renderCtx.restore();
}

function updateEraserCursor(point) {
    if (!editorState.eraserEnabled || !point) {
        editorState.eraserCursorVisible = false;
        return;
    }

    editorState.eraserCursorVisible = true;
    editorState.eraserCursorX = point.x;
    editorState.eraserCursorY = point.y;
}

function drawEraserCursor(targetCtx) {
    if (!editorState.eraserEnabled || !editorState.eraserCursorVisible) {
        return;
    }

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.arc(editorState.eraserCursorX, editorState.eraserCursorY, editorState.eraserRadius, 0, TAU);
    targetCtx.fillStyle = "rgba(255, 255, 255, 0.14)";
    targetCtx.fill();
    targetCtx.lineWidth = 2;
    targetCtx.strokeStyle = "rgba(255, 255, 255, 0.98)";
    targetCtx.shadowColor = "rgba(15, 23, 42, 0.35)";
    targetCtx.shadowBlur = 6;
    targetCtx.stroke();
    targetCtx.restore();
}

function syncStickerControls() {
    const sticker = getEditorSelectedSticker();
    const disabled = !sticker;

    if (!sticker) {
        editorState.eraserEnabled = false;
        editorState.erasingStickerId = null;
        editorState.eraseLastPoint = null;
        editorState.eraserCursorVisible = false;
    }

    stickerScaleRangeEl.disabled = disabled;
    stickerRotationRangeEl.disabled = disabled;
    stickerEraserRangeEl.disabled = disabled || !editorState.eraserEnabled;
    stickerEraserToggleBtnEl.disabled = disabled;
    stickerFlipXBtnEl.disabled = disabled;
    stickerFlipYBtnEl.disabled = disabled;
    stickerRemoveBtnEl.disabled = disabled;
    stickerEraserToggleBtnEl.classList.toggle("active", Boolean(sticker) && editorState.eraserEnabled);
    stickerEraserToggleBtnEl.textContent = editorState.eraserEnabled ? "Tắt gôm" : "Bật gôm";
    stickerEraserRangeEl.value = String(editorState.eraserRadius);
    stickerEraserSizeValueEl.textContent = `${editorState.eraserRadius} px`;
    editorCanvasEl.classList.toggle("eraser-active", Boolean(sticker) && editorState.eraserEnabled);

    if (!sticker) {
        stickerScaleRangeEl.value = "100";
        stickerRotationRangeEl.value = "0";
        editorSelectionNoteEl.textContent = "Chọn một sticker trong thư viện rồi kéo trực tiếp trên khung. Có thể bật gôm để xóa từng phần trên sticker.";
        return;
    }

    stickerScaleRangeEl.value = String(Math.round(sticker.scale * 100));
    stickerRotationRangeEl.value = String(Math.round(sticker.rotation * 180 / Math.PI));
    editorSelectionNoteEl.textContent = editorState.eraserEnabled
        ? `Gôm đang bật cho ${sticker.label}. Kéo trực tiếp trên sticker để xóa tự do.`
        : `Đang chọn: ${sticker.label}. Kéo để di chuyển, cuộn để zoom, Shift + cuộn để xoay nhanh.`;
}

function renderEditorLayoutOptions() {
    editorLayoutOptionsEl.innerHTML = COLLAGE_LAYOUTS.map((layout) => `
        <button class="editor-option${layout.id === editorState.collageLayout ? " selected" : ""}" type="button" data-layout-id="${layout.id}">
            <strong>${layout.label}</strong>
            <span>${layout.hint}</span>
        </button>
    `).join("");
}

function renderEditorFrameOptions() {
    editorFrameOptionsEl.innerHTML = FRAME_STYLES.map((frame) => `
        <button class="editor-option${frame.id === editorState.frameStyle ? " selected" : ""}" type="button" data-frame-id="${frame.id}">
            <strong>${frame.label}</strong>
            <span>${frame.hint}</span>
        </button>
    `).join("");
}

function renderEditorPhotoPicker() {
    if (!capturedPhotos.length) {
        editorPhotoPickerEl.innerHTML = '<div class="editor-empty">Chưa có ảnh nào để ghép.</div>';
        return;
    }

    editorPhotoPickerEl.innerHTML = capturedPhotos.map((photo) => `
        <button class="editor-photo-chip${editorState.selectedPhotoIds.includes(photo.id) ? " selected" : ""}" type="button" data-photo-id="${photo.id}">
            <img src="${photo.dataUrl}" alt="${photo.label}">
            <div class="editor-photo-chip-meta">
                <strong>${photo.label}</strong>
                <span>${formatCaptureTime(photo.createdAt)}</span>
            </div>
        </button>
    `).join("");
}

function renderStickerLibrary() {
    const keyword = editorState.stickerSearch.trim().toLowerCase();
    const filtered = STICKER_LIBRARY.filter((sticker) => {
        if (!keyword) {
            return true;
        }

        return sticker.label.toLowerCase().includes(keyword) || sticker.name.toLowerCase().includes(keyword);
    });

    if (!filtered.length) {
        stickerListEl.innerHTML = '<div class="editor-empty">Không tìm thấy sticker phù hợp.</div>';
        return;
    }

    stickerListEl.innerHTML = filtered.map((sticker) => `
        <button class="sticker-item" type="button" data-sticker-id="${sticker.id}">
            <img src="${sticker.src}" alt="${sticker.label}">
            <span>${sticker.label}</span>
        </button>
    `).join("");
}

function renderEditorPanels() {
    renderEditorLayoutOptions();
    renderEditorFrameOptions();
    renderEditorPhotoPicker();
    renderStickerLibrary();
    syncStickerControls();
}

function closeEditor() {
    editorOverlayEl.classList.remove("visible");
    editorOverlayEl.setAttribute("aria-hidden", "true");
    editorState.isOpen = false;
    editorState.dragStickerId = null;
    editorState.eraserEnabled = false;
    editorState.erasingStickerId = null;
    editorState.eraseLastPoint = null;
    editorState.eraserCursorVisible = false;
    editorCanvasEl.classList.remove("dragging");
    editorCanvasEl.classList.remove("eraser-active");
}

function openEditorFromHistory() {
    const editorPhotos = getHistoryPhotosForEditor();
    if (!editorPhotos.length) {
        showToast("Hãy chọn một ảnh trong lịch sử trước.", 2200);
        return;
    }

    closeHistoryDrawer();
    toggleModeMenu(false);
    setGuideOpen(false);
    editorState.isOpen = true;
    editorState.selectedPhotoIds = editorPhotos.map((photo) => photo.id);
    editorState.collageLayout = editorPhotos.length >= 3
        ? "grid"
        : editorPhotos.length === 2
            ? "split-v"
            : "single";
    editorState.frameStyle = "classic";
    editorState.activeStickers = [];
    editorState.selectedStickerId = null;
    editorState.stickerSearch = "";
    editorState.dragStickerId = null;
    editorState.eraserEnabled = false;
    editorState.erasingStickerId = null;
    editorState.eraseLastPoint = null;
    editorState.eraserCursorVisible = false;
    stickerSearchInputEl.value = "";

    editorOverlayEl.classList.add("visible");
    editorOverlayEl.setAttribute("aria-hidden", "false");
    renderEditorPanels();
    renderEditorCanvas();
}

function toggleEditorPhotoSelection(photoId) {
    const exists = editorState.selectedPhotoIds.includes(photoId);

    if (exists) {
        if (editorState.selectedPhotoIds.length === 1) {
            showToast("Editor cần giữ ít nhất 1 ảnh.", 2200);
            return;
        }
        editorState.selectedPhotoIds = editorState.selectedPhotoIds.filter((id) => id !== photoId);
    } else {
        if (editorState.selectedPhotoIds.length >= 4) {
            showToast("Ghép ảnh tối đa 4 tấm ở bước này.", 2200);
            return;
        }
        editorState.selectedPhotoIds = [...editorState.selectedPhotoIds, photoId];
    }

    renderEditorPhotoPicker();
    renderEditorCanvas();
}

async function addStickerToEditor(stickerId) {
    const definition = STICKER_LIBRARY.find((sticker) => sticker.id === stickerId);
    if (!definition) {
        return;
    }

    const image = await loadImageCached(definition.src);
    const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const fitRatio = 190 / Math.max(1, longestSide);
    const sticker = {
        id: `active-sticker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: definition.label,
        src: definition.src,
        width: Math.round((image.naturalWidth || image.width) * fitRatio),
        height: Math.round((image.naturalHeight || image.height) * fitRatio),
        x: editorCanvasEl.width / 2,
        y: editorCanvasEl.height / 2,
        scale: 1,
        rotation: 0,
        flipX: 1,
        flipY: 1
    };
    const renderSurface = createStickerRenderSurface(image, sticker.width, sticker.height);
    sticker.renderCanvas = renderSurface.renderCanvas;
    sticker.renderCtx = renderSurface.renderCtx;

    editorState.activeStickers.push(sticker);
    editorState.selectedStickerId = sticker.id;
    await renderEditorCanvas();
}

function drawRoundedRectPath(targetCtx, x, y, width, height, radius) {
    const nextRadius = Math.min(radius, width / 2, height / 2);
    targetCtx.beginPath();
    targetCtx.moveTo(x + nextRadius, y);
    targetCtx.lineTo(x + width - nextRadius, y);
    targetCtx.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
    targetCtx.lineTo(x + width, y + height - nextRadius);
    targetCtx.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
    targetCtx.lineTo(x + nextRadius, y + height);
    targetCtx.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
    targetCtx.lineTo(x, y + nextRadius);
    targetCtx.quadraticCurveTo(x, y, x + nextRadius, y);
    targetCtx.closePath();
}

function getLayoutSlots(layoutId, count, width, height) {
    const outer = 58;
    const gap = 18;
    const full = { x: outer, y: outer, w: width - outer * 2, h: height - outer * 2 };

    if (count <= 1 || layoutId === "single") {
        return [full];
    }

    if (layoutId === "split-v") {
        const slotWidth = (full.w - gap) / 2;
        return [
            { x: full.x, y: full.y, w: slotWidth, h: full.h },
            { x: full.x + slotWidth + gap, y: full.y, w: slotWidth, h: full.h }
        ];
    }

    if (layoutId === "split-h") {
        const slotHeight = (full.h - gap) / 2;
        return [
            { x: full.x, y: full.y, w: full.w, h: slotHeight },
            { x: full.x, y: full.y + slotHeight + gap, w: full.w, h: slotHeight }
        ];
    }

    if (count === 2) {
        const slotWidth = (full.w - gap) / 2;
        return [
            { x: full.x, y: full.y, w: slotWidth, h: full.h },
            { x: full.x + slotWidth + gap, y: full.y, w: slotWidth, h: full.h }
        ];
    }

    if (count === 3) {
        const topHeight = (full.h - gap) * 0.48;
        const bottomHeight = full.h - gap - topHeight;
        const topWidth = (full.w - gap) / 2;
        return [
            { x: full.x, y: full.y, w: topWidth, h: topHeight },
            { x: full.x + topWidth + gap, y: full.y, w: topWidth, h: topHeight },
            { x: full.x, y: full.y + topHeight + gap, w: full.w, h: bottomHeight }
        ];
    }

    const slotWidth = (full.w - gap) / 2;
    const slotHeight = (full.h - gap) / 2;
    return [
        { x: full.x, y: full.y, w: slotWidth, h: slotHeight },
        { x: full.x + slotWidth + gap, y: full.y, w: slotWidth, h: slotHeight },
        { x: full.x, y: full.y + slotHeight + gap, w: slotWidth, h: slotHeight },
        { x: full.x + slotWidth + gap, y: full.y + slotHeight + gap, w: slotWidth, h: slotHeight }
    ];
}

function drawImageCover(targetCtx, image, slot) {
    const coverScale = Math.max(slot.w / image.width, slot.h / image.height);
    const coverWidth = image.width * coverScale;
    const coverHeight = image.height * coverScale;
    const coverX = slot.x + (slot.w - coverWidth) / 2;
    const coverY = slot.y + (slot.h - coverHeight) / 2;
    const fitScale = Math.min(slot.w / image.width, slot.h / image.height);
    const fitWidth = image.width * fitScale;
    const fitHeight = image.height * fitScale;
    const fitX = slot.x + (slot.w - fitWidth) / 2;
    const fitY = slot.y + (slot.h - fitHeight) / 2;

    targetCtx.save();
    drawRoundedRectPath(targetCtx, slot.x, slot.y, slot.w, slot.h, 18);
    targetCtx.clip();
    targetCtx.fillStyle = "#edf2f7";
    targetCtx.fillRect(slot.x, slot.y, slot.w, slot.h);

    targetCtx.save();
    targetCtx.globalAlpha = 0.24;
    targetCtx.filter = "blur(18px) saturate(1.05)";
    targetCtx.drawImage(image, coverX, coverY, coverWidth, coverHeight);
    targetCtx.restore();

    const glow = targetCtx.createLinearGradient(slot.x, slot.y, slot.x, slot.y + slot.h);
    glow.addColorStop(0, "rgba(255,255,255,0.42)");
    glow.addColorStop(1, "rgba(255,255,255,0.08)");
    targetCtx.fillStyle = glow;
    targetCtx.fillRect(slot.x, slot.y, slot.w, slot.h);
    targetCtx.drawImage(image, fitX, fitY, fitWidth, fitHeight);
    targetCtx.restore();

    targetCtx.save();
    drawRoundedRectPath(targetCtx, slot.x + 0.75, slot.y + 0.75, slot.w - 1.5, slot.h - 1.5, 18);
    targetCtx.strokeStyle = "rgba(255,255,255,0.82)";
    targetCtx.lineWidth = 1.5;
    targetCtx.stroke();
    targetCtx.restore();
}

function drawEditorFrame(targetCtx, width, height) {
    const inset = 22;

    if (editorState.frameStyle === "none") {
        return;
    }

    if (editorState.frameStyle === "classic") {
        targetCtx.save();
        targetCtx.lineWidth = 18;
        targetCtx.strokeStyle = "#ffffff";
        targetCtx.shadowColor = "rgba(15,23,42,0.25)";
        targetCtx.shadowBlur = 14;
        targetCtx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        targetCtx.restore();
        return;
    }

    if (editorState.frameStyle === "polaroid") {
        targetCtx.save();
        targetCtx.fillStyle = "#ffffff";
        targetCtx.fillRect(18, 18, width - 36, 26);
        targetCtx.fillRect(18, 18, 26, height - 36);
        targetCtx.fillRect(width - 44, 18, 26, height - 36);
        targetCtx.fillRect(18, height - 118, width - 36, 100);
        targetCtx.restore();
        return;
    }

    if (editorState.frameStyle === "neon") {
        const gradient = targetCtx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#22d3ee");
        gradient.addColorStop(0.5, "#818cf8");
        gradient.addColorStop(1, "#f472b6");
        targetCtx.save();
        targetCtx.strokeStyle = gradient;
        targetCtx.lineWidth = 14;
        targetCtx.shadowColor = "rgba(129,140,248,0.55)";
        targetCtx.shadowBlur = 18;
        targetCtx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
        targetCtx.restore();
        return;
    }

    if (editorState.frameStyle === "film") {
        targetCtx.save();
        targetCtx.fillStyle = "#121212";
        targetCtx.fillRect(16, 16, width - 32, 34);
        targetCtx.fillRect(16, height - 50, width - 32, 34);
        targetCtx.fillRect(16, 16, 34, height - 32);
        targetCtx.fillRect(width - 50, 16, 34, height - 32);
        targetCtx.fillStyle = "#fef08a";
        for (let y = 74; y < height - 74; y += 62) {
            targetCtx.fillRect(24, y, 14, 28);
            targetCtx.fillRect(width - 38, y, 14, 28);
        }
        targetCtx.restore();
    }
}

function drawSticker(targetCtx, sticker, image, includeSelection) {
    const source = sticker.renderCanvas || image;
    if (!source) {
        return;
    }

    targetCtx.save();
    targetCtx.translate(sticker.x, sticker.y);
    targetCtx.rotate(sticker.rotation);
    targetCtx.scale(sticker.scale * sticker.flipX, sticker.scale * sticker.flipY);
    targetCtx.drawImage(source, -sticker.width / 2, -sticker.height / 2, sticker.width, sticker.height);

    if (includeSelection && sticker.id === editorState.selectedStickerId) {
        targetCtx.strokeStyle = "rgba(34,197,94,0.95)";
        targetCtx.lineWidth = 3 / Math.max(sticker.scale, 0.35);
        targetCtx.setLineDash([10 / Math.max(sticker.scale, 0.35), 8 / Math.max(sticker.scale, 0.35)]);
        targetCtx.strokeRect(
            -sticker.width / 2 - 10 / Math.max(sticker.scale, 0.35),
            -sticker.height / 2 - 10 / Math.max(sticker.scale, 0.35),
            sticker.width + 20 / Math.max(sticker.scale, 0.35),
            sticker.height + 20 / Math.max(sticker.scale, 0.35)
        );
        targetCtx.setLineDash([]);
    }

    targetCtx.restore();
}

async function renderEditorScene(targetCtx, targetCanvas, includeSelection, token = editorState.renderToken) {
    const width = targetCanvas.width;
    const height = targetCanvas.height;
    const selectedPhotos = getEditorSelectedPhotos();
    const photoImages = await Promise.all(selectedPhotos.map((photo) => loadImageCached(photo.dataUrl)));
    const stickerSnapshot = editorState.activeStickers.map((sticker) => ({ ...sticker }));
    const stickerImages = await Promise.all(stickerSnapshot.map((sticker) => loadImageCached(sticker.src)));

    if (targetCtx === editorCtx && token !== editorState.renderToken) {
        return false;
    }

    targetCtx.clearRect(0, 0, width, height);
    targetCtx.fillStyle = "#f8fafc";
    targetCtx.fillRect(0, 0, width, height);
    targetCtx.fillStyle = "#e2e8f0";
    targetCtx.fillRect(42, 42, width - 84, height - 84);

    if (!photoImages.length) {
        targetCtx.fillStyle = "#0f172a";
        targetCtx.font = '600 34px "Sora", sans-serif';
        targetCtx.textAlign = "center";
        targetCtx.fillText("Chưa có ảnh để chỉnh sửa", width / 2, height / 2);
    } else {
        const slots = getLayoutSlots(editorState.collageLayout, photoImages.length, width, height);
        photoImages.slice(0, slots.length).forEach((image, index) => {
            drawImageCover(targetCtx, image, slots[index]);
        });
    }

    drawEditorFrame(targetCtx, width, height);
    stickerSnapshot.forEach((sticker, index) => drawSticker(targetCtx, sticker, stickerImages[index], includeSelection));
    return true;
}

async function renderEditorCanvas() {
    if (!editorState.isOpen) {
        return;
    }

    const token = ++editorState.renderToken;
    const rendered = await renderEditorScene(editorCtx, editorCanvasEl, true, token);
    if (!rendered || token !== editorState.renderToken) {
        return;
    }

    syncStickerControls();
    drawEraserCursor(editorCtx);
}

async function exportEditorImage() {
    if (!editorState.isOpen) {
        return;
    }

    await renderEditorScene(editorExportCtx, editorExportCanvasEl, false, -1);
    const dataUrl = editorExportCanvasEl.toDataURL("image/png");
    pushCapturedPhoto(dataUrl, { labelPrefix: "Editor" });
    downloadDataUrl(dataUrl, `picai-editor-${Date.now()}.png`);
    showToast("✓ Đã xuất ảnh PNG!", 2400);
}

function stopStickerDrag(pointerId) {
    editorState.dragStickerId = null;
    editorState.erasingStickerId = null;
    editorState.eraseLastPoint = null;
    editorCanvasEl.classList.remove("dragging");
    try {
        if (pointerId !== undefined) {
            editorCanvasEl.releasePointerCapture(pointerId);
        }
    } catch (error) {
        // ignore pointer capture release failures
    }
}

function setCaptureButtonFallback(isFallbackVisible) {
    captureBtn.classList.toggle("fallback-visible", isFallbackVisible);
}

function setCaptureDelayButtonFallback(isFallbackVisible) {
    captureDelayBtnEl.classList.toggle("fallback-visible", isFallbackVisible);
}

function initializeExtendedUi() {
    loadUiPreferences();
    loadCaptureHistory();

    if (captureBtnImgEl) {
        captureBtnImgEl.addEventListener("load", () => setCaptureButtonFallback(false));
        captureBtnImgEl.addEventListener("error", () => setCaptureButtonFallback(true));
        if (captureBtnImgEl.complete) {
            setCaptureButtonFallback(!(captureBtnImgEl.naturalWidth > 0));
        }
    }

    if (captureDelayBtnImgEl) {
        captureDelayBtnImgEl.addEventListener("load", () => setCaptureDelayButtonFallback(false));
        captureDelayBtnImgEl.addEventListener("error", () => setCaptureDelayButtonFallback(true));
        if (captureDelayBtnImgEl.complete) {
            setCaptureDelayButtonFallback(!(captureDelayBtnImgEl.naturalWidth > 0));
        }
    }

    renderCaptureDelayOptions();
    renderHistoryDrawer();

    captureDelayBtnEl.addEventListener("click", (event) => {
        event.stopPropagation();
        if (captureCountdownEndsAt) {
            stopCaptureCountdown({ notifyCancel: true });
            return;
        }
        toggleCaptureDelayMenu();
    });

    captureDelayMenuEl.addEventListener("click", (event) => {
        const option = event.target.closest("[data-capture-delay]");
        if (!option) {
            return;
        }

        selectedCaptureDelay = Number(option.dataset.captureDelay);
        renderCaptureDelayOptions();
        toggleCaptureDelayMenu(false);
        showToast(selectedCaptureDelay > 0 ? `⏱ Hẹn giờ ${selectedCaptureDelay} giây` : "⚡ Chụp ngay", 1700);
    });

    menuBtnEl.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleModeMenu();
    });
    historyModeBtnEl.addEventListener("click", openHistoryDrawer);
    photobookModeBtnEl.addEventListener("click", openResearchModal);
    historyCloseBtnEl.addEventListener("click", closeHistoryDrawer);
    researchCloseBtnEl.addEventListener("click", closeResearchModal);
    overlayBackdropEl.addEventListener("click", () => {
        toggleModeMenu(false);
        closeHistoryDrawer();
        closeResearchModal();
    });

    historyListEl.addEventListener("click", (event) => {
        const toggle = event.target.closest("[data-toggle-photo-id]");
        if (toggle) {
            toggleHistoryPhotoSelection(toggle.dataset.togglePhotoId);
            return;
        }

        const item = event.target.closest(".history-item");
        if (!item) {
            return;
        }

        selectedHistoryPhotoId = item.dataset.photoId;
        renderHistoryDrawer();
    });

    historyDownloadBtnEl.addEventListener("click", () => {
        const photo = getSelectedHistoryPhoto();
        if (!photo) {
            return;
        }

        downloadDataUrl(photo.dataUrl, `${photo.id}.png`);
        showToast("✓ Đã tải lại ảnh đã chọn!", 2000);
    });
    historyEditBtnEl.addEventListener("click", openEditorFromHistory);
    historyDeleteBtnEl.addEventListener("click", () => {
        const photo = getSelectedHistoryPhoto();
        if (!photo) {
            return;
        }
        deleteHistoryPhoto(photo.id);
        showToast("Đã xóa ảnh khỏi lịch sử.", 1800);
    });
    historyImportBtnEl.addEventListener("click", () => photoImportInputEl?.click());
    photoImportInputEl?.addEventListener("change", async (event) => {
        await importPhotosFromFiles(event.target.files);
        event.target.value = "";
    });
    historyClearAllBtnEl.addEventListener("click", () => {
        if (!capturedPhotos.length) {
            return;
        }
        clearAllHistoryPhotos();
        showToast("Đã xóa toàn bộ lịch sử ảnh.", 1800);
    });
    historyClearSelectionBtnEl.addEventListener("click", clearHistoryPhotoSelection);

    document.addEventListener("click", (event) => {
        if (modeMenuEl.classList.contains("visible") && !modeMenuEl.contains(event.target) && !menuBtnEl.contains(event.target)) {
            toggleModeMenu(false);
        }

        if (captureDelayMenuEl.classList.contains("visible") && !captureDelayMenuEl.contains(event.target) && !captureDelayBtnEl.contains(event.target)) {
            toggleCaptureDelayMenu(false);
        }
    });

    editorCloseBtnEl.addEventListener("click", closeEditor);
    editorDownloadBtnEl.addEventListener("click", exportEditorImage);

    editorLayoutOptionsEl.addEventListener("click", (event) => {
        const button = event.target.closest("[data-layout-id]");
        if (!button) {
            return;
        }

        editorState.collageLayout = button.dataset.layoutId;
        saveUiPreferences();
        renderEditorLayoutOptions();
        renderEditorCanvas();
    });

    editorFrameOptionsEl.addEventListener("click", (event) => {
        const button = event.target.closest("[data-frame-id]");
        if (!button) {
            return;
        }

        editorState.frameStyle = button.dataset.frameId;
        saveUiPreferences();
        renderEditorFrameOptions();
        renderEditorCanvas();
    });

    editorPhotoPickerEl.addEventListener("click", (event) => {
        const button = event.target.closest("[data-photo-id]");
        if (!button) {
            return;
        }
        toggleEditorPhotoSelection(button.dataset.photoId);
    });

    stickerSearchInputEl.addEventListener("input", (event) => {
        editorState.stickerSearch = event.target.value;
        renderStickerLibrary();
    });

    stickerListEl.addEventListener("click", (event) => {
        const button = event.target.closest("[data-sticker-id]");
        if (!button) {
            return;
        }
        addStickerToEditor(button.dataset.stickerId);
    });

    stickerScaleRangeEl.addEventListener("input", (event) => {
        const sticker = getEditorSelectedSticker();
        if (!sticker) {
            return;
        }
        sticker.scale = Number(event.target.value) / 100;
        renderEditorCanvas();
    });

    stickerRotationRangeEl.addEventListener("input", (event) => {
        const sticker = getEditorSelectedSticker();
        if (!sticker) {
            return;
        }
        sticker.rotation = Number(event.target.value) * Math.PI / 180;
        renderEditorCanvas();
    });

    stickerEraserRangeEl.addEventListener("input", (event) => {
        editorState.eraserRadius = Number(event.target.value);
        syncStickerControls();
    });

    stickerEraserToggleBtnEl.addEventListener("click", () => {
        const sticker = getEditorSelectedSticker();
        if (!sticker) {
            return;
        }
        editorState.eraserEnabled = !editorState.eraserEnabled;
        editorState.dragStickerId = null;
        editorState.erasingStickerId = null;
        editorState.eraseLastPoint = null;
        editorState.eraserCursorVisible = false;
        editorCanvasEl.classList.remove("dragging");
        syncStickerControls();
        renderEditorCanvas();
    });

    stickerFlipXBtnEl.addEventListener("click", () => {
        const sticker = getEditorSelectedSticker();
        if (!sticker) {
            return;
        }
        sticker.flipX *= -1;
        renderEditorCanvas();
    });

    stickerFlipYBtnEl.addEventListener("click", () => {
        const sticker = getEditorSelectedSticker();
        if (!sticker) {
            return;
        }
        sticker.flipY *= -1;
        renderEditorCanvas();
    });

    stickerRemoveBtnEl.addEventListener("click", () => {
        if (!editorState.selectedStickerId) {
            return;
        }
        editorState.activeStickers = editorState.activeStickers.filter((sticker) => sticker.id !== editorState.selectedStickerId);
        editorState.selectedStickerId = null;
        renderEditorCanvas();
    });

    editorCanvasEl.addEventListener("pointerdown", (event) => {
        if (!editorState.isOpen) {
            return;
        }

        const point = getEditorCanvasPoint(event);
        updateEraserCursor(point);
        const sticker = findStickerAtPoint(point.x, point.y);

        if (editorState.eraserEnabled) {
            const targetSticker = sticker || getEditorSelectedSticker();
            if (!targetSticker) {
                editorState.selectedStickerId = null;
                editorState.erasingStickerId = null;
                renderEditorCanvas();
                return;
            }

            editorState.selectedStickerId = targetSticker.id;
            editorState.erasingStickerId = targetSticker.id;
            editorState.eraseLastPoint = point;
            eraseStickerStroke(targetSticker, point, point);
            editorCanvasEl.setPointerCapture(event.pointerId);
            renderEditorCanvas();
            return;
        }

        if (!sticker) {
            editorState.selectedStickerId = null;
            renderEditorCanvas();
            return;
        }

        editorState.selectedStickerId = sticker.id;
        editorState.dragStickerId = sticker.id;
        editorState.dragOffsetX = point.x - sticker.x;
        editorState.dragOffsetY = point.y - sticker.y;
        editorCanvasEl.setPointerCapture(event.pointerId);
        editorCanvasEl.classList.add("dragging");
        renderEditorCanvas();
    });

    editorCanvasEl.addEventListener("pointermove", (event) => {
        const point = getEditorCanvasPoint(event);
        if (editorState.eraserEnabled) {
            updateEraserCursor(point);
        }

        if (editorState.erasingStickerId) {
            const sticker = getEditorSelectedSticker();
            if (!sticker) {
                return;
            }
            eraseStickerStroke(sticker, editorState.eraseLastPoint || point, point);
            editorState.eraseLastPoint = point;
            renderEditorCanvas();
            return;
        }

        if (editorState.eraserEnabled) {
            renderEditorCanvas();
            return;
        }

        if (!editorState.dragStickerId) {
            return;
        }

        const sticker = getEditorSelectedSticker();
        if (!sticker) {
            return;
        }
        sticker.x = clamp(point.x - editorState.dragOffsetX, 0, editorCanvasEl.width);
        sticker.y = clamp(point.y - editorState.dragOffsetY, 0, editorCanvasEl.height);
        renderEditorCanvas();
    });

    editorCanvasEl.addEventListener("pointerup", (event) => stopStickerDrag(event.pointerId));
    editorCanvasEl.addEventListener("pointercancel", (event) => stopStickerDrag(event.pointerId));
    editorCanvasEl.addEventListener("pointerenter", (event) => {
        if (!editorState.eraserEnabled) {
            return;
        }
        updateEraserCursor(getEditorCanvasPoint(event));
        renderEditorCanvas();
    });
    editorCanvasEl.addEventListener("pointerleave", () => {
        if (!editorState.eraserEnabled) {
            return;
        }
        editorState.eraserCursorVisible = false;
        if (!editorState.erasingStickerId) {
            renderEditorCanvas();
        }
    });
    editorCanvasEl.addEventListener("wheel", (event) => {
        if (!editorState.isOpen) {
            return;
        }

        const sticker = getEditorSelectedSticker();
        if (!sticker) {
            return;
        }

        event.preventDefault();
        if (event.shiftKey) {
            sticker.rotation += event.deltaY < 0 ? 0.06 : -0.06;
        } else {
            sticker.scale = clamp(sticker.scale * (event.deltaY < 0 ? 1.05 : 0.95), 0.4, 2.2);
        }
        renderEditorCanvas();
    }, { passive: false });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopCaptureCountdown();
        }
    });
}

function checkOpenPalmGesture(landmarks) {
    return isFingerExtended(landmarks, 4, 3) &&
        isFingerExtended(landmarks, 8, 6) &&
        isFingerExtended(landmarks, 12, 10) &&
        isFingerExtended(landmarks, 16, 14) &&
        isFingerExtended(landmarks, 20, 18);
}

function buildOpenPalmShape(landmarks, width, height) {
    const center = getPalmCenter(landmarks, width, height);
    const tips = [4, 8, 12, 16, 20].map((index) => getMirroredPoint(landmarks, index, width, height));
    const palmLeft = getMirroredPoint(landmarks, 5, width, height);
    const palmRight = getMirroredPoint(landmarks, 17, width, height);
    const averageRadius = tips.reduce((sum, tip) => sum + distance(center, tip), 0) / tips.length;
    const palmWidth = distance(palmLeft, palmRight);
    const radius = clamp(Math.max(averageRadius * 0.98, palmWidth * 1.06), 72, Math.min(width, height) * 0.32);

    return {
        type: "ellipse",
        cx: center.x,
        cy: center.y,
        rx: radius,
        ry: radius,
        angle: 0
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
        if (checkOpenPalmGesture(hand)) {
            return {
                shape: buildOpenPalmShape(hand, width, height),
                label: "VÒNG TRÒN LỚN"
            };
        }

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

function showToast(message, duration = 2200) {
    window.clearTimeout(state.toastTimer);
    toastEl.textContent = message;
    toastEl.classList.remove("is-hidden");
    state.toastTimer = window.setTimeout(() => {
        toastEl.classList.add("is-hidden");
    }, duration);
}

function updateLiveStatus() {
    if (!state.cameraRunning) {
        return;
    }

    if (captureCountdownEndsAt) {
        const remainingSeconds = Math.max(1, Math.ceil((captureCountdownEndsAt - Date.now()) / 1000));
        setCameraStatus(`Chuẩn bị chụp sau ${remainingSeconds}s`, "is-live");
        return;
    }

    if (state.lockedShape) {
        setCameraStatus("Đã khóa khung kính", "is-lock");
        return;
    }

    if (state.activeLabel) {
        const percent = Math.max(1, Math.round(state.progress * 100));
        if (state.progress >= 0.08) {
            setCameraStatus(`Giữ ổn định ${state.activeLabel} ${percent}%`, "is-live");
        } else {
            setCameraStatus(`Đang nhận diện ${state.activeLabel}`, "is-waiting");
        }
        return;
    }

    setCameraStatus("Đưa tay vào khung", "is-waiting");
}

function clearLock() {
    state.lockedShape = null;
    state.lockedLabel = "";
    setFreezeVisible(false);
    resetTracking();
    toggleClearButton();
    setGestureTag("");
    updateLiveStatus();
}

function copyCurrentFrameToFrozen(width, height) {
    freezeCanvasEl.width = width;
    freezeCanvasEl.height = height;
    freezeCtx.clearRect(0, 0, width, height);
    freezeCtx.save();
    freezeCtx.scale(-1, 1);
    freezeCtx.drawImage(videoEl, -width, 0, width, height);
    freezeCtx.restore();
    setFreezeVisible(true);
}

function exportCanvasAsPng() {
    startCaptureFlow();
}

function handleKeydown(event) {
    const activeTag = document.activeElement?.tagName;
    const isTextInput = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

    if (event.code === "Space" && !isTextInput && !editorState.isOpen) {
        event.preventDefault();
        startCaptureFlow();
        return;
    }

    if (event.key !== "Escape") {
        return;
    }

    if (captureCountdownEndsAt) {
        stopCaptureCountdown({ notifyCancel: true });
        return;
    }

    if (editorState.isOpen) {
        closeEditor();
        return;
    }

    if (researchModalEl.classList.contains("visible")) {
        closeResearchModal();
        return;
    }

    if (historyDrawerEl.classList.contains("visible")) {
        closeHistoryDrawer();
        return;
    }

    if (captureDelayMenuEl.classList.contains("visible")) {
        toggleCaptureDelayMenu(false);
        return;
    }

    if (modeMenuEl.classList.contains("visible")) {
        toggleModeMenu(false);
        return;
    }

    if (state.guideOpen) {
        setGuideOpen(false);
        return;
    }

    clearLock();
}

initializeExtendedUi();
