import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Image } from 'react-native';
import dayjs from 'dayjs';
import { useSkinStore } from '../store/useSkinStore';

export default function HistoryScreen({ navigation }) {
  const history = useSkinStore((s) => s.history);
  const setCurrentResult = useSkinStore((s) => s.setCurrentResult);

  const renderItem = ({ item }) => {
    const topKey = topScoreKey(item.scores);
    return (
      <Pressable
        style={styles.card}
        onPress={() => {
          setCurrentResult({
            id: item.id,
            created_at: item.createdAt,
            source_image_url: item.thumb,
            scores: item.scores,
            overlays: item.overlays || {},
          });
          navigation.navigate('Result');
        }}
      >
        <Image source={{ uri: item.thumb }} style={styles.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          <Text style={styles.sub}>
            주요: {LABELS[topKey] || topKey} {formatScore(item.scores[topKey])}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (!history.length) {
    return (
      <View style={styles.empty}>
        <Text>아직 기록이 없어요.</Text>
        <Pressable
          style={styles.btn}
          onPress={() => navigation.navigate('Home')}
        >
          <Text>분석 시작하기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={history}
      keyExtractor={(it) => String(it.id)}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    />
  );
}

const LABELS = {
  acne: '트러블',
  hemo: '홍조/혈관',
  mela: '색소',
  pore: '모공',
  wrinkle: '주름',
};

function topScoreKey(scores = {}) {
  let max = -Infinity;
  let key = Object.keys(scores)[0];
  for (const k of Object.keys(scores)) {
    if (scores[k] > max) {
      max = scores[k];
      key = k;
    }
  }
  return key;
}

function formatScore(v) {
  return v <= 1 ? `${(v * 100).toFixed(0)}%` : `${v.toFixed(2)}`;
}
function formatDate(s) {
  return s ? dayjs(s).format('YYYY.MM.DD HH:mm') : '';
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#eceff1' },
  date: { fontWeight: '600' },
  sub: { marginTop: 4, color: '#607d8b' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btn: {
    marginTop: 12,
    backgroundColor: '#eceff1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
