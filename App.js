import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerBackTitle: '뒤로', headerTitleAlign: 'center' }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '피부 분석' }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: '분석 결과' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ title: '히스토리' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
