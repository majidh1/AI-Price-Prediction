const tf = require('@tensorflow/tfjs-node');

// Sample data
const sampleData = require("./trade-history.json")

// Preprocess the data
// We shall normalize the volume (V), min price (MN), max price (MX), and first traded price (F) and try to predict the next day's last traded price (L)
const xs = sampleData.map(item => [item.V, item.MN, item.MX, item.F]);
const ys = sampleData.map(item => item.L);

// Remove the last element from the features as we will not have a corresponding 'next day' label for it
const inputFeatures = xs.slice(0, xs.length - 1);
// Remove the first element from the labels to shift the labels one day ahead
const targetValues = ys.slice(1);

// Convert the data to tensors
const inputTensor = tf.tensor2d(inputFeatures, [inputFeatures.length, 4]);
const labelTensor = tf.tensor2d(targetValues, [targetValues.length, 1]);

// Normalize the data to the range 0-1
const inputMax = inputTensor.max(0);  // Max value of each column
const inputMin = inputTensor.min(0);  // Min value of each column
const labelMax = labelTensor.max();
const labelMin = labelTensor.min();

const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));
const normalizedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin));

// Define a simple model architecture
const model = tf.sequential();
model.add(tf.layers.dense({ units: 24, activation: 'relu', inputShape: [4] }));
model.add(tf.layers.dense({ units: 24, activation: 'relu' }));
model.add(tf.layers.dense({ units: 1 }));

// Compile model with a smaller learning rate and mean squared error loss.
model.compile({
  optimizer: tf.train.adam(0.001),
  loss: 'meanSquaredError',
});

// Train the model
async function trainModel() {
  await model.fit(normalizedInputs, normalizedLabels, {
    batchSize: 32,
    epochs: 100,
  });
  console.log('Model training complete.');
}

// After the initial training and initial prediction, we might predict further using our model
async function predictLaterDays(startingData, numberOfDays) {
    let lastDayData = startingData;
    const futurePredictions = [];
    for (let i = 0; i < numberOfDays; i++) {
      const normalizedLastDayData = tf.tensor2d(lastDayData, [1, 4])
        .sub(inputMin)
        .div(inputMax.sub(inputMin));
      const prediction = model.predict(normalizedLastDayData);
      const unnormalizedPrediction = prediction.mul(labelMax.sub(labelMin)).add(labelMin).dataSync()[0];
  
      futurePredictions.push(unnormalizedPrediction);
  
      // Update lastDayData for the next prediction. Assuming volume, min, max, and first price stay constant.
      // In reality, you would update these with estimates or keep the historical values if predicting only one day ahead.
      lastDayData = [lastDayData[0], lastDayData[1], lastDayData[2], unnormalizedPrediction];
    }
    return futurePredictions;
  }
  
  // ...
  
  // Predict for a certain number of days into the future
  const numberOfFutureDays = 100; // For example, let's predict the next 5 days
  trainModel().then(() => {
    const lastDayData = inputFeatures[inputFeatures.length - 1];
    predictLaterDays(lastDayData, numberOfFutureDays).then(futurePrices => {
      console.log(`Predicted last traded prices for the next ${numberOfFutureDays} days:`, futurePrices);
    });
  });