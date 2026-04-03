import { StyleSheet, View, Text, Alert, TouchableOpacity, Dimensions, Modal, TextInput, ScrollView, Animated } from 'react-native';
import { VLCPlayer } from 'react-native-vlc-media-player';
import { NetworkInfo } from 'react-native-network-info';
import { useEffect, useState, useRef } from 'react';
import { requestPermissions } from '@/utils/android/requestPermissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function Index() {
  const router = useRouter();
  const [isConnectedToBTS, setIsConnectedToBTS] = useState(false);
  const [player1Status, setPlayer1Status] = useState('loading');
  const [player2Status, setPlayer2Status] = useState('loading');
  const [player1Error, setPlayer1Error] = useState('');
  const [player2Error, setPlayer2Error] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [serverIP, setServerIP] = useState('192.168.1.187');
  const [showIPModal, setShowIPModal] = useState(false);
  const [tempIP, setTempIP] = useState('192.168.1.187');
  const [isRecording, setIsRecording] = useState(false);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);

  // Animação para o indicador de gravação
  const recordingOpacity = useRef(new Animated.Value(1)).current;

  // Carregar IP salvo ao iniciar
  useEffect(() => {
    loadServerIP();
  }, []);

  // Verificar status de gravação quando o IP mudar
  useEffect(() => {
    checkRecordingStatus();
  }, [serverIP]);

  // Animação de piscar quando estiver gravando
  useEffect(() => {
    if (isRecording) {
      const blinkAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingOpacity, {
            toValue: 0.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(recordingOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      blinkAnimation.start();
      return () => blinkAnimation.stop();
    } else {
      recordingOpacity.setValue(1);
    }
  }, [isRecording]);

  // Verificar status de gravação quando a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      console.log('[Index] Tela ganhou foco, verificando status de gravação...');
      checkRecordingStatus();
    }, [serverIP])
  );

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

  async function checkRecordingStatus() {
    try {
      const response = await fetch(`http://${serverIP}:5000/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Recording] Status health:', data);
        // Verifica se está gravando baseado no status do health
        if (data.status === 'healthy') {
          setIsRecording(true);
        } else {
          setIsRecording(false);
        }
      } else {
        console.log('[Recording] Servidor não respondeu, assumindo não gravando');
        setIsRecording(false);
      }
    } catch (error) {
      console.error('[Recording] Erro ao verificar status:', error);
      setIsRecording(false);
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

  async function handleStartRecording() {
    try {
      const response = await fetch(`http://${serverIP}:5000/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setIsRecording(true);
        Alert.alert('Sucesso', 'Gravação iniciada com sucesso!');
      } else {
        const errorText = await response.text();
        Alert.alert('Erro', `Falha ao iniciar gravação: ${errorText}`);
      }
    } catch (error) {
      console.error('[Recording] Erro ao iniciar gravação:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor de gravação');
    }
  }

  async function handleStopRecording() {
    try {
      const response = await fetch(`http://${serverIP}:5000/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setIsRecording(false);
        Alert.alert('Sucesso', 'Gravação parada com sucesso!');
      } else {
        const errorText = await response.text();
        Alert.alert('Erro', `Falha ao parar gravação: ${errorText}`);
      }
    } catch (error) {
      console.error('[Recording] Erro ao parar gravação:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor de gravação');
    }
  }

  async function handleRecordEvent() {
    try {
      const response = await fetch(`http://${serverIP}:5000/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        Alert.alert('Sucesso', 'Evento registrado com sucesso!');
      } else {
        const errorText = await response.text();
        Alert.alert('Erro', `Falha ao registrar evento: ${errorText}`);
      }
    } catch (error) {
      console.error('[Recording] Erro ao registrar evento:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor');
    }
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Action Card */}
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => setIsControlsCollapsed(!isControlsCollapsed)}
          activeOpacity={0.7}
        >
          <Text style={styles.cardTitle}>Controles</Text>
          <Text style={styles.collapseIcon}>{isControlsCollapsed ? '▼' : '▲'}</Text>
        </TouchableOpacity>

        {!isControlsCollapsed && (
          <>
            <TouchableOpacity
              onPress={handleRetry}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Recarregar Câmeras</Text>
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={isRecording ? handleStopRecording : handleStartRecording}
                style={[styles.primaryButtonHalf, isRecording && styles.warningButton]}
              >
                <View style={styles.buttonContent}>
                  <View style={[styles.statusIndicator, isRecording && styles.statusIndicatorActive]} />
                  <Text style={styles.primaryButtonText}>
                    {isRecording ? 'Parar' : 'Gravar'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRecordEvent}
                style={[styles.secondaryButtonHalf, !isRecording && styles.disabledButton]}
                disabled={!isRecording}
              >
                <Text style={[styles.secondaryButtonText, !isRecording && styles.disabledButtonText]}>Marcar Evento</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/videosScreen')}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Health Monitor</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={openIPSettings}
            >
              <Text style={styles.tertiaryButtonText}>Configurar IP</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Cameras Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitleStandalone}>Câmeras ao Vivo</Text>

        {/* Camera 1 */}
        <View style={styles.cameraSection}>
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
              onError={(e: any) => {
                const errorMsg = JSON.stringify(e, null, 2);
                console.error('VLC Player 1 Error:', errorMsg);
                setPlayer1Status('error');
                setPlayer1Error(errorMsg);
              }}
              onPlaying={() => {
                console.log('VLC Player 1 Playing');
                setPlayer1Status('playing');
              }}
              onBuffering={() => {
                console.log('VLC Player 1 Buffering');
                setPlayer1Status('buffering');
              }}
              onPaused={() => {
                console.log('VLC Player 1 Paused');
                setPlayer1Status('paused');
              }}
              onStopped={() => {
                console.log('VLC Player 1 Stopped');
                setPlayer1Status('stopped');
              }}
              onLoad={(data) => {
                console.log('VLC Player 1 Loaded:', JSON.stringify(data));
              }}
            />

            <View style={styles.videoOverlay}>
              <View style={styles.overlayTop}>
                <View style={styles.cameraLabelContainer}>
                  {isRecording && (
                    <Animated.View style={[styles.recordingIndicator, { opacity: recordingOpacity }]} />
                  )}
                  <Text style={styles.cameraLabel}>Câmera 1</Text>
                </View>
                <View style={styles.statusBadgeOverlay}>
                  <View style={[
                    styles.statusDot,
                    player1Status === 'playing' && styles.statusDotPlaying,
                    player1Status === 'error' && styles.statusDotError,
                  ]} />
                  <Text style={styles.statusTextOverlay}>{player1Status}</Text>
                </View>
              </View>
            </View>
          </View>

          {player1Error !== '' && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText} numberOfLines={2}>{player1Error}</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Camera 2 */}
        <View style={styles.cameraSection}>
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
              onError={(e: any) => {
                const errorMsg = JSON.stringify(e, null, 2);
                console.error('VLC Player 2 Error:', errorMsg);
                setPlayer2Status('error');
                setPlayer2Error(errorMsg);
              }}
              onPlaying={() => {
                console.log('VLC Player 2 Playing');
                setPlayer2Status('playing');
              }}
              onBuffering={() => {
                console.log('VLC Player 2 Buffering');
                setPlayer2Status('buffering');
              }}
              onPaused={() => {
                console.log('VLC Player 2 Paused');
                setPlayer2Status('paused');
              }}
              onStopped={() => {
                console.log('VLC Player 2 Stopped');
                setPlayer2Status('stopped');
              }}
              onLoad={(data) => {
                console.log('VLC Player 2 Loaded:', JSON.stringify(data));
              }}
            />

            <View style={styles.videoOverlay}>
              <View style={styles.overlayTop}>
                <View style={styles.cameraLabelContainer}>
                  {isRecording && (
                    <Animated.View style={[styles.recordingIndicator, { opacity: recordingOpacity }]} />
                  )}
                  <Text style={styles.cameraLabel}>Câmera 2</Text>
                </View>
                <View style={styles.statusBadgeOverlay}>
                  <View style={[
                    styles.statusDot,
                    player2Status === 'playing' && styles.statusDotPlaying,
                    player2Status === 'error' && styles.statusDotError,
                  ]} />
                  <Text style={styles.statusTextOverlay}>{player2Status}</Text>
                </View>
              </View>
            </View>
          </View>

          {player2Error !== '' && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText} numberOfLines={2}>{player2Error}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Modal de Configuração de IP */}
      <Modal
        visible={showIPModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowIPModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configurar Servidor</Text>
              <TouchableOpacity onPress={() => setShowIPModal(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>Endereço IP</Text>
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
              <Text style={styles.modalHint}>IP atual: {serverIP}</Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setTempIP(serverIP);
                  setShowIPModal(false);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={validateAndSaveIP}
              >
                <Text style={styles.modalSaveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },

  // Card styles
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cardTitleStandalone: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  collapseIcon: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '600',
  },

  // Button styles
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryButtonHalf: {
    flex: 1,
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 8,
  },
  warningButton: {
    backgroundColor: '#dc3545',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  secondaryButtonHalf: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  secondaryButtonText: {
    color: '#495057',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 8,
  },
  tertiaryButtonText: {
    color: '#6c757d',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
    borderColor: '#dee2e6',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#adb5bd',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c757d',
    marginRight: 8,
  },
  statusIndicatorActive: {
    backgroundColor: '#ffffff',
  },

  // Camera styles
  cameraSection: {
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#dee2e6',
    marginVertical: 20,
  },
  videoContainer: {
    backgroundColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  vlcPlayer: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  overlayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  cameraLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc3545',
  },
  cameraLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusBadgeOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextOverlay: {
    fontSize: 11,
    color: '#ffffff',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#adb5bd',
    marginRight: 6,
  },
  statusDotPlaying: {
    backgroundColor: '#28a745',
  },
  statusDotError: {
    backgroundColor: '#dc3545',
  },
  statusText: {
    fontSize: 12,
    color: '#495057',
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  errorContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fff5f5',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#dc3545',
  },
  errorText: {
    fontSize: 11,
    color: '#721c24',
    lineHeight: 16,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    fontSize: 32,
    color: '#adb5bd',
    lineHeight: 32,
    width: 32,
    textAlign: 'center',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 8,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ipInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  modalHint: {
    fontSize: 12,
    color: '#adb5bd',
    marginBottom: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  modalCancelButtonText: {
    color: '#495057',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 14,
    borderRadius: 8,
  },
  modalSaveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});