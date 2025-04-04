// pitch-shifter-processor.js

class PitchShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'pitch',
        defaultValue: 1.0,
        minValue: 0.5,
        maxValue: 4.0, // Wider range for testing.
        automationRate: 'k-rate'
      },
      {
        name: 'mix',
        defaultValue: 1.0, // 1 = fully processed (wet), 0 = dry (normal audio)
        minValue: 0.0,
        maxValue: 1.0,
        automationRate: 'k-rate'
      }
    ];
  }
  
  constructor() {
    super();
    // Define grain and hop sizes.
    this.grainSize = 1024;       // Number of samples per grain
    this.hopSize = 512;          // 50% overlap

    // Buffers for accumulating input and output.
    this.inputBuffer = new Float32Array(this.grainSize);
    this.inputBufferFill = 0;
    
    // Allocate an output accumulator buffer.
    this.outputBuffer = new Float32Array(this.grainSize * 4);
    this.outputBufferFill = 0;
    
    // Grain counter used to determine output offset.
    this.grainCounter = 0;
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    const output = outputs[0][0];
    if (!input || !output) return true;
    
    // Get the current pitch value.
    const pitch = parameters.pitch[0];
    
    // Accumulate input samples until we have a full grain.
    for (let i = 0; i < input.length; i++) {
      this.inputBuffer[this.inputBufferFill++] = input[i];
      if (this.inputBufferFill >= this.grainSize) {
        this.processGrain(pitch);
        this.shiftInputBuffer();
      }
    }
    
    const samplesToOutput = Math.min(output.length, this.outputBufferFill);
    
    // Mix the processed (wet) signal with the dry input.
    // Here we assume input and output arrays have the same length.
    for (let i = 0; i < samplesToOutput; i++) {
      // Use the current dry sample from the input and the processed sample.
      // (1-mix)*dry + mix*wet.
      output[i] = (1 - mix) * input[i] + mix * this.outputBuffer[i];
    }
    
    // Remove the samples we output from the accumulator.
    // Zero out the part that was output.
    for (let i = 0; i < samplesToOutput; i++) {
      this.outputBuffer[i] = 0;
    }
    // Shift the remaining samples in the accumulator.
    for (let i = samplesToOutput; i < this.outputBufferFill; i++) {
      this.outputBuffer[i - samplesToOutput] = this.outputBuffer[i];
    }
    this.outputBufferFill -= samplesToOutput;
    
    // Clear the tail of the output buffer.
    for (let i = this.outputBufferFill; i < this.outputBuffer.length; i++) {
      this.outputBuffer[i] = 0;
    }
    
    // Reset grain counter if it grows too high.
    if (this.grainCounter * this.hopSize > this.outputBuffer.length / 2) {
      this.grainCounter = 0;
    }
    
    return true;
  }
  
  processGrain(pitch) {
    // Process the full inputBuffer into a new grain.
    const processedGrain = new Float32Array(this.grainSize);
    for (let j = 0; j < this.grainSize; j++) {
      // Resample the grain using linear interpolation.
      const readPos = j / pitch;
      const indexInt = Math.floor(readPos);
      const frac = readPos - indexInt;
      const s1 = this.inputBuffer[indexInt] || 0;
      const s2 = this.inputBuffer[(indexInt + 1) % this.grainSize] || 0;
      processedGrain[j] = s1 + (s2 - s1) * frac;
      
      // Apply a Hann window to smooth the grain edges.
      const windowVal = 0.5 * (1 - Math.cos((2 * Math.PI * j) / (this.grainSize - 1)));
      // Multiply by an amplitude boost (here, factor of 2) to help with output level.
      processedGrain[j] *= windowVal;
    }
    
    // Overlap-add the processed grain into the output buffer.
    const offset = this.grainCounter * this.hopSize;
    for (let j = 0; j < this.grainSize; j++) {
      const pos = offset + j;
      if (pos < this.outputBuffer.length) {
        this.outputBuffer[pos] += processedGrain[j];
      }
    }
    const newFill = offset + this.grainSize;
    if (newFill > this.outputBufferFill) {
      this.outputBufferFill = newFill;
    }
    
    this.grainCounter++;
    // // Reset the grain counter periodically to avoid the offset growing indefinitely.
    // if (this.grainCounter * this.hopSize > this.outputBuffer.length / 2) {
    //   this.grainCounter = 0;
    // }
  }
  
  shiftInputBuffer() {
    // Shift the input buffer left by hopSize samples.
    const remaining = this.inputBufferFill - this.hopSize;
    for (let i = 0; i < remaining; i++) {
      this.inputBuffer[i] = this.inputBuffer[i + this.hopSize];
    }
    this.inputBufferFill = remaining > 0 ? remaining : 0;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
