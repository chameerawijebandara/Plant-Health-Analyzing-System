import React, { useEffect, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO, decodeJpeg } from '@tensorflow/tfjs-react-native';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as SplashScreen from 'expo-splash-screen';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Picker } from '@react-native-picker/picker';
import { database } from './DataBaseAdapter';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';


const NoImageSign = require("./assets/NoImage.jpg");
const modelJson = require("./assets/FinalProjectModel/model.json");
const modelWeight = [require("./assets/FinalProjectModel/group1-shard1of7.bin"), require("./assets/FinalProjectModel/group1-shard2of7.bin"), require("./assets/FinalProjectModel/group1-shard3of7.bin"), require("./assets/FinalProjectModel/group1-shard4of7.bin"), require("./assets/FinalProjectModel/group1-shard5of7.bin"), require("./assets/FinalProjectModel/group1-shard6of7.bin"), require("./assets/FinalProjectModel/group1-shard7of7.bin")];

const HomeScreen = () => {
  const [selectedImage, setSelectedImage] = useState("");
  const [model, setModel] = useState(null);
  const [DIndex, SetDIndex] = useState(4);
  const [appIsReady, setAppIsReady] = useState(false);
  const [isModelBusy, SetIsModelBusy] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isDatabaseSharing, SetIsDatabaseSharing] = useState(false);
  const [selection, setSelection] = useState(null);
  const [imageFileName, SetImageFileName] = useState(null);
  const diseases = { 0: "Bacterial Leaf Blight", 1: "Brownspot", 2: "None", 3: "Leaf smut", 4: "" };
  const diseasesLinks = { 1: "https://doa.gov.lk/rrdi_ricediseases_brownspot/", 0: "https://doa.gov.lk/rrdi_ricediseases_bacterialleafblight/", 3: "http://www.riceportal.in/extension-domain/national/entyloma-oryzae" };
  const albumName = "RiceLeafDiseaseImageDataset";

  useEffect(() => {
    async function prepare() {
      try {
        // Keep the splash screen visible while we fetch resources
        await SplashScreen.preventAutoHideAsync();
        // Pre-load models and tensorflow js module
        await tf.ready();
        const model = await tf.loadGraphModel(bundleResourceIO(modelJson, modelWeight));
        setModel(model);
        // Load or set up the database
        await database.setupDatabaseAsync();
        await database.insertdisease("None");
        await database.insertdisease("Brownspot");
        await database.insertdisease("Bacterial Leaf Blight");
        await database.insertdisease("Leaf smut");
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
  }, [DIndex, isModelBusy, modalVisible]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);



  if (!appIsReady) {
    return null;
  }

  //This Function is used to get an image from the local storage
  let openImagePickerAsync = async () => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.canAskAgain || permissionResult.status === "denied") {
      Alert.alert('Permission Denied', 'Permission to access camera roll is required! Please go to settings and enable permissions for the app')
      return;
    }
    let pickerResult;
    imageLoadingIndicatorOn();
    try {
      pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1
      });

      if (pickerResult.cancelled === true) {
        imageLoadingIndicatorOff();
        return;
      }
      const Uri = await imageResizer(pickerResult.uri);
      deleteFile(pickerResult.uri);
      if (selectedImage != "") {
        await deleteFile(selectedImage.localUri);
      }
      imageLoadingIndicatorOff();
      setSelectedImage({ localUri: Uri });
      SetImageFileName(null);
      modelBusyIndicatorOn();
      await predict(await imageToTensor(Uri));
      modelBusyIndicatorOff();
    } catch (e) {
      Alert.alert('Network Error', 'Please check your internet connection and try again')
      imageLoadingIndicatorOff();
    }
  };

  //This function is used to open the camera
  const openCamera = async () => {
    // Ask the user for the permission to access the camera

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.canAskAgain || permissionResult.status === "denied") {
      //alert('Please go to settings and enable permissions for the app');
      Alert.alert('Permission Denied', 'Permission to access camera is required! Please go to settings and enable permissions for the app')
      return;
    }

    imageLoadingIndicatorOn();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });


    if (!result.cancelled) {
      const Uri = await imageResizer(result.uri);
      deleteFile(result.uri);
      if (selectedImage != "") {
        await deleteFile(selectedImage.localUri);
      }
      imageLoadingIndicatorOff();
      setSelectedImage({ localUri: Uri });
      SetImageFileName(null);
      modelBusyIndicatorOn();
      await predict(await imageToTensor(Uri));
      modelBusyIndicatorOff();
    } else {
      imageLoadingIndicatorOff();
    }
  }
  //This Function is used to convert to image to tensor object
  const imageToTensor = async (imageUri) => {
    const imgB64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
    const raw = new Uint8Array(imgBuffer);
    let imageTensor3D = decodeJpeg(raw);
    let floatimageTensor3D = imageTensor3D.cast('float32');
    let resizedimageTensor4D = floatimageTensor3D.expandDims(0);
    tf.dispose(imageTensor3D);
    tf.dispose(floatimageTensor3D);
    return resizedimageTensor4D;
  };

  //This function is used to save the image in a directory
  const saveImage = async (Uri) => {
    const asset = await MediaLibrary.createAssetAsync(Uri);
    let imageName = asset.filename;
    SetImageFileName(imageName);
    const album = await MediaLibrary.getAlbumAsync(albumName);
    if (!album) {
      await MediaLibrary.createAlbumAsync(albumName, asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync(asset, album, false);
    }
    return imageName;
  }

  //This function is used to save the correct disease in the database
  const saveSelection = async () => {
    imageLoadingIndicatorOn();
    let disease = diseases[selection];
    if (imageFileName == null) {
      const imageName = await saveImage(selectedImage.localUri);
      await database.insertAnImage(imageName, disease);
    } else {
      await database.updateAnImage(imageFileName, disease);
    }
    SetDIndex(selection);
    setModalVisible(false);
    imageLoadingIndicatorOff();
  }

  //This function is used to share the database
  const shareDatabase = async () => {
    databaseSharingIndicatorOn();
    const uri = FileSystem.documentDirectory + 'SQLite/RiceLeafDiseaseDataSet.db';
    await Sharing.shareAsync(uri, { mimeType: "application/octet-stream" })
    databaseSharingIndicatorOff();
  }

  //This method is used to delete files inside the expo filesystem
  const deleteFile = async (fileUri) => {
    await FileSystem.deleteAsync(fileUri, {
      idempotent: true
    });
  }

  function modelBusyIndicatorOn() {
    SetDIndex(4);
    SetIsModelBusy(true);
  }

  function modelBusyIndicatorOff() {
    SetIsModelBusy(false);
  }

  function imageLoadingIndicatorOn() {
    setIsImageLoading(true);
  }
  function imageLoadingIndicatorOff() {
    setIsImageLoading(false);
  }
  function databaseSharingIndicatorOn() {
    SetIsDatabaseSharing(true);
  }
  function databaseSharingIndicatorOff() {
    SetIsDatabaseSharing(false);
  }

  //This Function is used to resize the image
  const imageResizer = async (imageUri) => {
    const resizedImage = await manipulateAsync(
      imageUri,
      [
        { resize: { width: 256, height: 256 } },
      ],
      { compress: 1, format: SaveFormat.JPEG }
    );
    return resizedImage.uri;
  }

  //This function is used to predict the Rice Leaf Diesease
  const predict = async (tensor4D) => {
    let prediction = await model.predict(tensor4D);
    let reducedPrediction = tf.squeeze(prediction);
    let finalPrediction = tf.round(reducedPrediction);
    const IndexTensor = finalPrediction.argMax();
    const Index = IndexTensor.arraySync();
    tf.dispose(tensor4D);
    tf.dispose(prediction);
    tf.dispose(reducedPrediction);
    tf.dispose(IndexTensor);
    const maxTensor = tf.max(finalPrediction);
    const max = maxTensor.arraySync();
    tf.dispose(maxTensor);
    if (max != 1) {
      SetDIndex(2);
      setSelection(2);
    } else {
      SetDIndex(Index);
      setSelection(Index);
    }
    tf.dispose(finalPrediction);
  }

  //This function is used to open relevant external links to diseases
  const OpenRelevantLink = async () => {
    if (diseases[DIndex] != "" && diseases[DIndex] != "None") {
      await Linking.openURL(diseasesLinks[DIndex]);
    }
  };

  const selectionView = () => {
    return (
      <View >
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVisible}
        >
          <View style={styles.centeredView}>
            <View style={styles.popupview}>
              <Text style={styles.modalText}>Select the correct disease</Text>
              <View style={{ alignContent: 'center', borderColor: "black", borderWidth: 1, borderRadius: 20, width: 250, marginBottom: "8%" }}>
                <Picker
                  selectedValue={String(selection)}
                  mode='dropdown'
                  onValueChange={(itemValue, itemIndex) => { { setSelection(Number(itemValue)); } }
                  }>
                  <Picker.Item label="None" value="2" />
                  <Picker.Item label="Leaf smut" value="3" />
                  <Picker.Item label="Bacterial Leaf Blight" value="0" />
                  <Picker.Item label="Brownspot" value="1" />
                </Picker>
              </View>
              <View >
                {Number(selection) != DIndex ?
                  <TouchableOpacity
                    style={{ activeOpacity: 0.8 }}
                    onPress={saveSelection}
                  >
                    <View style={styles.buttonView}>
                      <View style={styles.button}>
                        <Text style={styles.textStyle}>Save</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  : null}

                <TouchableOpacity
                  style={{ activeOpacity: 0.8 }}
                  onPress={() => setModalVisible(!modalVisible)}
                >
                  <View style={styles.buttonView}>
                    <View style={styles.button}>
                      <Text style={styles.textStyle}>Exit</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        <TouchableOpacity
          style={{ activeOpacity: 0.8 }}
          onPress={() => setModalVisible(!modalVisible)}
        >
          <View style={styles.buttonView}>
            <View style={styles.button}>
              <Feather name="edit" size={32} color="white" />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  const predictionView = () => {
    return (
      <View >
        <View style={{ alignItems: 'center' }}>
          <Image style={styles.image} source={selectedImage != "" ? { uri: selectedImage.localUri } : NoImageSign}></Image>
        </View>
        {selectedImage != "" && !isModelBusy ?
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.predictiontext}>
                {"Disease: " + diseases[DIndex] + " "}
              </Text>
              {diseases[DIndex] != "None" ?
                <TouchableOpacity style={{ activeOpacity: 0.8 }} onPress={OpenRelevantLink}>
                  <Ionicons name="ios-information-circle" size={30} color="black" />
                </TouchableOpacity> : null
              }
            </View>
          </View>
          : null}
      </View>
    );
  }

  const loadingScreen = (State, text) => {
    return (
      <Modal animationType="fade" transparent={true} visible={State}>
        <View style={styles.centeredView}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>{text}</Text>
            <ActivityIndicator animating={State} size='large' color={"#000000"} focusable={true} />
          </View>
        </View>
      </Modal>
    )
  };

  const GalleryButtonView = () => {
    return (
      <TouchableOpacity style={{ activeOpacity: 0.8 }} onPress={openImagePickerAsync} >
        <View style={styles.buttonView}>
          <View style={styles.button}>
            <MaterialCommunityIcons name="folder-image" size={35} color="white" />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  const CameraButtonView = () => {
    return (
      <TouchableOpacity style={{ activeOpacity: 0.8 }} onPress={openCamera}>
        <View style={styles.buttonView}>
          <View style={styles.button}>
            <Ionicons name="camera-outline" size={35} color="white" />
          </View>
        </View>
      </TouchableOpacity>
    )
  }
  const DataBaseShareButonView = () => {
    return (
      <TouchableOpacity
        style={{ activeOpacity: 0.8 }}
        onPress={shareDatabase}
      >
        <View style={styles.buttonView}>
          <View style={styles.button}>
            <MaterialCommunityIcons name="database-export" size={35} color="white" />
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View onLayout={onLayoutRootView}
      style={styles.backgroundView}>
      <StatusBar style="dark" translucent={true} animated={true} />
      <View style={{ justifyContent: 'center', alignItems: 'center', }}>
        <Image
          style={{ width: 100, height: 100, marginBottom: "3%" }}
          source={require('./assets/RiceLeafPlant.jpg')}
        />
        <Text style={{ fontSize: 25, fontWeight: 'bold', marginBottom: "3%" }} >
          Rice leaf disease detector
        </Text>
        <View>
          <Text style={{ color: '#61688B', fontWeight: 'bold', textAlign: 'justify', marginBottom: "3%" }}>
            Welcome to rice leaf disease detector.This detector can identify Brownspot,Bacterial Leaf Blight and Leaf smut diseases.
          </Text>
        </View>
      </View>
      <ScrollView>
        {predictionView()}
        {loadingScreen(isImageLoading || isDatabaseSharing, 'Please Wait')}
        {loadingScreen(isModelBusy, 'Predicting')}
        {selectedImage != "" && !isModelBusy ? selectionView() : null}
        {GalleryButtonView()}
        {CameraButtonView()}
        {DataBaseShareButonView()}
      </ScrollView>
    </View>
  );
};
export default HomeScreen;

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  buttonView: {
    height: 60,
    bottom: 0,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  button: {
    height: 50,
    backgroundColor: '#000000',
    flex: 1,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center"
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center"
  },
  image: {
    flex: 1,
    width: 256,
    height: 256,
    resizeMode: "contain",
    borderColor: '#000000',
    borderWidth: 3,
  },
  predictiontext: {
    color: '#000000',
    fontWeight: 'bold',
    textAlign: 'justify',
    fontSize: 20
  },
  backgroundView: {
    backgroundColor: '#fff',
    flex: 1,
    height: "100%",
    paddingTop: "10%",
    paddingRight: 20,
    paddingLeft: 20,
  },
  popupview: {

    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 35,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  }
});

