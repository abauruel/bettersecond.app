import { Alert, PermissionsAndroid, Platform } from 'react-native';

export async function requestPermissions() {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Permissão de Localização',
          message: 'Este aplicativo precisa de acesso à localização para verificar a rede Wi-Fi.',
          buttonNeutral: 'Perguntar depois',
          buttonNegative: 'Cancelar',
          buttonPositive: 'OK',
        }
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Permissão concedida');
        return true
      } else {
        console.log('Permissão negada');
        Alert.alert(
          'Permissão necessária',
          'A permissão de localização é necessária para verificar a rede Wi-Fi.'
        );
        return false;
      }
    } catch (err) {
      console.warn(err);
    }
  }
}