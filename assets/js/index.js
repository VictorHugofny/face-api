const cam = document.getElementById("cam");

//configuração para usar o video
const startVideo = () => {
  navigator.getUserMedia(
    {
      video: true,
    },
    (stream) => (cam.srcObject = stream),
    (error) => console.log(error)
  );
};

//carregando dados para comparação IA
const loadLabels = () => {
  const labels = ["Victor Hugo", "Felipe Neto", "Douglas"];
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 1; i <= 5; i++) {
        const img = await faceapi.fetchImage(
          `/assets/lib/face-api/labels/${label}/${i}.jpg`
        );
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
};

//recebendo dados de forma assincrona
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.ageGenderNet.loadFromUri("/assets/lib/face-api/models"),
  faceapi.nets.ssdMobilenetv1.loadFromUri("/assets/lib/face-api/models"),
]).then(startVideo);

cam.addEventListener("play", async () => {
  const canvas = faceapi.createCanvasFromMedia(cam);

  //tamanho da tela de identificação
  const canvasSize = {
    width: cam.width,
    height: cam.height,
  };
  const labels = await loadLabels();
  faceapi.matchDimensions(canvas, canvasSize);
  document.body.appendChild(canvas);
  //decção do rosto, idade, nome, sexo
  setInterval(async () => {

    const detections = await faceapi
      //quadrado em volta do rosto
      .detectAllFaces(cam, new faceapi.TinyFaceDetectorOptions())
      //Pontos, expressoes, idade..
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender()
      .withFaceDescriptors();
    const resizedDetections = faceapi.resizeResults(detections, canvasSize);
    //comparar rostos com base dados
    const faceMatcher = new faceapi.FaceMatcher(labels, 0.6);
    const results = resizedDetections.map((d) =>
      faceMatcher.findBestMatch(d.descriptor)
    );
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    //desenhar detecsões
    faceapi.draw.drawDetections(canvas, resizedDetections);
    //metodo de detecção de pontos do rosto (desenhar)
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    //metodo de detecção de expressões
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    resizedDetections.forEach((detection) => {
      const { age, gender, genderProbability } = detection;
      new faceapi.draw.DrawTextField(
        [
          `${parseInt(age, 10)} years`,
          `${gender} (${parseInt(genderProbability * 100, 10)})`,
        ],
        detection.detection.box.topRight
      ).draw(canvas);
    });

    results.forEach((result, index) => {
      const box = resizedDetections[index].detection.box;
      const { label, distance } = result;
      new faceapi.draw.DrawTextField(
        [`${label} (${parseInt(distance * 100, 10)})`],
        box.bottomRight
      ).draw(canvas);
    });
  }, 100);
});
