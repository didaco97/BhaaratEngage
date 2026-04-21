const MULAW_BIAS = 0x84;

function decodeMulawSample(sample: number) {
  const muLaw = ~sample & 0xff;
  const sign = muLaw & 0x80;
  const exponent = (muLaw >> 4) & 0x07;
  const mantissa = muLaw & 0x0f;
  let pcm = ((mantissa << 3) + MULAW_BIAS) << exponent;
  pcm -= MULAW_BIAS;

  return sign ? -pcm : pcm;
}

export function decodeMulawToPcm16Le(payload: Buffer) {
  const output = Buffer.allocUnsafe(payload.length * 2);

  for (let index = 0; index < payload.length; index += 1) {
    const pcm = decodeMulawSample(payload[index] ?? 0);
    output.writeInt16LE(pcm, index * 2);
  }

  return output;
}
