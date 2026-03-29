import { StyleSheet, View, Text, Alert, TouchableOpacity, Dimensions, Modal, TextInput } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { NetworkInfo } from 'react-native-network-info';
import { useEffect, useState } from 'react';
import { requestPermissions } from '@/utils/android/requestPermissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const [isConnectedToBTS, setIsConnectedToBTS] = useState(false);
  const [player1Status, setPlayer1Status] = useState('loading');
  const [player2Status, setPlayer2Status] = useState('loading');
  const [player1Error, setPlayer1Error] = useState('');
  const [player2Error, setPlayer2Error] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [serverIP, setServerIP] = useState('192.168.1.187');
  const [showIPModal, setShowIPModal] = useState(false);
  const [tempIP, setTempIP] = useState('192.168.1.187');

  // Carregar IP salvo ao iniciar
  useEffect(() => {
    loadServerIP();
  }, []);

  async function loadServerIP() {
    try {
      const savedIP = await AsyncStorage.getItem('@server_ip');
      if (savedIP) {
        setServerIP(savedIP);
        setTempIP(savedIP);
        console.log('[Config] IP carregado:', savedIP);
      }
    } catch (error) {
      console.error('[Config] Erro ao carregar IP:', error);
    }
  }

  async function saveServerIP(ip: string) {
    try {
      await AsyncStorage.setItem('@server_ip', ip);
      setServerIP(ip);
      console.log('[Config] IP salvo:', ip);
      // Forçar reconexão dos players
      handleRetry();
    } catch (error) {
      console.error('[Config] Erro ao salvar IP:', error);
      Alert.alert('Erro', 'Não foi possível salvar o IP');
    }
  }

  function validateAndSaveIP() {
    // Validação básica de IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(tempIP)) {
      Alert.alert('Erro', 'IP inválido. Use o formato: 192.168.1.1');
      return;
    }

    const parts = tempIP.split('.');
    const isValid = parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });

    if (!isValid) {
      Alert.alert('Erro', 'IP inválido. Cada número deve estar entre 0 e 255');
      return;
    }

    saveServerIP(tempIP);
    setShowIPModal(false);
    Alert.alert('Sucesso', `IP atualizado para ${tempIP}`);
  }

  // useEffect(() => {
  //   // Verifica o SSID da rede Wi-Fi
  //   async function checkSSID() {
  //     const hasPermission = await requestPermissions()
  //     if (!hasPermission) {
  //       return
  //     }

  //     NetworkInfo.getBSSID().then(ssid => {
  //       console.log(ssid);
  //       if (ssid === 'd8:3a:dd:86:cb:b2') {
  //         setIsConnectedToBTS(true);
  //       } else {
  //         Alert.alert('Aviso', 'Você não está conectado à rede Wi-Fi "bts".');
  //         setIsConnectedToBTS(false);
  //       }
  //     });
  //   }
  //   checkSSID();
  // }, []);

  // URLs RTSP das câmeras - usando IP dinâmico
  const streamUrl1 = `rtsp://${serverIP}:8554/live/stream1`;
  const streamUrl2 = `rtsp://${serverIP}:8554/live/stream2`;

  console.log('[VLC] Iniciando players (tentativa #' + retryKey + ') com URLs:', streamUrl1, streamUrl2);
  
  function handleRetry() {
    console.log('[VLC] Reiniciando players...');
    setPlayer1Status('loading');
    setPlayer2Status('loading');
    setPlayer1Error('');
    setPlayer2Error('');
    setRetryKey(prev => prev + 1);
  }

  function openIPSettings() {
    setTempIP(serverIP);
    setShowIPModal(true);
  }
  
  useEffect(() => {
    console.log('🔄 Player 1 Status mudou para:', player1Status);
    console.log('🔄 Player 2 Status mudou para:', player2Status);
  }, [player1Status, player2Status]);

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


  // if (!isConnectedToBTS) {
  //   return (
  //     <View style={styles.container_message_wifi}>
  //       <Text style={styles.warningText}>Você não está conectado à rede Wi-Fi "bts".</Text>
  //       <TouchableOpacity onPress={handleRefresh} style={{ backgroundColor: 'white', padding: 10, borderRadius: 5 }}>
  //         <Text style={{ color: 'black' }}>Tentar novamente</Text>
  //       </TouchableOpacity>
  //       <Text style={styles.title}>Conecte-se à rede Wi-Fi "bts" para acessar as câmeras.</Text>
  //     </View>
  //   )
  // }

  return (
    <View style={styles.container}>
      <Text style={{ color: 'white', fontSize: 20 }}>{isConnectedToBTS ? 'Conectado' : 'Desconectado'}</Text>
      <Text style={styles.title}>Cameras ao vivo</Text>
      
      <TouchableOpacity 
        onPress={handleRetry}
        style={{ backgroundColor: '#4CAF50', padding: 10, borderRadius: 5, marginBottom: 10 }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>🔄 Recarregar Câmeras</Text>
      </TouchableOpacity>
      
      <View style={styles.cameraView}>
        <View style={styles.videoContainer}>
          <VLCPlayer
            key={`player1-${retryKey}`}
            source={{ 
              uri: streamUrl1,
              initOptions: [
                '--rtsp-tcp',
                '--network-caching=1000',
                '--rtsp-caching=1000',
                '--live-caching=1000',
                '--no-rtsp-kasenna',
                '--rtsp-frame-buffer-size=500000',
                '--verbose=2',
              ]
            }}
            autoplay={true}
            autoAspectRatio={true}
            resizeMode="contain"
            videoAspectRatio="16:9"
            style={styles.vlcPlayer}
            onError={(e) => {
              const errorMsg = JSON.stringify(e, null, 2);
              console.error('❌ VLC Player 1 Error:', errorMsg);
              console.error('❌ Error details:', {
                isPlaying: e?.isPlaying,
                currentTime: e?.currentTime,
                duration: e?.duration,
                target: e?.target,
                type: e?.type,
              });
              setPlayer1Status('error');
              setPlayer1Error(errorMsg);
            }}
            onPlaying={() => {
              console.log('✅ VLC Player 1 Playing');
              setPlayer1Status('playing');
            }}
            onBuffering={() => {
              console.log('⏳ VLC Player 1 Buffering');
              setPlayer1Status('buffering');
            }}
            onPaused={() => {
              console.log('⏸️ VLC Player 1 Paused');
              setPlayer1Status('paused');
            }}
            onStopped={() => {
              console.log('⏹️ VLC Player 1 Stopped');
              setPlayer1Status('stopped');
            }}
            onLoad={(data) => {
              console.log('📥 VLC Player 1 Loaded:', JSON.stringify(data));
            }}
          />
        </View>
        <View style={styles.videoDetails}>
          <Text style={styles.cameraText}>Camera 1</Text>
          <Text style={{ color: player1Status === 'playing' ? '#4CAF50' : (player1Status === 'error' ? '#F44336' : '#FFA726'), fontSize: 12, marginLeft: 10 }}>
            • {player1Status}
          </Text>
          {player1Error !== '' && (
            <Text style={{ color: '#F44336', fontSize: 10, marginTop: 5, flex: 1 }} numberOfLines={2}>
              {player1Error}
            </Text>
          )}
        </View>
      </View>
      
      <View style={styles.cameraView}>
        <View style={styles.videoContainer}>
          <VLCPlayer
            key={`player2-${retryKey}`}
            source={{ 
              uri: streamUrl2,
              initOptions: [
                '--rtsp-tcp',
                '--network-caching=1000',
                '--rtsp-caching=1000',
                '--live-caching=1000',
                '--no-rtsp-kasenna',
                '--rtsp-frame-buffer-size=500000',
                '--verbose=2',
              ]
            }}
            autoplay={true}
            autoAspectRatio={true}
            resizeMode="contain"
            videoAspectRatio="16:9"
            style={styles.vlcPlayer}
            onError={(e) => {
              const errorMsg = JSON.stringify(e, null, 2);
              console.error('❌ VLC Player 2 Error:', errorMsg);
              console.error('❌ Error details:', {
                isPlaying: e?.isPlaying,
                currentTime: e?.currentTime,
                duration: e?.duration,
                target: e?.target,
                type: e?.type,
              });
              setPlayer2Status('error');
              setPlayer2Error(errorMsg);
            }}
            onPlaying={() => {
              console.log('✅ VLC Player 2 Playing');
              setPlayer2Status('playing');
            }}
            onBuffering={() => {
              console.log('⏳ VLC Player 2 Buffering');
              setPlayer2Status('buffering');
            }}
            onPaused={() => {
              console.log('⏸️ VLC Player 2 Paused');
              setPlayer2Status('paused');
            }}
            onStopped={() => {
              console.log('⏹️ VLC Player 2 Stopped');
              setPlayer2Status('stopped');
            }}
            onLoad={(data) => {
              console.log('📥 VLC Player 2 Loaded:', JSON.stringify(data));
            }}
          />
        </View>
        <View style={styles.videoDetails}>
          <Text style={styles.cameraText}>Camera 2</Text>
          <Text style={{ color: player2Status === 'playing' ? '#4CAF50' : (player2Status === 'error' ? '#F44336' : '#FFA726'), fontSize: 12, marginLeft: 10 }}>
            • {player2Status}
          </Text>
          {player2Error !== '' && (
            <Text style={{ color: '#F44336', fontSize: 10, marginTop: 5, flex: 1 }} numberOfLines={2}>
              {player2Error}
            </Text>
          )}
        </View>
      </View>

      {/* Botão de Configuração de IP */}
      <TouchableOpacity 
        style={styles.configButton}
        onPress={openIPSettings}
      >
        <Text style={styles.configButtonText}>⚙ Configurar IP</Text>
      </TouchableOpacity>

      {/* Modal de Configuração de IP */}
      <Modal
        visible={showIPModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowIPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configurar IP do Servidor</Text>
              <TouchableOpacity onPress={() => setShowIPModal(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Endereço IP:</Text>
              <TextInput
                style={styles.ipInput}
                value={tempIP}
                onChangeText={setTempIP}
                placeholder="192.168.1.187"
                placeholderTextColor="#666"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.modalHint}>
                IP atual: {serverIP}
              </Text>
              <Text style={styles.modalHint}>
                Formato: 192.168.1.1
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setTempIP(serverIP);
                  setShowIPModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={validateAndSaveIP}
              >
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0b0809',
    alignItems: 'center',
  }, container_message_wifi: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0b0809',
    alignItems: 'center',
    gap: 10,
    padding: 10,
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

  videoContainer: {
    backgroundColor: 'black',
    borderTopEndRadius: 10,
    borderTopStartRadius: 10,
    overflow: 'hidden',
    width: Dimensions.get('window').width - 20,
    height: (Dimensions.get('window').width - 20) * 9 / 16,
  },

  vlcPlayer: {
    width: '100%',
    height: '100%',
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
  },
  configButton: {
    backgroundColor: '#2f3034',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#555',
    marginTop: 20,
    marginBottom: 20,
  },
  configButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    fontSize: 28,
    color: '#888',
    paddingHorizontal: 10,
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ipInput: {
    backgroundColor: '#2f3034',
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 5,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  modalHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#2f3034',
    paddingVertical: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#555',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#2f3034',
    paddingVertical: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#555',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

});