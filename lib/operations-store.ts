// Compatibility entry point: callers and persisted contracts retain their imports.
export { snapshot } from './database/operations-repository';
export { mutateOperation } from './operations/operations-service';
export { processOperations } from './operations/process-operations';
