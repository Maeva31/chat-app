class MicProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    // Copier le signal d’entrée vers la sortie
    for (let channel = 0; channel < input.length; channel++) {
      output[channel].set(input[channel]);
    }

    // 🔊 Ici tu peux analyser ou modifier le son avant envoi
    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
