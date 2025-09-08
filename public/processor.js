class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (input && input.length > 0) {
      let sum = 0;
      for (let channel = 0; channel < input.length; channel++) {
        const inputChannel = input[channel];
        const outputChannel = output[channel];
        for (let i = 0; i < inputChannel.length; i++) {
          outputChannel[i] = inputChannel[i]; // passthrough
          sum += inputChannel[i] ** 2;
        }
      }

      const rms = Math.sqrt(sum / input[0].length);
      this.port.postMessage({ volume: rms });
    }

    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
