import { describe, expect, it } from "vitest";
import { voiceInputSupported } from "./speech";

const win = (props: Record<string, unknown>, nav: Record<string, unknown> = {}) => ({ ...props, navigator: nav }) as unknown as Window;

describe("voice input support", () => {
  it("is off where the browser has no speech recognition (Firefox)", () => {
    expect(voiceInputSupported(win({}))).toBe(false);
  });
  it("is off in Brave, which exposes the API but blocks the service behind it", () => {
    expect(voiceInputSupported(win({ webkitSpeechRecognition: class {} }, { brave: {} }))).toBe(false);
  });
  it("is on in Chrome and Edge", () => {
    expect(voiceInputSupported(win({ webkitSpeechRecognition: class {} }))).toBe(true);
    expect(voiceInputSupported(win({ SpeechRecognition: class {} }))).toBe(true);
  });
});
