import { Platform } from 'react-native';

const BASE_URL = __DEV__
  ? (Platform.OS === 'web' ? 'http://localhost:3003' : 'http://192.168.1.76:3003')
  : 'https://inv.recman.com/backend';

export default BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
