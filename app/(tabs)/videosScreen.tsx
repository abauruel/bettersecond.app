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
  const [serverIP, setServerIP] = useState('192.168.1.187');
  
  const healthUrl = `http://${serverIP}:5000/health`;
  const baseUrl = `http://${serverIP}:5000`;

  // Carregar IP salvo ao iniciar
  useEffect(() => {
    loadServerIP();
  }, []);

  async function loadServerIP() {
    try {
      const savedIP = await AsyncStorage.getItem('@server_ip');
      if (savedIP) {
        setServerIP(savedIP);
        console.log('[Health] IP carregado:', savedIP);
        // Recarregar health com novo IP
        setTimeout(() => fetchHealth(), 100);
      } else {
        fetchHealth();
      }
    } catch (error) {
      console.error('[Health] Erro ao carregar IP:', error);
      fetchHealth();
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
        data,
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
            // Formato ISO completo com timezone: 2026-03-28T15:30:45.123Z
            const datetime = now.toISOString();
            console.log('[updateTime] Enviando:', datetime);
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
    } catch (error: any) {
      console.error('[Health] Erro ao buscar dados:', error.message);
      setError(error.message || 'Erro ao conectar com o servidor');
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
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Erro</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity onPress={fetchHealth} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>🔄 Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
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
        <Text style={styles.headerTitle}>Health Monitor</Text>
        <Text style={styles.headerSubtitle}>{healthUrl}</Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#888',
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
  errorBanner: {
    backgroundColor: '#F44336',
    padding: 15,
    margin: 10,
    borderRadius: 5,
  },
  errorBannerText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#333',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#666',
  },
  retryButtonText: {
    color: 'white',
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
});

