// api/client.js

import * as FileSystem from "expo-file-system";

import {
  API_BASE_URL,
  API_ANALYZE_PATH,
  API_UPLOAD_PATH,
  API_USER_RESULTS_PATH,
  API_USERS_PATH,
} from "./config";
import { USE_MOCK, mockAnalyze } from "./mock";

/**
 * fetch with timeout (무한로딩 방지)
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * 공통: 응답을 text로 먼저 읽고, ok 아니면 본문 포함해서 에러 throw.
 */
async function fetchTextOrThrow(url, options, timeoutMs = 60000) {
  const method = options?.method || "GET";

  let res;
  try {
    res = await fetchWithTimeout(url, options, timeoutMs);
  } catch (e) {
    throw new Error(`${method} ${url} failed: ${e?.message || "Network request failed"}`);
  }

  const text = await res.text().catch(() => "");

  console.log("=== HTTP ===");
  console.log(method, url);
  console.log("STATUS:", res.status);
  console.log("=== RAW RESPONSE TEXT ===");
  console.log(text);
  console.log("=== END RAW RESPONSE ===");

  if (!res.ok) {
    const hint =
      res.status === 500
        ? "\n\n(서버 /analyze 내부에서 에러. AI 내부 서비스(7777) 연동/로그 확인이 필요할 가능성이 큼)"
        : "";

    throw new Error(
      `${method} ${url} failed (${res.status}): ${text || "Network request failed"}${hint}`
    );
  }

  return text;
}

function safeJsonParse(text, context = "response") {
  try {
    return JSON.parse(text);
  } catch (e) {
    const head = (text || "").slice(0, 300);
    throw new Error(`${context} returned non-JSON: ${head}`);
  }
}

/**
 * content:// 등도 업로드 가능하도록 file:// 로 정규화
 * - file://면 그대로
 * - 아니면 cache로 복사해서 file:// URI를 확보
 */
async function normalizeToFileUri(uri) {
  if (!uri) throw new Error("normalizeToFileUri: empty uri");
  if (uri.startsWith("file://")) return uri;

  const dest = `${FileSystem.cacheDirectory}upload_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

/**
 * 1) 사용자 생성
 * 명세: POST /api/v1/users body: { "name": "Tester1" }
 * (서버가 query로 받는 버전이면 fallback)
 */
export async function createUserAsync(name) {
  const url = `${API_BASE_URL}${API_USERS_PATH}`;

  try {
    const text = await fetchTextOrThrow(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return safeJsonParse(text, "createUser");
  } catch (e) {
    const fallbackUrl = `${url}?name=${encodeURIComponent(name ?? "")}`;
    const text = await fetchTextOrThrow(fallbackUrl, { method: "POST" });
    return safeJsonParse(text, "createUser(fallback)");
  }
}

/**
 * 2) 이미지 업로드 (v1)
 * POST /api/v1/upload
 * multipart/form-data body: user_id, file
 */
export async function uploadImageAsync(localUri, userId) {
  const fileUri = await normalizeToFileUri(localUri);

  // 디버그용(필요 없으면 나중에 지워도 됨)
  console.log("upload localUri =", localUri);
  console.log("upload fileUri  =", fileUri);

  // 안정적으로 고정
  const filename = `image_${Date.now()}.jpg`;
  const type = "image/jpeg";

  const formData = new FormData();
  formData.append("user_id", String(userId));
  formData.append("file", {
    uri: fileUri,
    name: filename,
    type,
  });

  const url = `${API_BASE_URL}${API_UPLOAD_PATH}`;

  // ✅ Content-Type 헤더는 절대 넣지 마 (boundary 깨질 수 있음)
  const text = await fetchTextOrThrow(
    url,
    {
      method: "POST",
      body: formData,
    },
    60000
  );

  return safeJsonParse(text, "uploadImage");
}

/**
 * 3) 업로드된 이미지 분석 (v1)
 * POST /api/v1/analyze/{image_id}?user_id=1
 * body: { "user_id": 1 }  (서버 구현 따라 필요할 수 있어 둘 다 보냄)
 */
export async function analyzeExistingImageAsync(imageId, userId) {
  const url = `${API_BASE_URL}${API_ANALYZE_PATH}/${imageId}?user_id=${encodeURIComponent(
    userId
  )}`;

  const text = await fetchTextOrThrow(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    },
    180000
  );

  return safeJsonParse(text, "analyzeExistingImage");
}

/**
 * 4) 최종: HomeScreen에서 호출하는 "분석 시작"
 * upload -> analyze
 */
export async function analyzeImageAsync(localUri, userId) {
  if (USE_MOCK) return mockAnalyze(localUri);

  const uploadRes = await uploadImageAsync(localUri, userId);

  const image_id =
    uploadRes.image_id ?? uploadRes.id ?? uploadRes.imageId ?? uploadRes?.data?.image_id;
  const image_url =
    uploadRes.image_url ?? uploadRes.url ?? uploadRes.imageUrl ?? uploadRes?.data?.image_url;

  if (image_id == null) {
    throw new Error(
      `uploadImage returned no image_id. keys=${Object.keys(uploadRes || {}).join(",")}`
    );
  }

  const analysis = await analyzeExistingImageAsync(image_id, userId);

  const createdAt = new Date().toISOString();
  const scores = analysis.scores ?? analysis.score ?? {};
  const overlays = analysis.overlays ?? {};

  return {
    id: String(image_id),
    created_at: analysis.created_at ?? createdAt,
    source_image_url: image_url ?? localUri,
    scores,
    overlays,
    rawAnalysis: analysis,
  };
}

/**
 * 5) 유저 히스토리 조회
 * GET /api/v1/results/user/{user_id}
 */
export async function fetchUserResultsAsync(userId) {
  const url = `${API_BASE_URL}${API_USER_RESULTS_PATH}/${userId}`;
  const text = await fetchTextOrThrow(url, { method: "GET" }, 60000);
  return safeJsonParse(text, "fetchUserResults");
}
