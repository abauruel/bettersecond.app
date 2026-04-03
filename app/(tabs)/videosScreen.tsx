import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Text, ActivityIndicator, RefreshControl, Modal, Alert, TextInput } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define a estrutura dos dados de health
interface HealthData {
  status?: string;
  uptime?: number;
  timestamp?: string;
  [key: string]: any; // Permite outros campos dinâmicos
}

export default function HealthScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [serverIP, setServerIP] = useState('10.42.0.1');
  const [showIPModal, setShowIPModal] = useState(false);
  const [tempIP, setTempIP] = useState('10.42.0.1');
  const [ipLoaded, setIpLoaded] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);

  const healthUrl = `http://${serverIP}:5000/health`;
  const baseUrl = `http://${serverIP}:5000`;

  // Carregar IP salvo ao iniciar
  useEffect(() => {
    loadServerIP();
  }, []);

  // Buscar health quando o IP for carregado ou mudar
  useEffect(() => {
    if (ipLoaded) {
      fetchHealth();
    }
  }, [serverIP, ipLoaded]);

  async function loadServerIP() {
    try {
      const savedIP = await AsyncStorage.getItem('@server_ip');
      if (savedIP) {
        setServerIP(savedIP);
        setTempIP(savedIP);
        console.log('[Health] IP carregado:', savedIP);
      }
    } catch (error) {
      console.error('[Health] Erro ao carregar IP:', error);
    } finally {
      setIpLoaded(true);
    }
  }

  async function saveServerIP() {
    try {
      // Validação básica de IP
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipPattern.test(tempIP)) {
        Alert.alert('Erro', 'Por favor, insira um endereço IP válido.');
        return;
      }

      await AsyncStorage.setItem('@server_ip', tempIP);
      setServerIP(tempIP);
      setShowIPModal(false);
      console.log('[Health] IP salvo:', tempIP);

      Alert.alert('Sucesso', `IP do servidor atualizado para: ${tempIP}`);
    } catch (error) {
      console.error('[Health] Erro ao salvar IP:', error);
      Alert.alert('Erro', 'Não foi possível salvar o endereço IP.');
    }
  }

  async function callAPI(endpoint: string, method: 'GET' | 'POST' | 'PUT' = 'POST', data?: any) {
    try {
      setActionLoading(true);
      setActionFeedback(null);
      console.log(`[API] ${method} ${endpoint}...`, data);

      const response = await axios({
        method,
        url: `${baseUrl}${endpoint}`,
        data: data || {},
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
        validateStatus: (status) => status < 600, // Aceita qualquer status < 600
      });

      console.log('[API] Resposta:', response.data);

      // Mensagem customizada para update_time
      let feedbackMessage = response.data.message || 'Ação executada com sucesso!';
      if (endpoint === '/update_time' && response.data.current_datetime) {
        feedbackMessage = `Hora atualizada: ${response.data.current_datetime}`;
      }

      setActionFeedback({
        message: feedbackMessage,
        type: 'success'
      });

      // Atualiza health após ações
      setTimeout(() => fetchHealth(), 1000);

      return response.data;
    } catch (error: any) {
      console.error('[API] Erro:', error.message);
      setActionFeedback({
        message: error.response?.data?.message || error.message || 'Erro ao executar ação',
        type: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function recordEvent(camera: 'cam1' | 'cam2', duration: number = 10) {
    await callAPI(`/record/${camera}`, 'POST', { duration });
  }

  async function processTimestamps(daysBack: number = 3) {
    await callAPI('/process_timestamps', 'POST', { days_back: daysBack });
  }

  async function updateTime() {
    const now = new Date();
    const currentTime = now.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    Alert.alert(
      'Sincronizar Hora',
      `Deseja atualizar a hora do Raspberry Pi para:\n${currentTime}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sincronizar',
          onPress: () => {
            // Formato: YYYY-MM-DD HH:MM:SS (horário local, não UTC)
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            const datetime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            console.log('[updateTime] Enviando horário local:', datetime);
            callAPI('/update_time', 'POST', { datetime });
          }
        }
      ]
    );
  }

  async function shutdownSystem() {
    Alert.alert(
      'Desligar Sistema',
      'Tem certeza que deseja desligar o Raspberry Pi? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desligar',
          style: 'destructive',
          onPress: () => callAPI('/shutdown', 'POST', { delay: 10 })
        }
      ]
    );
  }

  async function restartService() {
    Alert.alert(
      'Reiniciar Serviço',
      'Deseja reiniciar o serviço Better Seconds?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar', onPress: () => callAPI('/restart_service', 'POST') }
      ]
    );
  }

  async function rebootCameras() {
    Alert.alert(
      'Reiniciar Sistema',
      'Deseja reiniciar o sistema de câmeras? Isso pode levar alguns segundos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar',
          onPress: async () => {
            await callAPI('/reboot', 'POST');
            setIsRebooting(true);
            setShowActionsModal(false);

            // Tenta reconectar a cada 5 segundos por até 60 segundos
            let attempts = 0;
            const maxAttempts = 12; // 12 * 5s = 60 segundos

            const reconnectInterval = setInterval(() => {
              attempts++;
              console.log(`[Reboot] Tentativa ${attempts}/${maxAttempts} de reconectar...`);

              fetchHealth();

              if (attempts >= maxAttempts) {
                clearInterval(reconnectInterval);
                setIsRebooting(false);
                console.log('[Reboot] Tempo máximo de espera atingido');
              }
            }, 5000);

            // Cleanup se o componente desmontar
            return () => clearInterval(reconnectInterval);
          }
        }
      ]
    );
  }

  async function fetchHealth() {
    try {
      setLoading(true);
      setError(null);
      console.log('[Health] Buscando dados de:', healthUrl);

      const response = await axios.get(healthUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 600, // Aceita qualquer status < 600 (incluindo 503)
      });

      console.log('[Health] Dados recebidos:', response.data);
      setHealthData(response.data);

      // Se estava reiniciando e conseguiu conectar, limpa o estado
      if (isRebooting) {
        setIsRebooting(false);
      }
    } catch (error: any) {
      console.error('[Health] Erro ao buscar dados:', error.message);

      // Se o sistema está reiniciando, mostra mensagem apropriada
      if (isRebooting) {
        setError('Sistema reiniciando... Aguardando reconexão');
      } else {
        // Detecta o tipo de erro
        let errorMessage = 'Erro ao conectar com o servidor';
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          errorMessage = 'Tempo de conexão esgotado';
        } else if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
          errorMessage = 'Sem conexão com o servidor';
        } else if (error.response) {
          errorMessage = `Erro do servidor: ${error.response.status}`;
        }

        setError(errorMessage);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function toggleSection(key: string) {
    setCollapsedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  function formatUptime(seconds?: number): string {
    if (!seconds) return 'N/A';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  }

  function formatTimestamp(timestamp?: string): string {
    if (!timestamp) return 'N/A';

    try {
      const date = new Date(timestamp);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  }

  function renderValue(key: string, value: any, isCollapsed: boolean): React.ReactNode {
    if (value === null || value === undefined) {
      return <Text style={styles.valueText}>N/A</Text>;
    }

    if (typeof value === 'boolean') {
      return (
        <Text style={[styles.valueText, { color: value ? '#999' : '#666' }]}>
          {value ? 'Sim' : 'Não'}
        </Text>
      );
    }

    if (typeof value === 'object') {
      if (isCollapsed) {
        return (
          <Text style={styles.collapsedText}>
            {Array.isArray(value) ? `[${value.length} items]` : `{${Object.keys(value).length} properties}`}
          </Text>
        );
      }

      return (
        <View style={styles.nestedObject}>
          {Object.entries(value).map(([nestedKey, nestedValue]) => (
            <View key={nestedKey} style={styles.nestedRow}>
              <Text style={styles.nestedKeyText}>{nestedKey}:</Text>
              <Text style={styles.nestedValueText}>{JSON.stringify(nestedValue)}</Text>
            </View>
          ))}
        </View>
      );
    }

    // Formatação especial para campos conhecidos
    if (key === 'uptime' && typeof value === 'number') {
      return <Text style={styles.valueText}>{formatUptime(value)}</Text>;
    }

    if (key === 'timestamp' && typeof value === 'string') {
      return <Text style={styles.valueText}>{formatTimestamp(value)}</Text>;
    }

    if (key === 'status') {
      return <Text style={[styles.valueText, styles.statusBadge]}>{value}</Text>;
    }

    return <Text style={styles.valueText}>{String(value)}</Text>;
  }

  const onRefresh = () => {
    setRefreshing(true);
    fetchHealth();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Carregando dados do servidor...</Text>
      </View>
    );
  }

  if (error && !healthData) {
    return (
      <>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>{isRebooting ? '🔄' : '📡'}</Text>
          <Text style={styles.errorTitle}>
            {isRebooting ? 'Sistema Reiniciando' : 'Servidor Indisponível'}
          </Text>
          <Text style={styles.errorMessage}>{error}</Text>

          <View style={styles.errorInfoBox}>
            <Text style={styles.errorInfoTitle}>
              {isRebooting ? 'Aguardando reconexão...' : 'Tentando conectar em:'}
            </Text>
            <Text style={styles.errorInfoUrl}>{healthUrl}</Text>
            <Text style={styles.errorInfoIP}>IP: {serverIP}</Text>
          </View>

          {!isRebooting && (
            <Text style={styles.errorSuggestion}>
              Verifique se o Raspberry Pi está ligado e conectado à rede
            </Text>
          )}

          <View style={styles.errorActions}>
            <TouchableOpacity
              onPress={fetchHealth}
              style={styles.retryButton}
              disabled={isRebooting}
            >
              <Text style={styles.retryButtonText}>
                {isRebooting ? '⏳ Aguardando...' : '🔄 Tentar Novamente'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setTempIP(serverIP);
                setShowIPModal(true);
              }}
              style={styles.configButton}
            >
              <Text style={styles.configButtonText}>⚙️ Configurar IP</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal de Configuração do IP */}
        <Modal
          visible={showIPModal}
          animationType="slide"
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
                <Text style={styles.labelText}>Endereço IP do Servidor:</Text>
                <TextInput
                  style={styles.ipInput}
                  value={tempIP}
                  onChangeText={setTempIP}
                  placeholder="Ex: 10.42.0.1"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.helperText}>
                  Digite o endereço IP do Raspberry Pi na rede
                </Text>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveServerIP}
                >
                  <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowIPModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4CAF50']} />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Health Monitor</Text>
            <Text style={styles.headerSubtitle}>{healthUrl}</Text>
          </View>
          <TouchableOpacity
            style={styles.ipButton}
            onPress={() => {
              setTempIP(serverIP);
              setShowIPModal(true);
            }}
          >
            <Text style={styles.ipButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={[styles.errorBanner, isRebooting && styles.warningBanner]}>
          <Text style={styles.errorBannerText}>
            {isRebooting ? '🔄 ' : '⚠️ '}{error}
          </Text>
        </View>
      )}

      {healthData && (
        <View style={styles.dataContainer}>
          {Object.entries(healthData).map(([key, value]) => {
            const isObject = typeof value === 'object' && value !== null;
            const isCollapsed = collapsedSections[key] || false;

            return (
              <TouchableOpacity
                key={key}
                style={styles.dataRow}
                onPress={() => isObject && toggleSection(key)}
                activeOpacity={isObject ? 0.7 : 1}
              >
                <View style={styles.dataRowHeader}>
                  <Text style={styles.keyText}>{key}</Text>
                  {isObject && (
                    <Text style={styles.collapseIcon}>
                      {isCollapsed ? '▶' : '▼'}
                    </Text>
                  )}
                </View>
                {renderValue(key, value, isCollapsed)}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity onPress={fetchHealth} style={styles.manualRefreshButton}>
          <Text style={styles.manualRefreshText}>Atualizar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionsButton}
          onPress={() => setShowActionsModal(true)}
        >
          <Text style={styles.actionsButtonText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de Ações */}
      <Modal
        visible={showActionsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowActionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ações do Sistema</Text>
              <TouchableOpacity onPress={() => setShowActionsModal(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Feedback de Ações */}
              {actionFeedback && (
                <View style={[
                  styles.feedbackBanner,
                  actionFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
                ]}>
                  <Text style={styles.feedbackText}>
                    {actionFeedback.message}
                  </Text>
                </View>
              )}

              {actionLoading && (
                <View style={styles.loadingBanner}>
                  <ActivityIndicator size="small" color="#999" />
                  <Text style={styles.loadingBannerText}>Executando...</Text>
                </View>
              )}

              {/* Gravação */}
              <Text style={styles.sectionTitle}>GRAVAÇÃO</Text>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => recordEvent('cam1', 10)}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionButtonText}>Câmera 1</Text>
                  <Text style={styles.actionButtonSubtext}>10 segundos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => recordEvent('cam2', 10)}
                  disabled={actionLoading}
                >
                  <Text style={styles.actionButtonText}>Câmera 2</Text>
                  <Text style={styles.actionButtonSubtext}>10 segundos</Text>
                </TouchableOpacity>
              </View>

              {/* Processamento */}
              <Text style={styles.sectionTitle}>PROCESSAMENTO</Text>
              <TouchableOpacity
                style={styles.actionButtonFull}
                onPress={() => processTimestamps(3)}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Processar Timestamps</Text>
                <Text style={styles.actionButtonSubtext}>Últimos 3 dias</Text>
              </TouchableOpacity>

              {/* Sistema */}
              <Text style={styles.sectionTitle}>SISTEMA</Text>
              <TouchableOpacity
                style={styles.actionButtonFull}
                onPress={updateTime}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Sincronizar Hora</Text>
                <Text style={styles.actionButtonSubtext}>Atualiza hora do Raspberry Pi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButtonFull}
                onPress={restartService}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Reiniciar Serviço</Text>
              </TouchableOpacity>

              {/* Ações Críticas */}
              <Text style={styles.sectionTitle}>CRÍTICO</Text>
              <TouchableOpacity
                style={[styles.actionButtonFull, styles.actionButtonDanger]}
                onPress={rebootCameras}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Reiniciar Sistema</Text>
                <Text style={styles.actionButtonSubtext}>Reboot do sistema de câmeras</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButtonFull, styles.actionButtonDanger]}
                onPress={shutdownSystem}
                disabled={actionLoading}
              >
                <Text style={styles.actionButtonText}>Desligar Sistema</Text>
                <Text style={styles.actionButtonSubtext}>Delay de 10 segundos</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de Configuração do IP */}
      <Modal
        visible={showIPModal}
        animationType="slide"
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
              <Text style={styles.labelText}>Endereço IP do Servidor:</Text>
              <TextInput
                style={styles.ipInput}
                value={tempIP}
                onChangeText={setTempIP}
                placeholder="Ex: 10.42.0.1"
                placeholderTextColor="#666"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.helperText}>
                Digite o endereço IP do Raspberry Pi na rede
              </Text>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveServerIP}
              >
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowIPModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
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
    backgroundColor: '#0b0809',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0809',
    padding: 20,
  },
  header: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#888',
  },
  ipButton: {
    backgroundColor: '#2f3034',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#555',
  },
  ipButtonText: {
    fontSize: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 48,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  errorInfoBox: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 20,
    width: '90%',
    alignItems: 'center',
  },
  errorInfoTitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  errorInfoUrl: {
    fontSize: 14,
    color: '#999',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  errorInfoIP: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 5,
  },
  errorSuggestion: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 30,
    fontStyle: 'italic',
  },
  errorActions: {
    width: '90%',
    gap: 10,
  },
  errorBanner: {
    backgroundColor: '#F44336',
    padding: 15,
    margin: 10,
    borderRadius: 5,
  },
  warningBanner: {
    backgroundColor: '#FF9800',
  },
  errorBannerText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2f3034',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  configButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    width: '100%',
    alignItems: 'center',
  },
  configButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dataContainer: {
    padding: 15,
  },
  dataRow: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#555',
  },
  dataRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapseIcon: {
    fontSize: 16,
    color: '#999',
    marginLeft: 10,
  },
  collapsedText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 5,
  },
  keyText: {
    fontSize: 14,
    color: '#888',
    textTransform: 'uppercase',
    marginBottom: 5,
    letterSpacing: 1,
  },
  valueText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    backgroundColor: '#2f3034',
    borderWidth: 1,
    borderColor: '#555',
  },
  nestedObject: {
    backgroundColor: '#0d0d0d',
    padding: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  nestedRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  nestedKeyText: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
  },
  nestedValueText: {
    fontSize: 14,
    color: '#CCC',
    flex: 1,
  },
  footer: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manualRefreshButton: {
    flex: 1,
    backgroundColor: '#2f3034',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
  },
  manualRefreshText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionsButton: {
    backgroundColor: '#2f3034',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  actionsButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    fontSize: 24,
    color: '#888',
    paddingHorizontal: 10,
  },
  modalBody: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#999',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2f3034',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
  },
  actionButtonFull: {
    backgroundColor: '#2f3034',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonSuccess: {
    borderColor: '#555',
    backgroundColor: '#2f3034',
  },
  actionButtonWarning: {
    borderColor: '#555',
    backgroundColor: '#2f3034',
  },
  actionButtonDanger: {
    borderColor: '#666',
    backgroundColor: '#3a1a1a',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButtonSubtext: {
    color: '#888',
    fontSize: 11,
    marginTop: 5,
  },
  feedbackBanner: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  feedbackSuccess: {
    backgroundColor: '#1a2a1a',
    borderWidth: 1,
    borderColor: '#3a4a3a',
  },
  feedbackError: {
    backgroundColor: '#2a1a1a',
    borderWidth: 1,
    borderColor: '#4a3a3a',
  },
  feedbackText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: 'rgba(100, 100, 100, 0.3)',
    borderRadius: 8,
    marginBottom: 15,
  },
  loadingBannerText: {
    color: '#888',
    fontSize: 14,
    marginLeft: 10,
  },
  labelText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  ipInput: {
    backgroundColor: '#0d0d0d',
    color: '#fff',
    fontSize: 18,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    marginBottom: 10,
  },
  helperText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#2f3034',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    marginBottom: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 16,
  },
});

