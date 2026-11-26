export {
  type MessageSender,
  type SendOtpMessageInput,
  ConsoleMessageSender,
  getMessageSender,
} from "./shell/messaging.service.js"
export {
  CaptureMessageSender,
  type CapturedMessage,
} from "./shell/capture-message-sender.js"
export { getCaptureOutbox } from "./shell/messaging.service.js"
