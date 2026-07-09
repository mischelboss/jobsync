"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { toast } from "../ui/use-toast";
import { Loader2, CheckCircle, XCircle, Trash2, Plug } from "lucide-react";
import {
  getImapConfig,
  upsertImapConfig,
  deleteImapConfig,
  testImapConfig,
} from "@/actions/imapConfig.actions";

interface FormState {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
}

const EMPTY: FormState = {
  host: "",
  port: 993,
  username: "",
  password: "",
  useTls: true,
};

function ImapSettings() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [configured, setConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await getImapConfig();
      if (result.success && result.data) {
        setForm({
          host: result.data.host,
          port: result.data.port,
          username: result.data.username,
          password: "",
          useTls: result.data.useTls,
        });
        setConfigured(true);
      }
      setIsLoading(false);
    })();
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSubmit =
    form.host.trim().length > 0 &&
    form.username.trim().length > 0 &&
    (configured || form.password.length > 0);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await upsertImapConfig({
      host: form.host.trim(),
      port: form.port,
      username: form.username.trim(),
      useTls: form.useTls,
      password: form.password || undefined,
    });
    setIsSaving(false);
    if (result.success) {
      setConfigured(true);
      setForm((f) => ({ ...f, password: "" }));
      toast({ title: "Mailbox saved" });
    } else {
      toast({
        title: "Error",
        description: result.message || "Failed to save mailbox",
        variant: "destructive",
      });
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    const result = await testImapConfig({
      host: form.host.trim(),
      port: form.port,
      username: form.username.trim(),
      useTls: form.useTls,
      password: form.password || undefined,
    });
    setIsTesting(false);
    if (result.success) {
      toast({
        title: "Connection successful",
        description: "JobSync could sign in to the mailbox.",
      });
    } else {
      toast({
        title: "Connection failed",
        description: result.message || "Could not connect",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const result = await deleteImapConfig();
    setIsDeleting(false);
    if (result.success) {
      setForm(EMPTY);
      setConfigured(false);
      toast({ title: "Mailbox removed" });
    } else {
      toast({
        title: "Error",
        description: result.message || "Failed to remove mailbox",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          Email Mailbox (IMAP)
        </CardTitle>
        <CardDescription>
          Connect one IMAP mailbox so email-alert automations can read job-alert
          emails. For Gmail/Outlook with 2FA, generate an app password — your
          normal login password will not work. The password is encrypted at rest.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="imap-host">Host</Label>
            <Input
              id="imap-host"
              placeholder="imap.gmail.com"
              value={form.host}
              onChange={(e) => update("host", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imap-port">Port</Label>
            <Input
              id="imap-port"
              type="number"
              value={form.port}
              onChange={(e) => update("port", parseInt(e.target.value) || 993)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="imap-username">Username</Label>
          <Input
            id="imap-username"
            placeholder="you@gmail.com"
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="imap-password">
            {configured ? "App password (leave blank to keep current)" : "App password"}
          </Label>
          <Input
            id="imap-password"
            type="password"
            placeholder={configured ? "••••••••" : "App password"}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label>Use TLS/SSL</Label>
            <p className="text-sm text-muted-foreground">
              Recommended. Port 993 for most providers.
            </p>
          </div>
          <Switch
            checked={form.useTls}
            onCheckedChange={(checked) => update("useTls", checked)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button onClick={handleSave} disabled={!canSubmit || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!canSubmit || isTesting}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plug className="h-4 w-4 mr-2" />
            )}
            Test connection
          </Button>
          {configured && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Remove
            </Button>
          )}
          {configured && (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Mailbox configured
            </span>
          )}
          {!configured && (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Not configured
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ImapSettings;
