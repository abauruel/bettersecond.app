import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Text, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

interface DateInfo {
  date: string;
  date_formatted: string;
  video_count: number;
  path: string;
}

interface VideoInfo {
  filename: string;
  size_bytes: number;
  size_mb: number;
  modified: string;
  download_url: string;
}

export default function VideosListScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState<DateInfo[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [serverIP, setServerIP] = useState('10.42.0.1');
  const [ipLoaded, setIpLoaded] = useState(false);

  const baseUrl = `http://${serverIP}:5000`;

  // Carregar IP salvo ao iniciar
  useEffect(() => {
    loadServerIP();
  }, []);

  // Buscar datas quando o IP for carregado
  useEffect(() => {
    if (ipLoaded) {
      fetchDates();
    }
  }, [serverIP, ipLoaded]);

  // Recarregar IP do AsyncStorage sempre que a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      console.log('[Videos] Tela ganhou foco, recarregando IP...');
      loadServerIP();
    }, [])
  );

  async function loadServerIP() {
    try {
      const savedIP = await AsyncStorage.getItem('@server_ip');
      if (savedIP) {
        setServerIP(savedIP);
        console.log('[Videos] IP carregado:', savedIP);
      }
    } catch (error) {
      console.error('[Videos] Erro ao carregar IP:', error);
    } finally {
      setIpLoaded(true);
    }
  }

  async function fetchDates() {
    try {
      setLoading(true);
      setError(null);
      console.log('[Videos] Buscando datas de:', `${baseUrl}/videos`);

      const response = await fetch(`${baseUrl}/videos`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Videos] Datas recebidas:', data);
        setDates(data.dates || []);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao buscar datas');
      }
    } catch (error: any) {
      console.error('[Videos] Erro ao buscar datas:', error);
      setError('Não foi possível conectar ao servidor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function fetchVideos(date: string) {
    try {
      setLoading(true);
      setError(null);
      console.log('[Videos] Buscando vídeos de:', `${baseUrl}/videos/${date}`);

      const response = await fetch(`${baseUrl}/videos/${date}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Videos] Vídeos recebidos:', data);
        setVideos(data.videos || []);
        setSelectedDate(date);
      } else {
        const errorData = await response.json();
        Alert.alert('Erro', errorData.message || 'Erro ao buscar vídeos');
      }
    } catch (error: any) {
      console.error('[Videos] Erro ao buscar vídeos:', error);
      Alert.alert('Erro', 'Não foi possível conectar ao servidor');
    } finally {
      setLoading(false);
    }
  }

  async function downloadVideo(videoUrl: string, filename: string) {
    try {
      const fullUrl = `${baseUrl}${videoUrl}`;
      console.log('[Videos] Abrindo vídeo:', fullUrl);

      const supported = await Linking.canOpenURL(fullUrl);
      if (supported) {
        await Linking.openURL(fullUrl);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o vídeo');
      }
    } catch (error) {
      console.error('[Videos] Erro ao abrir vídeo:', error);
      Alert.alert('Erro', 'Não foi possível abrir o vídeo');
    }
  }

  function formatDate(dateStr: string): string {
    try {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);

      // Criar objeto Date
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

      // Array de dias da semana em português
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const diaSemana = diasSemana[date.getDay()];

      return `${diaSemana}, ${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  }

  function formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  }

  function extractCameraFromFilename(filename: string): string {
    if (filename.includes('stream1')) return 'Câmera 1';
    if (filename.includes('stream2')) return 'Câmera 2';
    return 'Câmera';
  }

  const onRefresh = () => {
    setRefreshing(true);
    if (selectedDate) {
      fetchVideos(selectedDate);
    } else {
      fetchDates();
    }
  };

  if (loading && !refreshing && !ipLoaded) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1a1a1a" />
        <Text style={styles.loadingText}>Carregando vídeos...</Text>
      </View>
    );
  }

  if (error && dates.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Feather name="alert-circle" size={64} color="#dc3545" />
        <Text style={styles.errorTitle}>Erro ao Carregar Vídeos</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity onPress={fetchDates} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a1a1a']} />
      }
    >
      {selectedDate && (
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => {
                setSelectedDate(null);
                setVideos([]);
                fetchDates();
              }}
              style={styles.backButton}
            >
              <View style={styles.backButtonContent}>
                <Feather name="arrow-left" size={20} color="#495057" />
                <Text style={styles.backButtonText}>Voltar</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{formatDate(selectedDate)}</Text>
          </View>
        </View>
      )}

      {!selectedDate ? (
        // Lista de Datas
        <View style={styles.content}>
          {dates.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="folder" size={64} color="#adb5bd" />
              <Text style={styles.emptyStateText}>Nenhum vídeo disponível</Text>
              <Text style={styles.emptyStateSubtext}>
                Os vídeos gravados aparecerão aqui
              </Text>
            </View>
          ) : (
            dates.map((dateInfo) => (
              <TouchableOpacity
                key={dateInfo.date}
                style={styles.card}
                onPress={() => fetchVideos(dateInfo.date)}
              >
                <View style={styles.dateCardContent}>
                  <View style={styles.dateIcon}>
                    <Feather name="calendar" size={24} color="#495057" />
                  </View>
                  <View style={styles.dateInfo}>
                    <Text style={styles.dateTitle}>{dateInfo.date_formatted}</Text>
                    <Text style={styles.dateSubtitle}>
                      {dateInfo.video_count} {dateInfo.video_count === 1 ? 'vídeo' : 'vídeos'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={24} color="#dee2e6" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        // Lista de Vídeos
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1a1a1a" />
            </View>
          ) : videos.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="film" size={64} color="#adb5bd" />
              <Text style={styles.emptyStateText}>Nenhum vídeo nesta data</Text>
            </View>
          ) : (
            videos.map((video, index) => (
              <View key={index} style={styles.card}>
                <View style={styles.videoHeader}>
                  <View style={styles.videoIcon}>
                    <Feather name="video" size={24} color="#495057" />
                  </View>
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle}>
                      {extractCameraFromFilename(video.filename)}
                    </Text>
                    <Text style={styles.videoSubtitle}>
                      {formatTimestamp(video.modified)}
                    </Text>
                    <Text style={styles.videoSize}>
                      {video.size_mb.toFixed(2)} MB
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => downloadVideo(video.download_url, video.filename)}
                >
                  <Text style={styles.downloadButtonText}>Abrir Vídeo</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonText: {
    fontSize: 15,
    color: '#495057',
    fontWeight: '500',
  },
  content: {
    padding: 16,
    paddingTop: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dateCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  dateSubtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  videoHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  videoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  videoSubtitle: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 2,
  },
  videoSize: {
    fontSize: 12,
    color: '#adb5bd',
  },
  downloadButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6c757d',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
    marginTop: 20,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
    marginTop: 20,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});
