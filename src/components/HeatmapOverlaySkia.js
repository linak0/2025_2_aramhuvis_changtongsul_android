import React, { useMemo, useEffect, useRef } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import {
  Canvas,
  Rect,
  Skia,
  Shader,
  useImage,
  ImageShader,
} from "@shopify/react-native-skia";

/**
 * heatUrl: grayscale/probability map PNG URL
 * mode: "hemo" | "mela"
 * cutoff: below cutoff -> transparent
 * gamma: alpha curve
 * maxAlpha: overlay opacity cap (0..1)
 * channel: "r" | "a"   (heat stored in red or alpha)
 * visible: boolean (keep mounted for caching, just hide)
 * onReady: (ready:boolean) => void
 */
export default function HeatmapOverlaySkia({
  heatUrl,
  width,
  height,
  mode = "hemo",
  cutoff = 0.3,
  gamma = 2.0,
  maxAlpha = 0.35,
  minAlpha = 0.05,
  channel = "r",
  visible = true,
  onReady,
}) {
  const heatImg = useImage(heatUrl);
  const onReadyRef = useRef(onReady);
  const alertedRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onReadyRef.current?.(!!heatImg);
  }, [heatImg]);

  useEffect(() => {
    if (__DEV__ && heatImg && !alertedRef.current) {
      alertedRef.current = true;
      const w = typeof heatImg.width === "function" ? heatImg.width() : "?";
      const h = typeof heatImg.height === "function" ? heatImg.height() : "?";
      Alert.alert("Heatmap debug", `url: ${heatUrl}\nsize: ${w} x ${h}`);
    }
  }, [heatImg, heatUrl]);

  const effect = useMemo(() => {
    const sksl = `
      uniform shader heat;
      uniform float cutoff;
      uniform float gamma;
      uniform float maxAlpha;
      uniform float minAlpha;
      uniform float mode;     // 0=hemo, 1=mela
      uniform float useAlpha; // 0=use r, 1=use a

      half4 colormap(float t) {
        t = clamp(t, 0.0, 1.0);

        // hemo: light pink -> deep pink
        if (mode < 0.5) {
          float3 c1 = float3(1.0, 0.78, 0.86);
          float3 c2 = float3(0.86, 0.12, 0.36);
          float3 c = mix(c1, c2, t);
          return half4(c.r, c.g, c.b, 1.0);
        }

        // mela: pale yellow -> orange -> brown
        float3 a = float3(1.0, 0.95, 0.65);
        float3 b = float3(1.0, 0.55, 0.15);
        float3 c = float3(0.45, 0.22, 0.05);

        float3 col;
        if (t < 0.6) col = mix(a, b, t / 0.6);
        else col = mix(b, c, (t - 0.6) / 0.4);

        return half4(col.r, col.g, col.b, 1.0);
      }

      half4 main(float2 xy) {
        half4 h = heat.eval(xy);
        float v = (useAlpha > 0.5) ? float(h.a) : float(h.r);

        float base = clamp(v, 0.0, 1.0);
        float t = smoothstep(cutoff - 0.1, 1.0, base);

        float a = mix(minAlpha, maxAlpha, pow(t, gamma));
        a *= 0.65; // soften coverage so base skin shows through

        half4 col = colormap(base);
        // soften: blend heat tint toward white to avoid heavy wash-out
        float3 toned = mix(float3(1.0, 1.0, 1.0), col.rgb, 0.4);
        return half4(toned, a);
      }
    `;
    return Skia.RuntimeEffect.Make(sksl);
  }, []);

  // 레이아웃/이미지 준비 전: 로딩 표시(검정 덮임 방지)
  if (!effect || !width || !height) return null;

  if (!heatImg) {
    // visible일 때만 로딩 인디케이터 띄움
    return visible ? (
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator />
      </View>
    ) : null;
  }

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        opacity: visible ? 1 : 0,
      }}
      pointerEvents="none"
    >
      <Canvas style={{ width, height }}>
        <Rect x={0} y={0} width={width} height={height}>
          <Shader
            source={effect}
            uniforms={{
              cutoff,
              gamma,
              maxAlpha,
              minAlpha,
              mode: mode === "mela" ? 1 : 0,
              useAlpha: channel === "a" ? 1 : 0,
            }}
          >
            {/* ✅ 핵심: SkImage가 아니라 ImageShader여야 "shader"로 들어감 */}
            <ImageShader
              image={heatImg}
              x={0}
              y={0}
              width={width}
              height={height}
              fit="fill"
            />
          </Shader>
        </Rect>
      </Canvas>
    </View>
  );
}
