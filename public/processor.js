class MicProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "cutoff",
        defaultValue: 150,
        minValue: 20,
        maxValue: 1000,
      },
    ];
  }

  constructor() {
    super();
    this.lastInput = 0;
    this.lastFiltered = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const inChan = input[0];
    const outChan = output[0];
    const cutoffArray = parameters.cutoff;

    for (let i = 0; i < inChan.length; i++) {
      const cutoff = cutoffArray.length > 1 ? cutoffArray[i] : cutoffArray[0];
      const RC = 1.0 / (2 * Math.PI * cutoff);
      const dt = 1.0 / sampleRate;
      const alpha = RC / (RC + dt);

      const filtered = alpha * (this.lastFiltered + inChan[i] - this.lastInput);
      outChan[i] = filtered;

      this.lastFiltered = filtered;
      this.lastInput = inChan[i];
    }

    return true;
  }
}

registerProcessor("mic-processor", MicProcessor);
