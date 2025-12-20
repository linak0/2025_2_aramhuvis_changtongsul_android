// screens/HomeScreen.js

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { analyzeImageAsync } from '../api/client';
import { useSkinStore } from '../store/useSkinStore';

const USER_ID = 1;

export default function HomeScreen({ navigation }) {
  const [isAnalyzing, setAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestPermission] = useCameraPermissions();

  const setCurrentResult = useSkinStore((s) => s.setCurrentResult);
  const addHistory = useSkinStore((s) => s.addHistory);

  const askPickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
    });
    if (!result.canceled) {
      uploadAndAnalyze(result.assets[0].uri);
    }
  }, []);

  const uploadAndAnalyze = useCallback(
    async (uri) => {
      try {
        setAnalyzing(true);

        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1024 } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        const json = await analyzeImageAsync(manipulated.uri, USER_ID);

        setCurrentResult(json);
        addHistory({
          id: String(json.id),
          createdAt: json.created_at,
          thumb: json.source_image_url || manipulated.uri,
          scores: json.scores,
          overlays: json.overlays,
        });

        navigation.navigate('Result');
      } catch (e) {
        Alert.alert('분석 실패', e.message || 'Network request failed');
      } finally {
        setAnalyzing(false);
      }
    },
    [addHistory, navigation, setCurrentResult],
  );

  const openCamera = async () => {
    const { status } = await requestPermission();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
      return;
    }
    setShowCamera(true);
  };

  if (showCamera) {
    return (
      <CameraCapture
        onClose={() => setShowCamera(false)}
        onCaptured={(uri) => {
          setShowCamera(false);
          uploadAndAnalyze(uri);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>피부 분석</Text>
      <Text style={styles.subtitle}>셀카를 촬영하거나 사진을 선택해 분석을 시작하세요.</Text>

      <View style={{ height: 24 }} />

      <Pressable style={[styles.btn, styles.primary]} onPress={openCamera} disabled={isAnalyzing}>
        <Text style={styles.btnTextPrimary}>카메라로 촬영</Text>
      </Pressable>

      <View style={{ height: 12 }} />

      <Pressable style={styles.btn} onPress={askPickImage} disabled={isAnalyzing}>
        <Text style={styles.btnText}>갤러리에서 선택</Text>
      </Pressable>

      <View style={{ height: 24 }} />

      <Pressable
        style={[styles.linkBtn]}
        onPress={() => navigation.navigate('History')}
        disabled={isAnalyzing}
      >
        <Text style={styles.linkText}>히스토리 보기</Text>
      </Pressable>

      {isAnalyzing && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>분석 중…(약 10초)</Text>
        </View>
      )}
    </View>
  );
}

function CameraCapture({ onClose, onCaptured }) {
  const [permission] = useCameraPermissions();
  const [isTaking, setTaking] = useState(false);
  let cameraRef;

  return (
    <View style={styles.cameraContainer}>
      {permission?.granted ? (
        <CameraView style={{ flex: 1 }} ref={(ref) => (cameraRef = ref)} />
      ) : (
        <View
          style={[
            styles.cameraContainer,
            { alignItems: 'center', justifyContent: 'center' },
          ]}
        >
          <Text>카메라 권한이 필요합니다.</Text>
        </View>
      )}
      <View style={styles.cameraToolbar}>
        <Pressable style={styles.circleBtn} onPress={onClose}>
          <Text>✕</Text>
        </Pressable>
        <Pressable
          style={[styles.circleBtn, styles.shutter]}
          onPress={async () => {
            if (isTaking) return;
            try {
              setTaking(true);
              const photo = await cameraRef.takePictureAsync({ quality: 1 });
              onCaptured?.(photo.uri);
            } catch (e) {
              Alert.alert('촬영 실패', e.message);
            } finally {
              setTaking(false);
            }
          }}
        />
        <View style={styles.circleBtn} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 32, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { marginTop: 8, color: '#607d8b' },

  btn: {
    backgroundColor: '#eceff1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primary: { backgroundColor: '#3A86FF' },
  btnText: { color: '#0f172a', fontWeight: '600' },
  btnTextPrimary: { color: '#fff', fontWeight: '700' },

  linkBtn: { paddingVertical: 6, alignItems: 'center' },
  linkText: { color: '#2a5bd7', fontWeight: '600' },

  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraToolbar: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#37474f',
  },
});

