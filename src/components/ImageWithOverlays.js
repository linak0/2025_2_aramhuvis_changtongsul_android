import React, { useMemo, useState, useEffect } from "react";
import { View, Image, Text, ActivityIndicator } from "react-native";

const ALL_LAYERS = ["acne", "hemo", "mela", "pore", "wrinkle"];

export default function ImageWithOverlays({
  sourceUrl,
  overlays = {},
  activeLayers, // Set(["acne"]) or array
  alpha = 0.6,
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const [baseReady, setBaseReady] = useState(false);
  const [overlayReadyMap, setOverlayReadyMap] = useState({}); // {key:true/false}

  const active = useMemo(() => {
    if (!activeLayers) return new Set();
    return activeLayers instanceof Set ? activeLayers : new Set(activeLayers);
  }, [activeLayers]);

  const activeKey = useMemo(() => Array.from(active)[0] ?? null, [active]);

  // Prefetch base + overlay images for smoother swaps
  useEffect(() => {
    if (sourceUrl) Image.prefetch(sourceUrl).catch(() => {});
    ALL_LAYERS.forEach((k) => {
      const u = overlays?.[k];
      if (u) Image.prefetch(u).catch(() => {});
    });
  }, [sourceUrl, overlays]);

  const isActiveOverlayReady = useMemo(() => {
    if (!activeKey) return true;
    if (!overlays?.[activeKey]) return true;
    return !!overlayReadyMap[activeKey];
  }, [activeKey, overlays, overlayReadyMap]);

  const showSpinner = !!sourceUrl && (!baseReady || !isActiveOverlayReady);

  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 1,
        backgroundColor: "#eee",
        overflow: "hidden",
        borderRadius: 12,
      }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: Math.floor(width), h: Math.floor(height) });
      }}
    >
      {!!sourceUrl ? (
        <Image
          source={{ uri: sourceUrl }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
          onLoadStart={() => setBaseReady(false)}
          onLoadEnd={() => setBaseReady(true)}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#607d8b" }}>원본 이미지 URL이 없습니다.</Text>
        </View>
      )}

      {/* 모든 레이어 이미지를 미리 올려둠 (hemo/mela도 서버 이미지를 그대로 사용) */}
      {ALL_LAYERS.map((key) => {
        const url = overlays?.[key];
        if (!url || !size.w || !size.h) return null;

        const visible = active.has(key);

        return (
          <Image
            key={key}
            source={{ uri: url }}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              opacity: visible ? alpha : 0,
            }}
            resizeMode="cover"
            onLoadStart={() =>
              setOverlayReadyMap((prev) => ({ ...prev, [key]: false }))
            }
            onLoadEnd={() =>
              setOverlayReadyMap((prev) => ({ ...prev, [key]: true }))
            }
          />
        );
      })}

      {/* 로딩 오버레이 (원본/현재 마스크 준비될 때까지) */}
      {showSpinner && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.25)",
          }}
        >
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
}
