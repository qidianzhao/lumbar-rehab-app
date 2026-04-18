// API 层入口：转发到 services/trainingApi
export {
  getSessionHistory,
  getSessionReport,
  createSession,
  submitRecord,
  finishSession,
  type SessionHistoryItem,
  type SessionHistoryData,
  type SessionFinishData,
  type SessionFinishActionDetail,
  type SessionStartData,
  type SessionStartAction,
  type SessionCreateBody,
  type RecordSubmitBody,
} from '@/src/services/trainingApi';
