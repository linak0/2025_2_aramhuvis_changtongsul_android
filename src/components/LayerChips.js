import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

const LABELS = {
  acne: "트러블",
  hemo: "홍조/혈관",
  mela: "색소",
  pore: "모공",
  wrinkle: "주름",
};

export default function LayerChips({ layers = [], activeKey = null, onSelect, overlays = {} }) {
  const handleSelect = typeof onSelect === "function" ? onSelect : null;

  return (
    <View style={styles.row}>
      {layers.map((key) => {
        const hasOverlay = !!overlays[key];
        const isActive = activeKey === key;

        return (
          <Pressable
            key={key}
            disabled={!hasOverlay || !handleSelect}
            onPress={() => handleSelect?.(key)}
            style={[
              styles.chip,
              isActive && styles.chipActive,
              (!hasOverlay || !handleSelect) && styles.chipDisabled,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                isActive && styles.chipTextActive,
                (!hasOverlay || !handleSelect) && styles.chipTextDisabled,
              ]}
            >
              {LABELS[key] || key}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cfd8dc",
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: "#e8f0fe",
    borderColor: "#3A86FF",
  },
  chipDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#e0e0e0",
  },
  chipText: {
    color: "#37474f",
    fontSize: 14,
  },
  chipTextActive: {
    color: "#2a5bd7",
    fontWeight: "600",
  },
  chipTextDisabled: {
    color: "#b0bec5",
  },
});
