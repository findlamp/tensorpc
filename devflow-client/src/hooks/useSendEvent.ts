import { useCallback, useContext } from "react";
import { TensorPcContext } from "../context/TensorPcContext";
import { LayoutContext } from "../context/LayoutContext";

export function useSendEvent() {
  const { sendUiEvent } = useContext(TensorPcContext);
  const { graphId, nodeId } = useContext(LayoutContext);

  return useCallback(
    (compUid: string, eventType: number, data: unknown) => {
      if (graphId && nodeId) {
        sendUiEvent(graphId, nodeId, compUid, eventType, data);
      } else {
        console.warn("useSendEvent: no graph/node context");
      }
    },
    [sendUiEvent, graphId, nodeId],
  );
}

/** Simpler hook for components that just need onClick events */
export function useSendClick(compUid: string) {
  const sendEvent = useSendEvent();
  return useCallback(() => {
    sendEvent(compUid, 0 /* Click */, {});
  }, [sendEvent, compUid]);
}

/** Hook for onChange-style events */
export function useSendChange(compUid: string) {
  const sendEvent = useSendEvent();
  return useCallback(
    (value: unknown) => {
      sendEvent(compUid, 20 /* Change */, value);
    },
    [sendEvent, compUid],
  );
}
