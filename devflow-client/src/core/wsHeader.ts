import protobuf from "protobufjs";
import Long from "long";

protobuf.util.Long = Long;
protobuf.configure();

/** Matches tensorpc/protos/wsdef.proto */
export const WsHeader = new protobuf.Type("Header")
  .add(new protobuf.Field("service_id", 1, "fixed32"))
  .add(new protobuf.Field("chunk_index", 2, "fixed32"))
  .add(new protobuf.Field("rpc_id", 3, "fixed64"))
  .add(new protobuf.Field("data", 4, "string"))
  .add(new protobuf.Field("service_key", 5, "string"))
  .add(new protobuf.Field("dynamic_key", 6, "string"));

export type WsHeaderCtor = {
  service_id?: number;
  chunk_index?: number;
  rpc_id?: number | Long;
  data?: string;
  service_key?: string;
  dynamic_key?: string;
};

export function encodeHeader(h: WsHeaderCtor): Uint8Array {
  const err = WsHeader.verify(h);
  if (err) {
    throw new Error(err);
  }
  return WsHeader.encode(h).finish();
}

export function decodeHeader(buf: Uint8Array): protobuf.Message {
  return WsHeader.decode(buf);
}

export function readHeaderMessage(full: Uint8Array): {
  type: number;
  headerLen: number;
  headerBytes: Uint8Array;
  rest: Uint8Array;
} {
  if (full.byteLength < 5) {
    throw new Error("frame too short");
  }
  const type = full[0]!;
  const headerLen = new DataView(
    full.buffer,
    full.byteOffset + 1,
    4,
  ).getInt32(0, true);
  const totalHeader = 5 + headerLen;
  if (full.byteLength < totalHeader) {
    throw new Error("truncated header");
  }
  const headerBytes = full.subarray(5, totalHeader);
  const rest = full.subarray(totalHeader);
  return { type, headerLen, headerBytes, rest };
}
