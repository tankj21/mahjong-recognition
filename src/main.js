import './style.css';
import Riichi from 'riichi';

// 34種の標準牌コード
const TILE_CODES = [
  '1m','2m','3m','4m','5m','6m','7m','8m','9m',
  '1p','2p','3p','4p','5p','6p','7p','8p','9p',
  '1s','2s','3s','4s','5s','6s','7s','8s','9s',
  '1z','2z','3z','4z','5z','6z','7z'
];

// 表示用の牌ラベル（手動選択やログ用）
const TILE_LABELS = {
  '1m':'一萬','2m':'二萬','3m':'三萬','4m':'四萬','5m':'五萬','6m':'六萬','7m':'七萬','8m':'八萬','9m':'九萬','0m':'赤五萬',
  '1p':'一筒','2p':'二筒','3p':'三筒','4p':'四筒','5p':'五筒','6p':'六筒','7p':'七筒','8p':'八筒','9p':'九筒','0p':'赤五筒',
  '1s':'一索','2s':'二索','3s':'三索','4s':'四索','5s':'五索','6s':'六索','7s':'七索','8s':'八索','9s':'九索','0s':'赤五索',
  '1z':'東','2z':'南','3z':'西','4z':'北','5z':'白','6z':'發','7z':'中'
};

// アプリケーションの状態
const state = {
  // 手牌14枚（初期値は清一色テンパイ形など）
  hand: ['1m','2m','3m','4m','5m','6m','7m','8m','9m','1p','2p','3p','4s','4s'],
  doraIndicators: [], // ドラ表示牌
  isRon: false, // ロンアガリか（デフォルトはツモ）
  prevalentWind: '1z', // 場風 (1z = 東場)
  seatWind: '2z', // 自風 (2z = 南家)
  flags: {
    riichi: false,
    doubleRiichi: false,
    ippatsu: false,
    rinshan: false,
    chankan: false,
    haitei: false
  },
  activeTileIndex: null, // 変更中の手牌インデックス
  activeDoraIndex: null, // 変更中のドラインデックス
  cameraStream: null,
  activeTab: 'camera', // 'camera' or 'upload'
  templates: {} // 画像認識用テンプレートデータ（コード => エッジマップ）
};

// HTML要素の取得
const el = {
  video: document.getElementById('video'),
  scannerOverlay: document.getElementById('scanner-overlay'),
  cameraSelect: document.getElementById('camera-select'),
  btnScan: document.getElementById('btn-scan'),
  btnTabCamera: document.getElementById('btn-tab-camera'),
  btnTabUpload: document.getElementById('btn-tab-upload'),
  cameraPanel: document.getElementById('camera-panel'),
  uploadPanel: document.getElementById('upload-panel'),
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  uploadCanvas: document.getElementById('upload-canvas'),
  btnScanUpload: document.getElementById('btn-scan-upload'),
  handTiles: document.getElementById('hand-tiles'),
  doraIndicators: document.getElementById('dora-indicators'),
  btnAddDora: document.getElementById('btn-add-dora'),
  btnClearDora: document.getElementById('btn-clear-dora'),
  btnClearHand: document.getElementById('btn-clear-hand'),
  btnCalculate: document.getElementById('btn-calculate'),
  winTsumo: document.getElementById('win-tsumo'),
  winRon: document.getElementById('win-ron'),
  prevalentWind: document.getElementById('prevalent-wind'),
  seatWind: document.getElementById('seat-wind'),
  chkRiichi: document.getElementById('chk-riichi'),
  chkDoubleRiichi: document.getElementById('chk-double-riichi'),
  chkIppatsu: document.getElementById('chk-ippatsu'),
  chkRinshan: document.getElementById('chk-rinshan'),
  chkChankan: document.getElementById('chk-chankan'),
  chkHaitei: document.getElementById('chk-haitei'),
  resultBoard: document.getElementById('result-board'),
  tilePickerModal: document.getElementById('tile-picker-modal'),
  btnCloseModal: document.getElementById('btn-close-modal')
};

// ==========================================
// 1. 麻雀牌の動的ベクター描画エンジン
// ==========================================

function drawTileFace(ctx, tileCode, w, h, isTemplate = false) {
  const scaleX = w / 32;
  const scaleY = h / 48;
  const s = Math.min(scaleX, scaleY);
  
  // 牌の表面（白・クリームのグラデーションで高級感を出す）
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#f9fafb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  
  // テンプレート作成時は、枠線のエッジノイズを防ぐためベゼルを描画しない
  if (!isTemplate) {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1 * s;
    ctx.strokeRect(1.5 * s, 1.5 * s, w - 3 * s, h - 3 * s);
  }
  
  if (!tileCode) return;
  
  const num = parseInt(tileCode[0]);
  const suit = tileCode[1];
  
  if (suit === 'z') {
    // 字牌 (東南西北 白發中)
    let char = '';
    let color = '#111827';
    let isWhiteDragon = false;
    
    if (tileCode === '1z') char = '東';
    else if (tileCode === '2z') char = '南';
    else if (tileCode === '3z') char = '西';
    else if (tileCode === '4z') char = '北';
    else if (tileCode === '5z') isWhiteDragon = true;
    else if (tileCode === '6z') { char = '發'; color = '#059669'; }
    else if (tileCode === '7z') { char = '中'; color = '#ef4444'; }
    
    if (isWhiteDragon) {
      // 白（フレームを描画）
      ctx.strokeStyle = '#1e40af';
      ctx.lineWidth = 2 * s;
      ctx.strokeRect(5 * s, 7 * s, w - 10 * s, h - 14 * s);
      
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 0.6 * s;
      ctx.strokeRect(7 * s, 9 * s, w - 14 * s, h - 18 * s);
    } else {
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.floor(22 * s)}px 'Noto Sans JP', 'Helvetica Neue', Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, w / 2, h / 2 + 1 * s);
    }
  }
  else if (suit === 'm') {
    // 萬子 (数字 + 「萬」)
    const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const digit = num === 0 ? '五' : digits[num];
    const isRed = num === 0;
    
    // 数字部分
    ctx.fillStyle = (num === 1 || isRed) ? '#ef4444' : '#111827';
    ctx.font = `bold ${Math.floor(13 * s)}px 'Noto Sans JP', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(digit, w / 2, 4.5 * s);
    
    // 「萬」部分
    ctx.fillStyle = '#ef4444';
    ctx.font = `bold ${Math.floor(13 * s)}px 'Noto Sans JP', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('萬', w / 2, h - 4.5 * s);
  }
  else if (suit === 'p') {
    // 筒子 (サークルパターン)
    const drawDot = (cx, cy, r, color) => {
      ctx.beginPath();
      ctx.arc(cx * scaleX, cy * scaleY, r * s, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      // 内側の白い光沢ハイライト
      ctx.beginPath();
      ctx.arc(cx * scaleX, cy * scaleY, (r * 0.4) * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    };
    
    const red = '#ef4444';
    const blue = '#1e40af';
    const isRed5 = num === 0;
    const nominal = num === 0 ? 5 : num;
    
    if (nominal === 1) {
      // 1筒: 大きな花形
      drawDot(16, 24, 9, red);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.arc(16 * scaleX, 24 * scaleY, 5 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
    else if (nominal === 2) {
      drawDot(16, 14, 4.5, blue);
      drawDot(16, 34, 4.5, red);
    }
    else if (nominal === 3) {
      drawDot(8, 10, 4.5, blue);
      drawDot(16, 24, 4.5, red);
      drawDot(24, 38, 4.5, blue);
    }
    else if (nominal === 4) {
      drawDot(9, 13, 4.5, blue);
      drawDot(23, 13, 4.5, red);
      drawDot(9, 35, 4.5, red);
      drawDot(23, 35, 4.5, blue);
    }
    else if (nominal === 5) {
      const cornerColor = isRed5 ? red : blue;
      drawDot(9, 11, 4.2, cornerColor);
      drawDot(23, 11, 4.2, cornerColor);
      drawDot(16, 24, 4.2, red); // 中央は常に赤
      drawDot(9, 37, 4.2, cornerColor);
      drawDot(23, 37, 4.2, cornerColor);
    }
    else if (nominal === 6) {
      drawDot(9, 11, 4.2, blue);
      drawDot(23, 11, 4.2, blue);
      drawDot(9, 24, 4.2, red);
      drawDot(23, 24, 4.2, red);
      drawDot(9, 37, 4.2, red);
      drawDot(23, 37, 4.2, red);
    }
    else if (nominal === 7) {
      drawDot(7, 9, 3.8, blue);
      drawDot(16, 14, 3.8, blue);
      drawDot(25, 19, 3.8, blue);
      drawDot(9, 30, 3.8, red);
      drawDot(23, 30, 3.8, red);
      drawDot(9, 39, 3.8, red);
      drawDot(23, 39, 3.8, red);
    }
    else if (nominal === 8) {
      const yCoords = [9, 19, 29, 39];
      for (const y of yCoords) {
        drawDot(9, y, 3.8, blue);
        drawDot(23, y, 3.8, blue);
      }
    }
    else if (nominal === 9) {
      const yCoords = [11, 24, 37];
      const xCoords = [8, 16, 24];
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const color = rIdx === 1 ? red : blue;
        for (const x of xCoords) {
          drawDot(x, yCoords[rIdx], 3.8, color);
        }
      }
    }
  }
  else if (suit === 's') {
    // 索子 (竹の棒・鳥)
    const drawBar = (x, y, wBar, hBar, color) => {
      ctx.fillStyle = color;
      const rx = x * scaleX;
      const ry = y * scaleY;
      const rw = wBar * scaleX;
      const rh = hBar * scaleY;
      const r = Math.min(rw, rh) * 0.35;
      
      // 角丸四角形を描画
      ctx.beginPath();
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - r, ry + rh);
      ctx.lineTo(rx + r, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - r);
      ctx.lineTo(rx, ry + r);
      ctx.quadraticCurveTo(rx, ry, rx + r, ry);
      ctx.closePath();
      ctx.fill();
      
      // 竹の節目表現（中央に白いスリット）
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.6 * s;
      ctx.beginPath();
      ctx.moveTo(rx, ry + rh / 2);
      ctx.lineTo(rx + rw, ry + rh / 2);
      ctx.stroke();
    };
    
    const green = '#059669';
    const red = '#ef4444';
    const isRed5 = num === 0;
    const nominal = num === 0 ? 5 : num;
    
    if (nominal === 1) {
      // 1索: 孔雀・鳥の簡易グラフィック
      ctx.fillStyle = green;
      
      // 体
      ctx.beginPath();
      ctx.ellipse(16 * scaleX, 28 * scaleY, 6 * scaleX, 9 * scaleY, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // 頭
      ctx.beginPath();
      ctx.arc(16 * scaleX, 15 * scaleY, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      
      // クチバシ (赤)
      ctx.fillStyle = red;
      ctx.beginPath();
      ctx.moveTo(16 * scaleX, 15 * scaleY);
      ctx.lineTo(21 * scaleX, 14 * scaleY);
      ctx.lineTo(17 * scaleX, 18 * scaleY);
      ctx.closePath();
      ctx.fill();
      
      // 尾羽のライン
      ctx.strokeStyle = green;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(16 * scaleX, 37 * scaleY);
      ctx.lineTo(12 * scaleX, 43 * scaleY);
      ctx.moveTo(16 * scaleX, 37 * scaleY);
      ctx.lineTo(16 * scaleX, 44 * scaleY);
      ctx.moveTo(16 * scaleX, 37 * scaleY);
      ctx.lineTo(20 * scaleX, 43 * scaleY);
      ctx.stroke();
      
      // 羽のワンポイント (黄色)
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(13 * scaleX, 26 * scaleY, 2.5 * scaleX, 5 * scaleY, -0.3, 0, Math.PI * 2);
      ctx.ellipse(19 * scaleX, 26 * scaleY, 2.5 * scaleX, 5 * scaleY, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    else if (nominal === 2) {
      drawBar(9, 10, 4, 28, green);
      drawBar(19, 10, 4, 28, green);
    }
    else if (nominal === 3) {
      drawBar(14, 8, 4, 12, green);
      drawBar(8, 26, 4, 12, green);
      drawBar(20, 26, 4, 12, green);
    }
    else if (nominal === 4) {
      drawBar(8, 8, 4, 12, green);
      drawBar(20, 8, 4, 12, green);
      drawBar(8, 26, 4, 12, green);
      drawBar(20, 26, 4, 12, green);
    }
    else if (nominal === 5) {
      const cornerColor = isRed5 ? red : green;
      drawBar(7, 8, 4, 12, cornerColor);
      drawBar(21, 8, 4, 12, cornerColor);
      drawBar(14, 17, 4, 12, red); // 中央
      drawBar(7, 26, 4, 12, cornerColor);
      drawBar(21, 26, 4, 12, cornerColor);
    }
    else if (nominal === 6) {
      drawBar(7, 8, 4, 12, green);
      drawBar(14, 8, 4, 12, green);
      drawBar(21, 8, 4, 12, green);
      drawBar(7, 26, 4, 12, green);
      drawBar(14, 26, 4, 12, green);
      drawBar(21, 26, 4, 12, green);
    }
    else if (nominal === 7) {
      drawBar(14, 6, 4, 9, red); // 中央上のみ赤
      drawBar(7, 18, 4, 9, green);
      drawBar(14, 18, 4, 9, green);
      drawBar(21, 18, 4, 9, green);
      drawBar(7, 30, 4, 9, green);
      drawBar(14, 30, 4, 9, green);
      drawBar(21, 30, 4, 9, green);
    }
    else if (nominal === 8) {
      drawBar(7, 8, 4, 10, green);
      drawBar(13, 8, 4, 10, green);
      drawBar(21, 8, 4, 10, green);
      drawBar(10, 20, 4, 8, green);
      drawBar(18, 20, 4, 8, green);
      drawBar(7, 30, 4, 10, green);
      drawBar(13, 30, 4, 10, green);
      drawBar(21, 30, 4, 10, green);
    }
    else if (nominal === 9) {
      const xCoords = [7, 14, 21];
      const yCoords = [7, 19, 31];
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const color = rIdx === 1 ? red : green; // 中段のみ赤
        for (const x of xCoords) {
          drawBar(x, yCoords[rIdx], 4, 10, color);
        }
      }
    }
  }
}

// 牌表示DOM生成（Canvas入り）
function createTileDOM(tileCode, index, isAgari = false, isDora = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `tile ${isAgari ? 'agari-tile' : ''}`;
  wrapper.dataset.index = index;
  wrapper.dataset.type = isDora ? 'dora' : 'hand';
  
  const canvas = document.createElement('canvas');
  // 高解像度ディスプレイ（Retina）対応で2倍サイズで作成し、CSSで縮小表示
  const dpr = window.devicePixelRatio || 1;
  const w = isDora ? 28 : 42;
  const h = isDora ? 40 : 60;
  
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  drawTileFace(ctx, tileCode, w, h);
  
  wrapper.appendChild(canvas);
  return wrapper;
}

// ==========================================
// 2. コンピュータビジョン (前処理 & マッチング)
// ==========================================

// グレースケール化
function convertToGrayscale(imgData) {
  const w = imgData.width;
  const h = imgData.height;
  const data = imgData.data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // 標準的な加重平均値
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

// Sobelフィルタによるエッジ抽出
function getSobelEdges(gray, w, h) {
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      // Sobelカーネル適用
      const gx = 
        -gray[idx - w - 1] + gray[idx - w + 1]
        -2 * gray[idx - 1] + 2 * gray[idx + 1]
        -gray[idx + w - 1] + gray[idx + w + 1];
      const gy = 
        -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1]
        +gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];
      
      edges[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  // コントラスト調整のために正規化
  let max = 0;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > max) max = edges[i];
  }
  if (max > 0) {
    for (let i = 0; i < edges.length; i++) {
      edges[i] = (edges[i] / max) * 255;
    }
  }
  return edges;
}

// 動的な34種テンプレートのエッジ強度マップの事前生成
function initTemplates() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  
  for (const code of TILE_CODES) {
    ctx.clearRect(0, 0, 32, 48);
    drawTileFace(ctx, code, 32, 48, true); // isTemplate = true を指定して境界ベゼルを除去
    
    const imgData = ctx.getImageData(0, 0, 32, 48);
    const gray = convertToGrayscale(imgData);
    const edges = getSobelEdges(gray, 32, 48);
    state.templates[code] = edges;
  }
}

// コントラスト正規化（Min-Max輝度ストレッチによる影・照度対策）
function normalizeContrast(gray, w, h) {
  let min = 255;
  let max = 0;
  // 外周3pxを除いた内側部分の最小・最大輝度値を取得（境界ノイズ軽減のため）
  for (let y = 3; y < h - 3; y++) {
    for (let x = 3; x < w - 3; x++) {
      const val = gray[y * w + x];
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }
  
  const range = max - min;
  if (range <= 10) return gray; // コントラスト差が極端に低い場合はそのまま返す
  
  const normalized = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const val = ((gray[i] - min) / range) * 255;
    normalized[i] = Math.max(0, Math.min(255, val));
  }
  return normalized;
}

// シフトした座標から安全にピクセルデータを取得
function getShiftedPixel(pixels, w, h, x, y, dx, dy) {
  const nx = x + dx;
  const ny = y + dy;
  if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
    return pixels[ny * w + nx];
  }
  return 0; // 範囲外はゼロパディング
}

// ゼロ平均正規化相互相関 (ZNCC) スライディングマッチング (境界ノイズを除いた内側70%のみで判定)
function matchZNCC(cropEdges, w, h, templateEdges, tw, th) {
  let maxScore = -1;
  
  // 内側領域の定義 (左右5px, 上下7pxのマージンを除外)
  const marginX = 5;
  const marginY = 7;
  const innerW = tw - 2 * marginX; // 22
  const innerH = th - 2 * marginY; // 34
  const innerSize = innerW * innerH;
  
  // テンプレート側の事前集計（内側部分のみ）
  let sumT = 0;
  for (let y = marginY; y < th - marginY; y++) {
    for (let x = marginX; x < tw - marginX; x++) {
      sumT += templateEdges[y * tw + x];
    }
  }
  const meanT = sumT / innerSize;
  
  let varT = 0;
  for (let y = marginY; y < th - marginY; y++) {
    for (let x = marginX; x < tw - marginX; x++) {
      const diff = templateEdges[y * tw + x] - meanT;
      varT += diff * diff;
    }
  }
  if (varT === 0) varT = 1;
  
  // 位置ズレ許容範囲 (左右3px, 上下4px) でスライドサーチ
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const shiftedCrop = new Float32Array(innerSize);
      let sumC = 0;
      
      let idx = 0;
      for (let y = marginY; y < th - marginY; y++) {
        for (let x = marginX; x < tw - marginX; x++) {
          const val = getShiftedPixel(cropEdges, w, h, x, y, dx, dy);
          shiftedCrop[idx++] = val;
          sumC += val;
        }
      }
      
      const meanC = sumC / innerSize;
      let num = 0;
      let varC = 0;
      
      for (let i = 0; i < innerSize; i++) {
        const diffC = shiftedCrop[i] - meanC;
        const tx = marginX + (i % innerW);
        const ty = marginY + Math.floor(i / innerW);
        const diffT = templateEdges[ty * tw + tx] - meanT;
        num += diffC * diffT;
        varC += diffC * diffC;
      }
      
      if (varC === 0) varC = 1;
      
      const score = num / Math.sqrt(varC * varT);
      if (score > maxScore) {
        maxScore = score;
      }
    }
  }
  return maxScore;
}

// 1枚の切り出し画像に対する最適マッチの分類実行
function classifyTile(cropCtx, cropW, cropH) {
  const imgData = cropCtx.getImageData(0, 0, cropW, cropH);
  
  // 32x48にリサイズするためのテンポラリキャンバス
  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = 32;
  resizeCanvas.height = 48;
  const resizeCtx = resizeCanvas.getContext('2d');
  resizeCtx.drawImage(cropCtx.canvas, 0, 0, cropW, cropH, 0, 0, 32, 48);
  
  const resizedData = resizeCtx.getImageData(0, 0, 32, 48);
  const gray = convertToGrayscale(resizedData);
  
  // コントラストの輝度正規化を追加
  const normalizedGray = normalizeContrast(gray, 32, 48);
  const edges = getSobelEdges(normalizedGray, 32, 48);
  
  let bestCode = '1m';
  let bestScore = -2;
  
  for (const code of TILE_CODES) {
    const templateEdges = state.templates[code];
    const score = matchZNCC(edges, 32, 48, templateEdges, 32, 48);
    if (score > bestScore) {
      bestScore = score;
      bestCode = code;
    }
  }
  
  return bestCode;
}

// ==========================================
// 3. UIの更新・手牌の描画・モーダル制御
// ==========================================

function updateHandUI() {
  el.handTiles.innerHTML = '';
  state.hand.forEach((tileCode, idx) => {
    const isAgari = (idx === 13); // 14枚目が和了牌
    const tileDOM = createTileDOM(tileCode, idx, isAgari, false);
    
    // 手牌の牌タップ時に変更モーダルを開く
    tileDOM.addEventListener('click', () => {
      state.activeTileIndex = idx;
      state.activeDoraIndex = null;
      openTilePickerModal();
    });
    el.handTiles.appendChild(tileDOM);
  });
  
  // ドラ表示牌の描画
  el.doraIndicators.innerHTML = '';
  state.doraIndicators.forEach((tileCode, idx) => {
    const tileDOM = createTileDOM(tileCode, idx, false, true);
    
    tileDOM.addEventListener('click', () => {
      state.activeDoraIndex = idx;
      state.activeTileIndex = null;
      openTilePickerModal();
    });
    el.doraIndicators.appendChild(tileDOM);
  });
  
  // 状態バッジの更新
  const tileCountLabel = document.getElementById('tile-count');
  tileCountLabel.textContent = `手牌: 14枚 (アガリ状態)`;
}

// 牌選択モーダルを開く
function openTilePickerModal() {
  el.tilePickerModal.classList.add('active');
}

// 牌選択モーダルを閉じる
function closeTilePickerModal() {
  el.tilePickerModal.classList.remove('active');
  state.activeTileIndex = null;
  state.activeDoraIndex = null;
}

// モーダル内牌グリッドの構築
function buildPickerUI() {
  const categories = {
    m: document.querySelector('.picker-row[data-type="m"]'),
    p: document.querySelector('.picker-row[data-type="p"]'),
    s: document.querySelector('.picker-row[data-type="s"]'),
    z: document.querySelector('.picker-row[data-type="z"]')
  };
  
  // 各行を初期化
  for (const key in categories) {
    categories[key].innerHTML = '';
  }
  
  // 牌リストの定義（赤ドラ含む）
  const pickerTiles = {
    m: ['1m','2m','3m','4m','5m','0m','6m','7m','8m','9m'],
    p: ['1p','2p','3p','4p','5p','0p','6p','7p','8p','9p'],
    s: ['1s','2s','3s','4s','5s','0s','6s','7s','8s','9s'],
    z: ['1z','2z','3z','4z','5z','6z','7z']
  };
  
  for (const suit in pickerTiles) {
    pickerTiles[suit].forEach((code) => {
      const tileDOM = createTileDOM(code, -1, false, true); // 小さめのサイズで表示
      tileDOM.addEventListener('click', () => {
        if (state.activeTileIndex !== null) {
          state.hand[state.activeTileIndex] = code;
          updateHandUI();
          calculateScore(); // 自動再計算
        } else if (state.activeDoraIndex !== null) {
          state.doraIndicators[state.activeDoraIndex] = code;
          updateHandUI();
          calculateScore(); // 自動再計算
        }
        closeTilePickerModal();
      });
      categories[suit].appendChild(tileDOM);
    });
  }
}

// ==========================================
// 4. 麻雀点数計算エンジンの統合
// ==========================================

function calculateScore() {
  try {
    // 役フラグチェックボックスの状態を同期
    state.isRon = el.winRon.checked;
    state.prevalentWind = el.prevalentWind.value;
    state.seatWind = el.seatWind.value;
    state.flags.riichi = el.chkRiichi.checked;
    state.flags.doubleRiichi = el.chkDoubleRiichi.checked;
    state.flags.ippatsu = el.chkIppatsu.checked;
    state.flags.rinshan = el.chkRinshan.checked;
    state.flags.chankan = el.chkChankan.checked;
    state.flags.haitei = el.chkHaitei.checked;
    
    // 13枚の手牌と14枚目の和了牌を分ける
    const hand13 = state.hand.slice(0, 13);
    const winningTile = state.hand[13];
    
    // riichiライブラリ用フォーマットにシリアライズ
    const riichiString = serializeHandForRiichi(
      hand13,
      winningTile,
      state.isRon,
      state.doraIndicators,
      state.prevalentWind,
      state.seatWind,
      state.flags
    );
    
    console.log("Riichi Input String:", riichiString);
    
    const riichi = new Riichi(riichiString);
    const res = riichi.calc();
    
    renderResults(res);
  } catch (err) {
    console.error("Calculation error:", err);
    showErrorResult("点数計算中にエラーが発生しました。手牌の構成が正しいか確認してください。");
  }
}

// 手牌シリアライズ関数
function serializeHandForRiichi(hand13, winningTile, isRon, doraList, prevalentWind, seatWind, flags) {
  const suits = { m: [], p: [], s: [], z: [] };
  
  // 13枚の振り分け
  hand13.forEach(tile => {
    const val = tile[0];
    const s = tile[1];
    suits[s].push(val);
  });
  
  // 自摸アガリの場合は和了牌も手牌に含めてシリアライズする
  if (!isRon) {
    const val = winningTile[0];
    const s = winningTile[1];
    suits[s].push(val);
  }
  
  // 各スート内ソート (赤ドラ0は5としてソート)
  for (const s in suits) {
    suits[s].sort((a, b) => {
      const numA = a === '0' ? 5 : parseInt(a);
      const numB = b === '0' ? 5 : parseInt(b);
      return numA - numB;
    });
  }
  
  // 基本文字列の作成
  let handStr = '';
  for (const s of ['m', 'p', 's', 'z']) {
    if (suits[s].length > 0) {
      handStr += suits[s].join('') + s;
    }
  }
  
  // ロンアガリの場合は +和了牌
  if (isRon) {
    handStr += '+' + winningTile;
  }
  
  // ドラ表示牌の追加
  if (doraList && doraList.length > 0) {
    handStr += '+d' + doraList.join('');
  }
  
  // オプションフラグの付与
  if (flags.doubleRiichi) handStr += '+w';
  else if (flags.riichi) handStr += '+r';
  
  if (flags.ippatsu) handStr += '+i';
  if (flags.haitei) handStr += '+h';
  if (flags.rinshan || flags.chankan) handStr += '+k';
  
  // 場風 & 自風を設定
  // 例: +21 は場風南、自風東 (1=東, 2=南, 3=西, 4=北)
  const prevalentDigit = prevalentWind[0]; // '1','2','3'
  const seatDigit = seatWind[0]; // '1','2','3','4'
  handStr += `+${prevalentDigit}${seatDigit}`;
  
  return handStr;
}

// 計算結果ボードのレンダリング
function renderResults(res) {
  const placeholder = el.resultBoard.querySelector('.result-placeholder');
  const content = el.resultBoard.querySelector('.result-content');
  
  placeholder.style.display = 'none';
  content.style.display = 'flex';
  
  const resScoreType = document.getElementById('res-score-type');
  const resPoints = document.getElementById('res-points');
  const resPayment = document.getElementById('res-payment');
  const resHan = document.getElementById('res-han');
  const resFu = document.getElementById('res-fu');
  const resLimit = document.getElementById('res-limit');
  const resYakuList = document.getElementById('res-yaku-list');
  const resTextSummary = document.getElementById('res-text-summary');
  const badge = document.getElementById('hand-status-badge');
  
  if (!res.isAgari) {
    // アガリ形ではない場合
    const shanten = (res.hairi && res.hairi.now !== undefined) ? res.hairi.now : -1;
    badge.className = "badge error";
    
    if (shanten === 0) {
      badge.textContent = "聴牌 (テンパイ)";
      resScoreType.textContent = "現在テンパイしています";
    } else if (shanten > 0) {
      badge.textContent = `${shanten}向聴 (シャンテン)`;
      resScoreType.textContent = "アガリ形ではありません";
    } else {
      badge.textContent = "ノーテン";
      resScoreType.textContent = "手牌の枚数が不正です";
    }
    
    resPoints.textContent = "和了未成立";
    resPayment.textContent = "";
    resHan.textContent = "--";
    resFu.textContent = "--";
    resLimit.style.display = 'none';
    resYakuList.innerHTML = '<li>なし</li>';
    resTextSummary.textContent = "手牌が完成していません。アガリ牌や副露、組み合わせを調整してください。";
    return;
  }
  
  // アガリ成立時
  badge.className = "badge";
  badge.textContent = "和了 (ホーラ)";
  
  // プレイヤー立場表記
  const isOya = state.seatWind === '1z';
  const playerType = isOya ? "親" : "子";
  resScoreType.textContent = `${playerType}和了 (${TILE_LABELS[state.seatWind]}家) - ${state.isRon ? 'ロン' : 'ツモ'}`;
  
  // 得点表示
  resPoints.textContent = `${res.ten.toLocaleString()} 点`;
  
  // 支払い内訳
  if (state.isRon) {
    resPayment.textContent = `放銃者からの一括支払い`;
  } else {
    // ツモ支払い (親/子ごとの金額)
    if (isOya) {
      // 親のツモアガリは子全員から res.oya の金額をもらう
      const payKo = res.ko[0] || 0;
      resPayment.textContent = `子1人あたり ${payKo.toLocaleString()} 点ずつの支払い`;
    } else {
      // 子のツモアガリは親から res.oya、子から res.ko をもらう
      const payOya = res.oya[1] || res.oya[0] || 0;
      const payKo = res.ko[1] || res.ko[2] || 0;
      resPayment.textContent = `親: ${payOya.toLocaleString()} 点 / 子: ${payKo.toLocaleString()} 点の支払い`;
    }
  }
  
  // 翻数・符数
  resHan.textContent = res.han;
  resFu.textContent = res.fu;
  
  // 満貫・跳満等のリミット名
  let limitName = "";
  if (res.yakuman > 0) {
    limitName = res.yakuman > 1 ? `${res.yakuman}倍役満` : "役満";
  } else if (res.han >= 13) {
    limitName = "数え役満";
  } else if (res.han >= 11) {
    limitName = "三倍満";
  } else if (res.han >= 8) {
    limitName = "倍満";
  } else if (res.han >= 6) {
    limitName = "跳満";
  } else if (res.ten >= 8000 && !isOya) {
    limitName = "満貫";
  } else if (res.ten >= 12000 && isOya) {
    limitName = "満貫";
  }
  
  if (limitName) {
    resLimit.textContent = limitName;
    resLimit.style.display = 'inline-block';
  } else {
    resLimit.style.display = 'none';
  }
  
  // 役一覧の描画
  resYakuList.innerHTML = '';
  for (const yName in res.yaku) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${yName}</span> <span>${res.yaku[yName]}</span>`;
    resYakuList.appendChild(li);
  }
  
  // サマリーテキスト
  resTextSummary.textContent = res.text || "点数計算が完了しました。";
}

// 点数計算時のエラー表示
function showErrorResult(msg) {
  const placeholder = el.resultBoard.querySelector('.result-placeholder');
  const content = el.resultBoard.querySelector('.result-content');
  placeholder.style.display = 'none';
  content.style.display = 'flex';
  
  document.getElementById('hand-status-badge').className = "badge error";
  document.getElementById('hand-status-badge').textContent = "計算エラー";
  
  document.getElementById('res-score-type').textContent = "エラー";
  document.getElementById('res-points').textContent = "-- 点";
  document.getElementById('res-payment').textContent = "";
  document.getElementById('res-han').textContent = "--";
  document.getElementById('res-fu').textContent = "--";
  document.getElementById('res-limit').style.display = 'none';
  document.getElementById('res-yaku-list').innerHTML = `<li>構成エラー</li>`;
  document.getElementById('res-text-summary').textContent = msg;
}

// ==========================================
// 5. カメラ配信 & デバイス管理
// ==========================================

async function initCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    el.cameraSelect.innerHTML = '';
    if (videoDevices.length === 0) {
      el.cameraSelect.innerHTML = '<option value="">カメラが見つかりません</option>';
      return;
    }
    
    videoDevices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `カメラ ${el.cameraSelect.length + 1}`;
      el.cameraSelect.appendChild(opt);
    });
    
    // 最初のカメラデバイスで配信起動
    await startCameraStream(videoDevices[0].deviceId);
  } catch (err) {
    console.error("Camera detection error:", err);
    el.cameraSelect.innerHTML = '<option value="">カメラアクセス拒否</option>';
  }
}

async function startCameraStream(deviceId) {
  if (state.cameraStream) {
    state.cameraStream.getTracks().forEach(track => track.stop());
  }
  
  const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
  };
  
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    el.video.srcObject = state.cameraStream;
    
    // ビデオサイズ確定後にオーバーレイを描画
    el.video.onloadedmetadata = () => {
      resizeOverlayCanvas();
    };
  } catch (err) {
    console.error("Camera start failed:", err);
  }
}

function resizeOverlayCanvas() {
  const w = el.video.offsetWidth;
  const h = el.video.offsetHeight;
  el.scannerOverlay.width = w;
  el.scannerOverlay.height = h;
  drawOverlayGuide();
}

// 14牌のガイドボックス配列
let currentGuideRegions = [];

function drawOverlayGuide() {
  const canvas = el.scannerOverlay;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, w, h);
  
  // 外側のダークマスク
  ctx.fillStyle = 'rgba(11, 13, 16, 0.7)';
  ctx.fillRect(0, 0, w, h);
  
  // ガイド枠の横幅・高さを決定 (全体幅の92%, 高さ28%程度)
  const boxW = w * 0.94;
  const boxH = h * 0.28;
  const boxX = (w - boxW) / 2;
  const boxY = (h - boxH) / 2;
  
  // 13枚の通常枠 ＋ アガリ枠（少し隙間を空けて右端に設置）
  const gapWeight = 0.4; // 隙間は牌幅の0.4倍
  const totalUnits = 13 + gapWeight + 1; // 合計14.4個分のスロット
  const tileW = boxW / totalUnits;
  const gapW = tileW * gapWeight;
  
  currentGuideRegions = [];
  
  for (let i = 0; i < 14; i++) {
    let tx = boxX + i * tileW;
    if (i === 13) {
      tx += gapW; // アガリ牌は隙間の分ずらす
    }
    currentGuideRegions.push({
      x: tx,
      y: boxY,
      w: tileW,
      h: boxH
    });
  }
  
  // マスク枠を切り抜き（アパーチャ）
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#ffffff';
  for (const r of currentGuideRegions) {
    drawRoundedRect(ctx, r.x, r.y, r.w, r.h, 4);
    ctx.fill();
  }
  ctx.restore();
  
  // 枠線の描画 & ラベル記述
  for (let i = 0; i < 14; i++) {
    const r = currentGuideRegions[i];
    const isAgari = (i === 13);
    
    ctx.strokeStyle = isAgari ? '#ef4444' : '#10b981';
    ctx.lineWidth = isAgari ? 2.5 : 1.5;
    ctx.beginPath();
    drawRoundedRect(ctx, r.x, r.y, r.w, r.h, 4);
    ctx.stroke();
    
    // 番号テキストラベル
    ctx.fillStyle = isAgari ? '#ef4444' : '#10b981';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const txt = isAgari ? '和了牌' : `${i + 1}`;
    ctx.fillText(txt, r.x + r.w / 2, r.y - 4);
  }
}

function drawRoundedRect(ctx, x, y, width, height, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// カメラ枠から手牌を切り出してスキャン解析を実行
function runCaptureScan() {
  if (currentGuideRegions.length === 0) return;
  
  // 一時キャンバスに現在のビデオフレームを同じサイズでキャプチャ
  const captureCanvas = document.createElement('canvas');
  captureCanvas.width = el.video.videoWidth;
  captureCanvas.height = el.video.videoHeight;
  const captureCtx = captureCanvas.getContext('2d');
  
  // 映像の縦横サイズとCSSレイアウト上のアスペクト比比率を計算してマッピング
  captureCtx.drawImage(el.video, 0, 0, captureCanvas.width, captureCanvas.height);
  
  const scaleX = captureCanvas.width / el.scannerOverlay.width;
  const scaleY = captureCanvas.height / el.scannerOverlay.height;
  
  const scannedHand = [];
  
  // ガイド枠ごとに画像を切り出し、分類エンジンを適用
  currentGuideRegions.forEach((r, idx) => {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = r.w * scaleX;
    cropCanvas.height = r.h * scaleY;
    const cropCtx = cropCanvas.getContext('2d');
    
    cropCtx.drawImage(
      captureCanvas,
      r.x * scaleX, r.y * scaleY, r.w * scaleX, r.h * scaleY,
      0, 0, cropCanvas.width, cropCanvas.height
    );
    
    // テンプレートマッチングを実行し牌を検出
    const code = classifyTile(cropCtx, cropCanvas.width, cropCanvas.height);
    scannedHand.push(code);
  });
  
  // 状態に反映
  state.hand = scannedHand;
  updateHandUI();
  calculateScore();
  
  // スキャン成功のアニメーション演出効果
  el.handTiles.style.animation = 'none';
  setTimeout(() => {
    el.handTiles.style.animation = 'fadeIn 0.5s ease-out';
  }, 10);
}

// ==========================================
// 6. 画像アップロード機能の実装
// ==========================================

let uploadedImage = null;

function handleImageUpload(file) {
  if (!file || !file.type.startsWith('image/')) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      uploadedImage = img;
      
      // プレビューの表示
      const canvas = el.uploadCanvas;
      const ctx = canvas.getContext('2d');
      el.uploadPanel.querySelector('.upload-dropzone').style.display = 'none';
      el.uploadPanel.querySelector('.preview-container').style.display = 'block';
      
      // アスペクト比を維持して描画
      canvas.width = 640;
      canvas.height = 480;
      ctx.fillStyle = '#022c22'; // 雀卓背景マット風
      ctx.fillRect(0, 0, 640, 480);
      
      const ratio = Math.min(640 / img.width, 480 / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (640 - w) / 2;
      const y = (480 - h) / 2;
      
      ctx.drawImage(img, x, y, w, h);
      
      // アップロードプレビュー上にも認識用ガイドグリッドをオーバーレイ表示
      drawGuideOnUploadCanvas(ctx, 640, 480);
      
      el.btnScanUpload.disabled = false;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

let uploadGuideRegions = [];

function drawGuideOnUploadCanvas(ctx, w, h) {
  ctx.fillStyle = 'rgba(11, 13, 16, 0.4)';
  ctx.fillRect(0, 0, w, h);
  
  const boxW = w * 0.94;
  const boxH = h * 0.28;
  const boxX = (w - boxW) / 2;
  const boxY = (h - boxH) / 2;
  
  const gapWeight = 0.4;
  const totalUnits = 13 + gapWeight + 1;
  const tileW = boxW / totalUnits;
  const gapW = tileW * gapWeight;
  
  uploadGuideRegions = [];
  
  for (let i = 0; i < 14; i++) {
    let tx = boxX + i * tileW;
    if (i === 13) {
      tx += gapW;
    }
    uploadGuideRegions.push({
      x: tx,
      y: boxY,
      w: tileW,
      h: boxH
    });
  }
  
  // 枠線の再描画
  uploadGuideRegions.forEach((r, i) => {
    const isAgari = (i === 13);
    ctx.strokeStyle = isAgari ? '#ef4444' : '#10b981';
    ctx.lineWidth = isAgari ? 2.5 : 1.5;
    ctx.beginPath();
    drawRoundedRect(ctx, r.x, r.y, r.w, r.h, 4);
    ctx.stroke();
    
    ctx.fillStyle = isAgari ? '#ef4444' : '#10b981';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(isAgari ? '和了牌' : `${i+1}`, r.x + r.w/2, r.y - 4);
  });
}

function runUploadScan() {
  if (!uploadedImage || uploadGuideRegions.length === 0) return;
  
  const canvas = el.uploadCanvas;
  const scannedHand = [];
  
  uploadGuideRegions.forEach((r) => {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = r.w;
    cropCanvas.height = r.h;
    const cropCtx = cropCanvas.getContext('2d');
    
    cropCtx.drawImage(
      canvas,
      r.x, r.y, r.w, r.h,
      0, 0, r.w, r.h
    );
    
    const code = classifyTile(cropCtx, r.w, r.h);
    scannedHand.push(code);
  });
  
  state.hand = scannedHand;
  updateHandUI();
  calculateScore();
}

// ==========================================
// 7. イベントリスナー & アプリ起動
// ==========================================

function initEvents() {
  // タブ切り替え
  el.btnTabCamera.addEventListener('click', () => {
    state.activeTab = 'camera';
    el.btnTabCamera.classList.add('active');
    el.btnTabUpload.classList.remove('active');
    el.cameraPanel.classList.add('active');
    el.uploadPanel.classList.remove('active');
    if (!state.cameraStream) initCamera();
  });
  
  el.btnTabUpload.addEventListener('click', () => {
    state.activeTab = 'upload';
    el.btnTabCamera.classList.remove('active');
    el.btnTabUpload.classList.add('active');
    el.cameraPanel.classList.remove('active');
    el.uploadPanel.classList.add('active');
    // カメラ停止
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(track => track.stop());
      state.cameraStream = null;
    }
  });
  
  // カメラ切替デバイス選択
  el.cameraSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      startCameraStream(e.target.value);
    }
  });
  
  // スキャン実行
  el.btnScan.addEventListener('click', runCaptureScan);
  el.btnScanUpload.addEventListener('click', runUploadScan);
  
  // ドラッグ＆ドロップ画像アップロードイベント
  el.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropZone.style.borderColor = 'var(--primary)';
  });
  
  el.dropZone.addEventListener('dragleave', () => {
    el.dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
  });
  
  el.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropZone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    if (e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  });
  
  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImageUpload(e.target.files[0]);
    }
  });
  
  // 手牌クリア・リセット
  el.btnClearHand.addEventListener('click', () => {
    state.hand = Array(14).fill(null);
    updateHandUI();
    calculateScore();
  });
  
  // ドラ表示牌追加ボタン
  el.btnAddDora.addEventListener('click', () => {
    if (state.doraIndicators.length < 5) {
      state.doraIndicators.push('1z'); // デフォルト東を追加
      updateHandUI();
      calculateScore();
    }
  });
  
  el.btnClearDora.addEventListener('click', () => {
    state.doraIndicators = [];
    updateHandUI();
    calculateScore();
  });
  
  // 各種設定コントロール変更イベント同期
  [
    el.winTsumo, el.winRon,
    el.prevalentWind, el.seatWind,
    el.chkRiichi, el.chkDoubleRiichi, el.chkIppatsu,
    el.chkRinshan, el.chkChankan, el.chkHaitei
  ].forEach(input => {
    input.addEventListener('change', calculateScore);
  });
  
  // 計算ボタン手動クリック
  el.btnCalculate.addEventListener('click', calculateScore);
  
  // モーダルクローズ
  el.btnCloseModal.addEventListener('click', closeTilePickerModal);
  window.addEventListener('click', (e) => {
    if (e.target === el.tilePickerModal) {
      closeTilePickerModal();
    }
  });
  
  // 立直・W立直の相互排他チェックボックス制御
  el.chkRiichi.addEventListener('change', (e) => {
    if (e.target.checked) el.chkDoubleRiichi.checked = false;
  });
  el.chkDoubleRiichi.addEventListener('change', (e) => {
    if (e.target.checked) el.chkRiichi.checked = false;
  });
  
  // ウィンドウサイズ調整時のリサイズ処理
  window.addEventListener('resize', () => {
    if (state.activeTab === 'camera' && state.cameraStream) {
      resizeOverlayCanvas();
    }
  });
}

// 初期化エントリーポイント
function init() {
  initTemplates();
  buildPickerUI();
  updateHandUI();
  calculateScore();
  initEvents();
  initCamera();
}

// 起動
window.addEventListener('DOMContentLoaded', init);
