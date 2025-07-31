export interface LetterboxHandler {
  (message: any): Promise<any>;
  initializeQueue?: () => Promise<void>;
  shutdownQueue?: () => Promise<void>;
}
