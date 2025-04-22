import { StyleSheet, View, Text, Alert, TouchableOpacity } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { NetworkInfo } from 'react-native-network-info';
import { useEffect, useState } from 'react';
import { requestPermissions } from '@/utils/android/requestPermissions';

export default function Index() {
  const [isConnectedToBTS, setIsConnectedToBTS] = useState(false);

  // useEffect(() => {
  //   // Verifica o SSID da rede Wi-Fi
  //   async function checkSSID() {
  //     const hasPermission = await requestPermissions()
  //     if (!hasPermission) {
  //       return
  //     }

  //     NetworkInfo.getBSSID().then(ssid => {
  //       if (ssid === 'bts') {
  //         setIsConnectedToBTS(true);
  //       } else {
  //         Alert.alert('Aviso', 'Você não está conectado à rede Wi-Fi "bts".');
  //         setIsConnectedToBTS(false);
  //       }
  //     });
  //   }
  //   checkSSID();
  // }, []);

  const streamUrl1 = 'http://191.168.1.70:8888/live/stream1/stream.m3u8'; // Replace with your actual stream URL
  const streamUrl2 = 'http://191.168.1.70:8888/live/stream2/stream.m3u8'

  const player1 = useVideoPlayer(streamUrl1, player => {
    player.loop = true;
    player.play()
  });
  const player2 = useVideoPlayer(streamUrl2, player => {
    player.loop = true;
    player.play()
  });

  function handleRefresh() {
    NetworkInfo.getSSID().then(ssid => {
      console.log(ssid);
      if (ssid === 'bts') {
        setIsConnectedToBTS(true);
      } else {
        Alert.alert('Aviso', 'Você não está conectado à rede Wi-Fi "bts".');
        setIsConnectedToBTS(false);
      }
    });
  }

  // 

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cameras ao vivo</Text>
      <View style={styles.cameraView}>
        <VideoView
          player={player1}
          allowsFullscreen
          style={styles.video}
        />
        <View style={styles.videoDetails}>
          <Text style={styles.cameraText}>Camera 1</Text>
        </View>
      </View>
      <View style={styles.cameraView}>
        <VideoView
          player={player2}
          style={styles.video}
        />
        <View style={styles.videoDetails}>
          <Text style={styles.cameraText}>Camera 2</Text>
        </View>

      </View>

    </View>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0b0809',
  },
  title: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
    marginVertical: 10,
  },
  cameraView: {
    paddingVertical: 20,
    paddingHorizontal: 10,
  },


  video: {
    alignSelf: 'center',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'black',
    borderTopEndRadius: 10,
    borderTopStartRadius: 10,
  },
  videoDetails: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#2f3034',
    borderBottomEndRadius: 10,
    borderBottomStartRadius: 10,
  },
  cameraText: {
    color: 'white',
    fontSize: 16,
    marginTop: 2,
  },
  warningText: {
    color: 'red',
    fontSize: 18,
    textAlign: 'center',
    marginHorizontal: 20,
  }

});