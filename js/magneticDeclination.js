/**
 * magneticDeclination.js — 磁気偏角計算モジュール
 *
 * モデル選択:
 *   'wmm2020' — geomag@1.0.0 (WMM2020・2020-2025年有効、グローバル変数 geomag)
 *   'wmm2025' — magvar@2.0.1 (WMM2025・2025-2030年有効、esm.sh 経由で動的ロード)
 *   'gsi2020' — 国土地理院 2020.0年値 2次近似式（日本国内専用・±数分精度）
 *               範囲外（日本域外）は wmm2025 にフォールバック
 *
 * 使い方:
 *   await setDeclinationModel('wmm2025'); // モデルを切り替える（初回はロード待機）
 *   const deg = getDeclination(lat, lng); // 偏角（度）を取得
 */

// 現在のモデル（デフォルト: wmm2020 で既存動作を維持）
let _model = 'wmm2020';
let _magvarFn = null; // magvar@2.0.1 の関数（wmm2025 選択時にロード）

/**
 * 国土地理院 2020.0年値 2次多項式近似式
 * 出典: https://www.gsi.go.jp/common/000214028.pdf
 * 有効範囲: 日本国内（緯度 24〜46°、経度 123〜146°）
 * 精度: ±数分（日本国内では WMM より高精度）
 *
 * D = a0 + a1*φ + a2*λ + a3*φ² + a4*φλ + a5*λ²
 * φ=緯度(°), λ=東経(°), D=偏角(°)（正=東偏）
 */
function _gsiDeclination(lat, lng) {
  const a0 =  1.30801e+2;
  const a1 = -2.06667;
  const a2 = -7.04288e-1;
  const a3 =  3.16008e-3;
  const a4 =  8.96021e-3;
  const a5 =  8.35936e-4;
  return a0 + a1 * lat + a2 * lng + a3 * lat * lat + a4 * lat * lng + a5 * lng * lng;
}

/** 座標が日本国内（GSI近似式の有効範囲）か判定 */
function _inJapan(lat, lng) {
  return lat >= 24 && lat <= 46 && lng >= 123 && lng <= 146;
}

/**
 * magvar@2.0.1 (WMM2025) を esm.sh から動的ロード
 * 2回目以降はキャッシュされた関数を返す
 */
async function _loadMagvar() {
  if (_magvarFn) return _magvarFn;
  const mod = await import('https://esm.sh/magvar@2.0.1');
  _magvarFn = mod.magvar;
  return _magvarFn;
}

/**
 * モデルを切り替える
 * wmm2025 は初回呼び出し時に esm.sh からロードする（以降はキャッシュ）
 * @param {'wmm2020'|'wmm2025'|'gsi2020'} model
 */
export async function setDeclinationModel(model) {
  _model = model;
  if (model === 'wmm2025' || model === 'gsi2020') {
    await _loadMagvar(); // gsi2020 も日本域外フォールバック用に事前ロード
  }
}

/** 現在のモデル名を返す */
export function getDeclinationModel() {
  return _model;
}

/**
 * 磁気偏角を取得（度、正=東偏）
 * @param {number} lat 緯度
 * @param {number} lng 経度
 * @returns {number} 偏角（度）
 */
export function getDeclination(lat, lng) {
  switch (_model) {
    case 'wmm2020':
      // 既存: geomag グローバル変数（WMM2020）
      return geomag.field(Math.min(89, Math.max(-89, lat)), lng).declination;

    case 'wmm2025':
      if (_magvarFn) return _magvarFn(lat, lng);
      // ロード前は wmm2020 で代替
      return geomag.field(Math.min(89, Math.max(-89, lat)), lng).declination;

    case 'gsi2020':
      if (_inJapan(lat, lng)) return _gsiDeclination(lat, lng);
      // 日本域外は wmm2025 にフォールバック
      if (_magvarFn) return _magvarFn(lat, lng);
      return geomag.field(Math.min(89, Math.max(-89, lat)), lng).declination;

    default:
      return geomag.field(Math.min(89, Math.max(-89, lat)), lng).declination;
  }
}
