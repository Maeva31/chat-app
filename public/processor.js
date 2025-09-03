class ChatProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "cutoff",
        defaultValue: 150, // 150 Hz = coupe les bruits graves
        minValue: 20,
        maxValue: 1000,
      }
    ];
  }

  constructor() {
    super();
    this.lastSample = 0; // mémoire pour le filtre
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const cutoff = parameters.cutoff[0]; 

    if (input && input[0]) {
      const inChan = input[0];
      const outChan = output[0];
      const RC = 1.0 / (cutoff * 2 * Math.PI);
      const dt = 1.0 / sampleRate;
      const alpha = RC / (RC + dt);

      for (let i = 0; i < inChan.length; i++) {
        // filtre passe-haut simple
        const filtered = alpha * (this.lastSample + inChan[i] - (i > 0 ? inChan[i - 1] : this.lastSample));
        outChan[i] = filtered;
        this.lastSample = inChan[i];
      }
    }
    return true;
  }
}

registerProcessor("chat-processor", ChatProcessor);
