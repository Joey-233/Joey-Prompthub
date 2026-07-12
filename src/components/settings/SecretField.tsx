import { useEffect, useRef, useState } from "react";

export function SecretField({
  label,
  storageKey,
  actionLabel,
  knownConfigured,
  onConfiguredChange,
}: {
  label: string;
  storageKey: string;
  actionLabel: string;
  knownConfigured?: boolean | null;
  onConfiguredChange?: (configured: boolean) => void;
}) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("读取中…");
  const [configured, setConfigured] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const mounted = useRef(false);
  const operation = useRef(0);
  const currentKey = useRef(storageKey);
  currentKey.current = storageKey;

  function publish(nextConfigured: boolean, nextStatus: string) {
    setConfigured(nextConfigured);
    setStatus(nextStatus);
    onConfiguredChange?.(nextConfigured);
  }

  useEffect(() => {
    mounted.current = true;
    if (knownConfigured !== undefined) {
      if (knownConfigured !== null)
        publish(knownConfigured, knownConfigured ? "已加密保存" : "未配置");
      setPending(knownConfigured === null);
      return () => {
        mounted.current = false;
        operation.current += 1;
      };
    }
    const sequence = ++operation.current;
    setPending(true);
    void window.promptHub.secure
      .has(storageKey)
      .then((hasValue) => {
        if (!mounted.current || operation.current !== sequence) return;
        publish(hasValue, hasValue ? "已加密保存" : "未配置");
      })
      .catch(() => {
        if (mounted.current && operation.current === sequence)
          setStatus("读取失败，请重试");
      })
      .finally(() => {
        if (mounted.current && operation.current === sequence)
          setPending(false);
      });
    return () => {
      mounted.current = false;
      operation.current += 1;
    };
  }, [storageKey, knownConfigured]);

  async function run(
    action: () => Promise<void>,
    onSuccess: () => void,
    error: string,
  ) {
    if (pending) return;
    const sequence = ++operation.current;
    setPending(true);
    try {
      await action();
      if (mounted.current && operation.current === sequence) onSuccess();
    } catch {
      if (mounted.current && operation.current === sequence) setStatus(error);
    } finally {
      if (mounted.current && operation.current === sequence) setPending(false);
    }
  }

  function handleSave() {
    const next = value.trim();
    if (!next) return;
    void run(
      () => window.promptHub.secure.set(storageKey, next),
      () => {
        setValue("");
        setRevealed(null);
        publish(true, "✓ 已加密保存到本地");
      },
      "保存失败，请重试",
    );
  }

  function handleClear() {
    void run(
      () => window.promptHub.secure.delete(storageKey),
      () => {
        setValue("");
        setRevealed(null);
        publish(false, "未配置");
      },
      "清除失败，请重试",
    );
  }

  function handleReveal() {
    if (revealed !== null) {
      setRevealed(null);
      return;
    }
    if (pending) return;
    const sequence = ++operation.current;
    const requestedKey = storageKey;
    setPending(true);
    void window.promptHub.secure
      .reveal(requestedKey)
      .then((secret) => {
        if (
          mounted.current &&
          operation.current === sequence &&
          currentKey.current === requestedKey
        )
          setRevealed(secret ?? "");
      })
      .catch(() => {
        if (mounted.current && operation.current === sequence)
          setStatus("读取失败，请重试");
      })
      .finally(() => {
        if (mounted.current && operation.current === sequence)
          setPending(false);
      });
  }

  return (
    <div className="secret-field">
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          aria-label={label}
          className="field-input"
          placeholder="sk-..."
          type="password"
          value={value}
          disabled={pending}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <div className="secret-actions">
        <span
          className="secret-status"
          data-state={configured ? "set" : "unset"}
        >
          {status}
        </span>
        <div className="secret-controls">
          {configured && (
            <>
              <button
                className="editor-action"
                type="button"
                disabled={pending}
                onClick={handleReveal}
              >
                {revealed === null ? "显示" : "隐藏"}
              </button>
              <button
                className="editor-action editor-action-danger"
                type="button"
                disabled={pending}
                onClick={handleClear}
              >
                清除
              </button>
            </>
          )}
          <button
            className="editor-action"
            type="button"
            disabled={pending}
            onClick={handleSave}
          >
            {actionLabel}
          </button>
        </div>
      </div>
      {revealed !== null && (
        <output className="secret-reveal" aria-label={`${label} 当前值`}>
          {revealed || "空"}
        </output>
      )}
    </div>
  );
}
