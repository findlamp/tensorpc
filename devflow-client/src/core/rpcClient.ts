import protobuf from "protobufjs";

// Reuse the same protobuf root that has Long configured
const RpcRoot = new protobuf.Root();

// Mirrors tensorpc/protos/arraybuf.proto. Field numbers matter: HTTP RPC
// query_app_state returns large component props such as mui.Image bytes here.
const DType = new protobuf.Type("dtype")
  .add(new protobuf.Field("type", 1, "int32"))
  .add(new protobuf.Field("byte_order", 2, "int32"));
RpcRoot.add(DType);

const NdArray = new protobuf.Type("ndarray")
  .add(new protobuf.Field("shape", 1, "int64", "repeated"))
  .add(new protobuf.Field("dtype", 2, "dtype"))
  .add(new protobuf.Field("data", 3, "bytes"));
RpcRoot.add(NdArray);

/** Matches tensorpc/protos/rpc_message.proto RemoteJsonCallRequest */
export const RemoteJsonCallRequest = new protobuf.Type("RemoteJsonCallRequest")
  .add(new protobuf.Field("arrays", 1, "ndarray", "repeated"))
  .add(new protobuf.Field("flags", 2, "int64"))
  .add(new protobuf.Field("data", 3, "string"))
  .add(new protobuf.Field("service_key", 4, "string"))
  .add(new protobuf.Field("callback", 5, "string"));
RpcRoot.add(RemoteJsonCallRequest);

/** Matches tensorpc/protos/rpc_message.proto RemoteJsonCallReply */
export const RemoteJsonCallReply = new protobuf.Type("RemoteJsonCallReply")
  .add(new protobuf.Field("arrays", 1, "ndarray", "repeated"))
  .add(new protobuf.Field("data", 2, "string"))
  .add(new protobuf.Field("flags", 3, "int64"))
  .add(new protobuf.Field("exception", 4, "string"));
RpcRoot.add(RemoteJsonCallReply);

export type RpcRequest = {
  service_key: string;
  data: string;
  flags?: number;
  callback?: string;
  arrays?: Array<{ data: Uint8Array; dtype: string; shape: number[] }>;
};

export type RpcReply = {
  exception?: string;
  data?: string;
  flags?: number;
  arrays?: Array<{
    data: Uint8Array;
    dtype?: { type?: number; byte_order?: number };
    shape: unknown[];
  }>;
};

export function encodeRpcRequest(req: RpcRequest): Uint8Array {
  const msg: Record<string, unknown> = {
    service_key: req.service_key,
    data: req.data,
    flags: req.flags ?? 0,
    callback: req.callback ?? "",
    arrays: (req.arrays ?? []).map((a) => ({
      data: a.data,
      dtype: { type: 12, byte_order: 3 },
      shape: a.shape,
    })),
  };
  const err = RemoteJsonCallRequest.verify(msg);
  if (err) throw new Error(`RPC request validation: ${err}`);
  return RemoteJsonCallRequest.encode(
    RemoteJsonCallRequest.create(msg),
  ).finish();
}

export function decodeRpcReply(buf: Uint8Array): RpcReply {
  const decoded = RemoteJsonCallReply.decode(buf) as unknown as {
    exception?: string;
    data?: string;
    flags?: number;
    arrays?: Array<{
      data: Uint8Array;
      dtype?: { type?: number; byte_order?: number };
      shape: unknown[];
    }>;
  };
  return {
    exception: decoded.exception || undefined,
    data: decoded.data || undefined,
    flags: decoded.flags ?? undefined,
    arrays: decoded.arrays ?? undefined,
  };
}
