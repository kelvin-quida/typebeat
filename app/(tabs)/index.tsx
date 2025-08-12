import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Button,
  FlatList,
  Platform,
  Text,
  View,
} from "react-native";

export default function App() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const player = useAudioPlayer();
  const [status, setStatus] = useState("pronto");

  const recordingsDir = FileSystem.documentDirectory + "recordings/";

  const [gravacoes, setGravacoes] = useState<string[]>([]);

  useEffect(() => {
    async function fetchGravacoes() {
      const lista = await listarGravacoes();
      setGravacoes(lista);
    }
    fetchGravacoes();
  }, []);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permissão não concedida para usar o microfone");
      }
      const dirInfo = await FileSystem.getInfoAsync(recordingsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(recordingsDir, {
          intermediates: true,
        });
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  const handleRecord = async () => {
    try {
      setStatus("preparando");
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus("gravando");
    } catch (e) {
      console.error(e);
      setStatus("erro");
    }
  };

  const handleStop = async () => {
    const now = new Date();

    const day = now.getDate().toString().padStart(2, "0");
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const year = now.getFullYear();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");

    const dateTimeString = `${day}${month}${year}${hours}${minutes}`;

    try {
      setStatus("parando");
      await recorder.stop();
      const tmpUri = recorder.uri;
      if (!tmpUri) throw new Error("URI da gravação não encontrada");

      const ext = tmpUri.split(".").pop() ?? "m4a";
      const newUri = recordingsDir + `${dateTimeString}.${ext}`;
      await FileSystem.moveAsync({ from: tmpUri, to: newUri });
      console.log("Gravação salva em:", newUri);
      setStatus("enviando");
      setStatus("pronto");
    } catch (e) {
      console.error(e);
      setStatus("erro");
    }
  };

  async function listarGravacoes() {
    try {
      const arquivos = await FileSystem.readDirectoryAsync(recordingsDir);
      console.log("Arquivos encontrados:", recordingsDir, arquivos);
      const caminhosCompletos = arquivos.map((nome) => recordingsDir + nome);
      console.log("Gravações:", caminhosCompletos);
      return caminhosCompletos;
    } catch (err) {
      console.error("Erro ao listar gravações:", err);
      return [];
    }
  }

  async function playAudio(uri: string) {
    try {
      setStatus("tocando");
      await player.replace(uri);
      await player.play();
      setStatus("pronto");
    } catch (e) {
      console.error("Erro ao tocar áudio:", e);
      setStatus("erro");
    }
  }

  async function shareAudio(uri: string) {
    const disponivel = await Sharing.isAvailableAsync();
    if (!disponivel) {
      alert("Compartilhamento não disponível neste dispositivo");
      return;
    }
    await Sharing.shareAsync(uri);
  }

  async function escolherECompartilharGravacao() {
    const arquivos = await listarGravacoes();

    if (!arquivos.length) {
      Alert.alert("Nenhuma gravação encontrada");
      return;
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            ...arquivos.map((a) => a.split("/").pop() ?? ""),
            "Cancelar",
          ],
          cancelButtonIndex: arquivos.length,
          title: "Escolha uma gravação para compartilhar",
        },
        async (buttonIndex) => {
          if (buttonIndex < arquivos.length) {
            await shareAudio(arquivos[buttonIndex]);
          }
        }
      );
    } else {
      Alert.alert(
        "Escolha uma gravação",
        "",
        [
          ...arquivos.map(
            (uri) => (
              console.log("Compartilhando:", uri),
              {
                text: uri.split("/").pop()!,
                onPress: async () => await shareAudio(uri),
              }
            )
          ),
          { text: "Cancelar", style: "cancel" },
        ],
        { cancelable: true }
      );
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text>Status: {status}</Text>
      <Button
        title={
          recorderState.isRecording ? "Parar Gravação" : "Iniciar Gravação"
        }
        onPress={recorderState.isRecording ? handleStop : handleRecord}
      />
      <Button
        title="Listar Gravações"
        onPress={async () => {
          const arquivos = await listarGravacoes();
          Alert.alert("Gravações", arquivos.join("\n"));
        }}
      />
      <Button
        title="Compartilhar Gravação"
        onPress={escolherECompartilharGravacao}
      />
      <FlatList
        data={gravacoes}
        keyExtractor={(item: any) => item}
        renderItem={({ item }: { item: string }) => (
          <View>
            <Text>{item}</Text>
            <Button
              title={`${item.split("/").pop()!}`}
              onPress={() => playAudio(item)}
            />
          </View>
        )}
      />
    </View>
  );
}
