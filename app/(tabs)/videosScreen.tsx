import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Text, Image, Alert } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import axios, { AxiosResponse } from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

import Ionicons from 'react-native-vector-icons/Ionicons';

// Define a estrutura de um item de vídeo
interface VideoItem {
  url?: string;
  thumbnail?: string;
  name?: string;
}



export default function VideoPlayerScreen() {
  // const { uri, title } = route.params;
  const [refreshing, setRefreshing] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const host = 'http://192.168.1.70:3333';
  const apiUrl = `${host}/api/videos`;

  const player = useVideoPlayer(`${host}${selectedVideo?.url}` || 'empty', player => {
    player.loop = true;
    player.play();
  });
  async function fetchVideos() {
    try {
      setRefreshing(true);
      const response: AxiosResponse<VideoItem[]> = await axios.get(apiUrl);
      setVideos(response.data);
    } catch (error: any) {
      console.error("Erro ao buscar vídeos da API:", error.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  function splitFileName(inputName: string | undefined) {
    if (!inputName) {
      return { fileName: 'Sem Título', formattedDate: '', formattedTime: '' };
    }
    const [fileName, datePart, timePart] = inputName.split('_')
    const year = datePart.slice(0, 4);
    const month = datePart.slice(4, 6);
    const day = datePart.slice(6, 8);
    const formattedDate = `${day}/${month}/${year}`;
    const hour = timePart.slice(0, 2);
    const minute = timePart.slice(2, 4);
    const second = timePart.slice(4, 6);

    const formattedTime = `${hour}:${minute}:${second}`;
    return { fileName, formattedDate, formattedTime };
  }

  const renderItem = ({ item }: { item: VideoItem }) => (
    <TouchableOpacity onPress={() => setSelectedVideo(item)} style={styles.item}>
      {item.thumbnail ? <Image source={{ uri: `${host}${item.thumbnail}` }} style={styles.thumbnail} /> : <View style={styles.placeholderThumbnail} />}
      <View style={styles.videoDetails}>
        <Text style={styles.title}>{splitFileName(item.name).fileName || 'Sem Título'}</Text>
        <Text style={styles.title}>{splitFileName(item.name).formattedDate || 'Sem Título'}</Text>
        <Text style={styles.title}>{splitFileName(item.name).formattedTime || 'Sem Título'}</Text>
      </View>
    </TouchableOpacity>
  );

  async function handleShareWhatsApp() {
    if (selectedVideo?.url) {
      const videoUrl = `${host}${selectedVideo.url}`;
      const fileUri = `${FileSystem.documentDirectory}${selectedVideo.name || 'video.mp4'}`;
      try {
        // Baixar o vídeo
        const { uri } = await FileSystem.downloadAsync(videoUrl, fileUri);
        console.log('Vídeo baixado em:', uri);

        // Verificar se o compartilhamento é suportado
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          // Compartilhar o arquivo via WhatsApp
          await Sharing.shareAsync(uri, {
            mimeType: 'video/mp4',
            dialogTitle: 'Compartilhar vídeo',
          });
        } else {
          Alert.alert('Erro', 'O compartilhamento não é suportado neste dispositivo.');
        }
      } catch (error) {
        console.error('Erro ao baixar ou compartilhar o vídeo:', error);
        Alert.alert('Erro', 'Não foi possível compartilhar o vídeo.');
      }
    }
  }

  async function handleDownload() {
    if (selectedVideo?.url) {
      const videoUrl = `${host}${selectedVideo.url}`;
      const fileUri = `${FileSystem.documentDirectory}${selectedVideo.name || 'video.mp4'}`;

      try {
        // Baixar o vídeo para o diretório local
        const { uri } = await FileSystem.downloadAsync(videoUrl, fileUri);

        // Solicitar permissão para acessar a galeria
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'É necessário permitir o acesso à galeria para salvar o vídeo.');
          return;
        }

        // Salvar o vídeo na galeria
        const asset = await MediaLibrary.createAssetAsync(uri);
        const albumName = 'BetterSecondsApp';
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
        Alert.alert('Download concluído', 'O vídeo foi salvo na galeria com sucesso!');
      } catch (error) {
        console.error('Erro ao baixar ou salvar o vídeo:', error);
        Alert.alert('Erro', 'Não foi possível baixar ou salvar o vídeo.');
      }
    }
  }

  async function handleDelete(filename: string | undefined) {
    if (!filename) return;

    if (selectedVideo) {
      Alert.alert(
        'Confirmar exclusão',
        'Tem certeza de que deseja excluir este vídeo?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              await axios.delete(`${host}/api/download/${filename}`)
              setVideos(videos.filter((video) => video !== selectedVideo));
              setSelectedVideo(null);
              Alert.alert('Excluído', 'O vídeo foi excluído.');
            },
          },
        ]
      );
    }
  }
  return (
    <View style={styles.container}>
      {selectedVideo ? (
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.video}
          />
          <Text style={styles.videoTitle}>{`${splitFileName(selectedVideo.name).fileName} ${splitFileName(selectedVideo.name).formattedDate} ${splitFileName(selectedVideo.name).formattedTime}`}</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleShareWhatsApp} style={styles.actionButton}>
              <Ionicons name="logo-whatsapp" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDownload} style={styles.actionButton}>
              <Ionicons name="download-outline" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(selectedVideo?.name)} style={styles.actionButton}>
              <Ionicons name="trash-outline" size={30} color="white" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setSelectedVideo(null)} style={styles.backButton}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      ) :
        (<FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={item => item.name ? item.name.toString() : Math.random().toString()}
          onRefresh={fetchVideos}
          refreshing={refreshing}
        />)
      }
    </View>

  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#0b0809',
  },
  item: {
    marginBottom: 10,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    borderTopRightRadius: 5,
    borderTopLeftRadius: 5,

    backgroundColor: '#ccc',
  },
  placeholderThumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: '#ccc',
    borderRadius: 5,
  },
  title: {
    margin: 5,
    fontSize: 16,
    color: 'white',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: 300,
  },
  videoTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  videoDetails: {
    flexDirection: 'row',
    marginBottom: 5,
    // marginLeft: 5,
    gap: 10,
    backgroundColor: '#2f3034',
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 5,
  },
  backButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#ff6347',
    borderRadius: 5,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  actionButton: {
    padding: 10,
    borderRadius: 5,
    margin: 5,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
  },

});

