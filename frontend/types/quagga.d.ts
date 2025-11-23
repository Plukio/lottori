declare module "quagga" {
  export interface QuaggaJSResultObject {
    codeResult?: {
      code?: string | null;
      format?: string | null;
    };
  }

  export interface QuaggaJSConfig {
    inputStream: {
      type: "LiveStream";
      target: Element | string;
      constraints?: MediaTrackConstraints;
    };
    decoder: {
      readers: string[];
    };
    locate?: boolean;
  }

  export type QuaggaJSResultCallback = (
    result: QuaggaJSResultObject
  ) => void;

  const Quagga: {
    init(config: QuaggaJSConfig, callback: (err: Error | null) => void): void;
    start(): void;
    stop(): void;
    onDetected(callback: QuaggaJSResultCallback): void;
    offDetected(callback: QuaggaJSResultCallback): void;
  };

  export default Quagga;
}

