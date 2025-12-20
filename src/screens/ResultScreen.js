import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, PanResponder } from "react-native";
import ImageWithOverlays from "../components/ImageWithOverlays";
import LayerChips from "../components/LayerChips";
import { useSkinStore } from "../store/useSkinStore";

const LAYERS = ["acne", "hemo", "mela", "pore", "wrinkle"];
const HEATMAP_TASKS = new Set(["hemo", "mela"]);

const DEFAULT_ALPHA_BY_TASK = {
  acne: 0.6,
  pore: 0.6,
  wrinkle: 0.55,
  hemo: 0.35, // (binary overlay fallback에만 쓰임)
  mela: 0.35,
};

export default function ResultScreen({ navigation }) {
  const result = useSkinStore((s) => s.currentResult);

  if (!result) {
    return (
      <View style={styles.center}>
        <Text>표시할 결과가 없습니다.</Text>
        <Pressable style={styles.btn} onPress={() => navigation.navigate("Home")}>
          <Text>홈으로</Text>
        </Pressable>
      </View>
    );
  }

  const scores = result?.scores || {};
  const overlays = result?.overlays || {};

  const source = result?.image_url || result?.source_image_url || null;
  const createdAt =
    result?.created_at || result?.analysis_created_at || result?.uploaded_at || "";
  const displayCreatedAt = useMemo(() => formatLocalDateString(createdAt), [createdAt]);

  const firstNonHeatmap = LAYERS.find((k) => !!overlays?.[k] && !HEATMAP_TASKS.has(k));
  const firstAny = LAYERS.find((k) => !!overlays?.[k]) || LAYERS[0];
  const defaultKey = firstNonHeatmap || firstAny;

  const [activeKey, setActiveKey] = useState(defaultKey);
  const [alphaPreview, setAlphaPreview] = useState(DEFAULT_ALPHA_BY_TASK[defaultKey] ?? 0.6); // UI-only while dragging
  const [sliderWidth, setSliderWidth] = useState(0);
  const sliderWidthRef = useRef(0);
  const isSlidingRef = useRef(false);
  const alphaPreviewRef = useRef(alphaPreview);
  const SNAP_STEP = 0.1;
  const TICK_MARKS = useMemo(() => Array.from({ length: 11 }, (_, i) => i / 10), []);

  const clamp01 = useCallback((v) => Math.max(0, Math.min(1, v)), []);
  const snapToStep = useCallback(
    (v) => {
      const snapped = clamp01(Math.round(v / SNAP_STEP) * SNAP_STEP);
      return +snapped.toFixed(2);
    },
    [SNAP_STEP, clamp01]
  );

  useEffect(() => {
    const next = DEFAULT_ALPHA_BY_TASK[activeKey] ?? 0.6;
    const snapped = snapToStep(next);
    setAlphaPreview(snapped);
    alphaPreviewRef.current = snapped;
  }, [activeKey, snapToStep]);

  const activeLayers = useMemo(() => new Set([activeKey]), [activeKey]);
  const isHeatmapTask = HEATMAP_TASKS.has(activeKey);

  const entries = useMemo(
    () =>
      Object.entries(scores).map(([k, v]) => ({
        key: k,
        label: LABELS[k] || k,
        value: v,
      })),
    [scores]
  );

  const sliderPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const width = sliderWidthRef.current;
          if (!width || width <= 1) return;
          const { locationX } = evt.nativeEvent;
          if (locationX === undefined || Number.isNaN(locationX)) return;
          const ratio = Math.max(0, Math.min(locationX, width)) / width;
          const quantized = snapToStep(ratio);
          isSlidingRef.current = true;
          setAlphaPreview(quantized);
          alphaPreviewRef.current = quantized;
        },
        onPanResponderMove: (evt) => {
          const width = sliderWidthRef.current;
          if (!width || width <= 1) return;
          const { locationX } = evt.nativeEvent;
          if (locationX === undefined || Number.isNaN(locationX)) return;
          const ratio = Math.max(0, Math.min(locationX, width)) / width;
          const quantized = snapToStep(ratio);
          const val = quantized;
          setAlphaPreview(val);
          alphaPreviewRef.current = val;
        },
        onPanResponderRelease: () => {
          if (!isSlidingRef.current) return;
          isSlidingRef.current = false;
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderTerminate: () => {
          if (!isSlidingRef.current) return;
          isSlidingRef.current = false;
        },
      }),
    [snapToStep]
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>분석 결과</Text>
      <Text style={styles.caption}>{displayCreatedAt}</Text>

      <View style={{ marginTop: 16 }}>
        <ImageWithOverlays
          sourceUrl={source}
          overlays={overlays}
          activeLayers={activeLayers}
          alpha={alphaPreview}
        />
      </View>

      <View style={{ height: 12 }} />

      <LayerChips
        layers={LAYERS}
        activeKey={activeKey}
        onSelect={setActiveKey}
        overlays={overlays}
      />

      {HEATMAP_TASKS.has(activeKey) && (
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            색이 진할수록 해당 특성이 상대적으로 두드러진 영역입니다.{"\n"}
            (히트맵 특성상 넓게 보일 수 있어요)
          </Text>
        </View>
      )}

      <View style={{ height: 12 }} />
      <View style={styles.card}>
        <Text style={styles.cardTitle}>마스크 투명도</Text>
        <View
          style={styles.sliderTouch}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setSliderWidth(w);
            sliderWidthRef.current = w;
          }}
          {...sliderPanResponder.panHandlers}
        >
          <View style={styles.sliderBar}>
            <View style={[styles.sliderFill, { width: `${alphaPreview * 100}%` }]} />
            <View style={styles.sliderTicks} pointerEvents="none">
              {TICK_MARKS.map((t) => (
                <View key={t} style={[styles.sliderTick, { left: `${t * 100}%` }]} />
              ))}
            </View>
          </View>
          <View
            pointerEvents="none"
            style={[styles.sliderThumb, { left: `${alphaPreview * 100}%` }]}
          />
        </View>
        <Text style={styles.sliderLabel}>{Math.round(alphaPreview * 100)}%</Text>
      </View>

      <View style={styles.grid}>
        {entries.map((e) => {
          const sev = severityMeta(e.value);
          return (
            <View key={e.key} style={[styles.statCard, { backgroundColor: sev.cardBg }]}>
              <Text style={[styles.statLabel, { color: sev.text }]}>
                {e.label}
              </Text>
              <Text style={[styles.statValue, { color: sev.text }]}>
                {formatScore(e.value)}
              </Text>
              <Text
                style={[
                  styles.statBadge,
                  { backgroundColor: sev.badgeBg, color: sev.badgeText },
                ]}
              >
                {sev.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ height: 20 }} />
      <Pressable style={styles.btnOutline} onPress={() => navigation.navigate("History")}>
        <Text style={styles.btnOutlineText}>히스토리에서 변화 보기</Text>
      </Pressable>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const LABELS = {
  acne: "트러블",
  hemo: "홍조/혈관",
  mela: "색소",
  pore: "모공",
  wrinkle: "주름",
};

function formatScore(v) {
  return v <= 1 ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(2)}`;
}
function formatLocalDateString(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return value;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function severityMeta(v) {
  if (v < 0.33)
    return {
      label: "보통",
      cardBg: "#e8f5e9",
      badgeBg: "#c8e6c9",
      badgeText: "#2e7d32",
      text: "#1b5e20",
    };
  if (v < 0.66)
    return {
      label: "주의",
      cardBg: "#fff8e1",
      badgeBg: "#ffe0b2",
      badgeText: "#e65100",
      text: "#e65100",
    };
  return {
    label: "심각",
    cardBg: "#ffebee",
    badgeBg: "#ffcdd2",
    badgeText: "#c62828",
    text: "#b71c1c",
  };
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 20, fontWeight: "700" },
  caption: { color: "#78909c", marginTop: 4 },

  tipBox: { marginTop: 4, padding: 10, borderRadius: 12, backgroundColor: "#f5f7fa" },
  tipText: { color: "#546e7a", fontSize: 12, lineHeight: 16 },

  card: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#fafafa" },
  cardTitle: { fontWeight: "600", marginBottom: 8 },
  sliderTouch: { marginTop: 4, height: 40, justifyContent: "center" },
  sliderBar: {
    height: 12,
    backgroundColor: "#eceff1",
    borderRadius: 999,
    overflow: "hidden",
    marginVertical: 6,
    position: "relative",
  },
  sliderFill: { height: "100%", backgroundColor: "#3A86FF" },
  sliderTicks: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  sliderTick: {
    position: "absolute",
    width: 2,
    height: "70%",
    backgroundColor: "#cfd8dc",
    transform: [{ translateX: -1 }],
  },
  sliderThumb: {
    position: "absolute",
    top: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#3A86FF",
    transform: [{ translateX: -13 }],
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  sliderLabel: { marginTop: 4, alignSelf: "flex-end", color: "#607d8b" },

  grid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "48%", borderRadius: 12, padding: 12, backgroundColor: "#f5f7fa" },
  statLabel: { color: "#546e7a" },
  statValue: { fontSize: 18, fontWeight: "700", marginTop: 6 },
  statBadge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#e8f0fe",
    color: "#2a5bd7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  btnOutline: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    alignItems: "center",
  },
  btnOutlineText: { color: "#2a5bd7", fontWeight: "600" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  btn: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: "#eceff1", borderRadius: 12 },
});
