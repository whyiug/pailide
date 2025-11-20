export interface Position {
  x: number;
  y: number;
}

export interface PhotoData {
  id: string;
  imageData: string; // Base64 data URL
  caption: string;
  dateString: string;
  timestamp: number;
  isDeveloping: boolean;
  isStaged: boolean; // True if still in the camera slot
  position: Position; // Screen coordinates
  rotation: number; // Random rotation for natural look
}

export enum AppStatus {
  IDLE = 'IDLE',
  CAMERA_READY = 'CAMERA_READY',
  TAKING_PHOTO = 'TAKING_PHOTO',
  ERROR = 'ERROR'
}