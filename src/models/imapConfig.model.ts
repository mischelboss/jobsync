// Client-safe view of an ImapConfig row. Never exposes the encrypted password
// or iv — the host/port/username/useTls are enough to render the settings form.
export interface ImapConfigResponse {
  id: string;
  host: string;
  port: number;
  username: string;
  useTls: boolean;
  createdAt: Date;
  updatedAt: Date;
}
