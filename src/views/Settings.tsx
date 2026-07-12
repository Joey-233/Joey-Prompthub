import { useEffect, useMemo, useRef, useState } from "react";

import { WorkspaceLayout } from "../components/layout/WorkspaceLayout";
import { ImportExportPanel } from "../components/settings/ImportExportPanel";
import { ProviderSelect } from "../components/settings/ProviderSelect";
import { SecretField } from "../components/settings/SecretField";
import {
  SettingsNav,
  type SettingsCategory,
} from "../components/settings/SettingsNav";
import { SettingsSection } from "../components/settings/SettingsSection";
import {
  AI_PRESETS,
  IMAGE_PRESETS,
  findAiPreset,
  findImagePreset,
} from "../services/ai/presets";

type SettingsMap = Record<string, unknown>;
type SaveState = {
  state: "idle" | "saving" | "saved" | "error";
  value?: unknown;
};

const defaults: SettingsMap = {
  ai_preset: "openai",
  ai_base_url: "https://api.openai.com/v1",
  ai_model: "gpt-4.1-mini",
  vision_preset: "follow",
  vision_base_url: "",
  vision_model: "",
  image_preset: "openai-image",
  image_base_url: "https://api.openai.com/v1",
  image_model: "gpt-image-1",
  theme_mode: "system",
  launch_at_login: false,
};
const sectionKeys: Record<SettingsCategory, string[]> = {
  ai: ["ai_preset", "ai_base_url", "ai_model"],
  vision: ["vision_preset", "vision_base_url", "vision_model"],
  image: ["image_preset", "image_base_url", "image_model"],
  data: ["theme_mode", "launch_at_login"],
};
const descriptions: Record<SettingsCategory, string> = {
  ai: "配置文本生成与提示词优化使用的服务。",
  vision: "配置快速录入时的图片理解模型，可跟随 AI 服务。",
  image: "配置测试台使用的图像生成服务。",
  data: "管理本地数据、主题与桌面应用行为。",
};

export function Settings() {
  const [active, setActive] = useState<SettingsCategory>("ai");
  const [settings, setSettings] = useState<SettingsMap>(defaults);
  const [statuses, setStatuses] = useState<Record<string, SaveState>>({});
  const [aiKeyConfigured, setAiKeyConfigured] = useState<boolean | null>(null);
  const [visionKeyConfigured, setVisionKeyConfigured] = useState<boolean | null>(null);
  const [checkResult, setCheckResult] = useState<{
    fingerprint: string;
    message: string;
  } | null>(null);
  const edited = useRef(new Set<string>());
  const versions = useRef<Record<string, number>>({});
  const queues = useRef<Record<string, Promise<void>>>({});

  useEffect(() => {
    let mounted = true;
    void window.promptHub.settings
      .list()
      .then((loaded) => {
        if (!mounted) return;
        setSettings((current) => {
          const safe = Object.fromEntries(
            Object.entries(loaded).filter(([key]) => !edited.current.has(key)),
          );
          return { ...current, ...safe };
        });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const request = async (
      key: string,
      update: (configured: boolean | null) => void,
    ) => {
      try {
        const configured = await window.promptHub.secure.has(key);
        if (mounted) update(configured);
      } catch {
        if (mounted) update(false);
      }
    };
    void request("ai.apiKey", setAiKeyConfigured);
    void request("vision.apiKey", setVisionKeyConfigured);
    return () => {
      mounted = false;
    };
  }, []);

  async function persist(key: string, value: unknown) {
    edited.current.add(key);
    setSettings((current) => ({ ...current, [key]: value }));
    const version = (versions.current[key] ?? 0) + 1;
    versions.current[key] = version;
    setStatuses((current) => ({
      ...current,
      [key]: { state: "saving", value },
    }));
    const write = (queues.current[key] ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => window.promptHub.settings.set(key, value));
    queues.current[key] = write;
    try {
      await write;
      if (versions.current[key] === version)
        setStatuses((current) => ({
          ...current,
          [key]: { state: "saved", value },
        }));
    } catch {
      if (versions.current[key] === version)
        setStatuses((current) => ({
          ...current,
          [key]: { state: "error", value },
        }));
    }
  }

  async function persistLaunchAtLogin(value: boolean) {
    const key = "launch_at_login";
    edited.current.add(key);
    setSettings((current) => ({ ...current, [key]: value }));
    const version = (versions.current[key] ?? 0) + 1;
    versions.current[key] = version;
    setStatuses((current) => ({
      ...current,
      [key]: { state: "saving", value },
    }));
    const write = (queues.current[key] ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const results = await Promise.allSettled([
          window.promptHub.settings.set(key, value),
          window.promptHub.system.setLaunchAtLogin(value),
        ]);
        const failures = results.filter(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        if (failures.length)
          throw new AggregateError(
            failures.map((failure) => failure.reason),
            "Failed to persist launch-at-login setting",
          );
      });
    queues.current[key] = write;
    try {
      await write;
      if (versions.current[key] === version)
        setStatuses((current) => ({
          ...current,
          [key]: { state: "saved", value },
        }));
    } catch {
      if (versions.current[key] === version)
        setStatuses((current) => ({
          ...current,
          [key]: { state: "error", value },
        }));
    }
  }

  function setMany(values: SettingsMap) {
    setSettings((current) => ({ ...current, ...values }));
    for (const [key, value] of Object.entries(values)) void persist(key, value);
  }

  function handleAiPreset(id: string) {
    const preset = findAiPreset(id);
    const values: SettingsMap = { ai_preset: id };
    if (!preset.baseUrlEditable) values.ai_base_url = preset.baseURL;
    if (preset.defaultModel) values.ai_model = preset.defaultModel;
    setMany(values);
  }

  function handleVisionPreset(id: string) {
    const preset = id === "follow" ? null : findAiPreset(id);
    const values: SettingsMap = { vision_preset: id };
    if (preset && !preset.baseUrlEditable)
      values.vision_base_url = preset.baseURL;
    if (preset?.suggestedVisionModels?.[0])
      values.vision_model = preset.suggestedVisionModels[0];
    setMany(values);
  }

  function handleImagePreset(id: string) {
    const preset = findImagePreset(id);
    const values: SettingsMap = { image_preset: id };
    if (preset.baseURL && !preset.baseUrlEditable)
      values.image_base_url = preset.baseURL;
    if (preset.defaultModel) values.image_model = preset.defaultModel;
    setMany(values);
  }

  const aiPreset = useMemo(
    () => findAiPreset(String(settings.ai_preset)),
    [settings.ai_preset],
  );
  const visionId = String(settings.vision_preset);
  const visionPreset = visionId === "follow" ? null : findAiPreset(visionId);
  const imagePreset = useMemo(
    () => findImagePreset(String(settings.image_preset)),
    [settings.image_preset],
  );
  const activeStates = sectionKeys[active]
    .map((key) => statuses[key])
    .filter(Boolean);
  const sectionState = activeStates.some((item) => item.state === "error")
    ? "error"
    : activeStates.some((item) => item.state === "saving")
      ? "saving"
      : activeStates.some((item) => item.state === "saved")
        ? "saved"
        : "idle";
  const failed = sectionKeys[active]
    .map((key) => [key, statuses[key]] as const)
    .find(([, value]) => value?.state === "error");

  function missingFields() {
    if (active === "ai")
      return [
        !String(settings.ai_base_url).trim() && "Base URL",
        !String(settings.ai_model).trim() && "模型",
        !aiKeyConfigured && "API Key",
      ].filter(Boolean);
    if (active === "vision" && visionId === "follow")
      return [
        !String(settings.ai_base_url).trim() && "AI Base URL",
        !(
          String(settings.vision_model).trim() ||
          String(settings.ai_model).trim()
        ) && "AI 模型",
        !aiKeyConfigured && "AI API Key",
      ].filter(Boolean);
    if (active === "vision")
      return [
        !String(settings.vision_model).trim() && "视觉模型",
        !String(settings.vision_base_url).trim() && "Base URL",
        !visionKeyConfigured && !aiKeyConfigured && "API Key",
      ].filter(Boolean);
    if (active === "image" && imagePreset.kind === "openai")
      return [
        !String(settings.image_base_url).trim() && "Base URL",
        !String(settings.image_model).trim() && "模型",
        !aiKeyConfigured && "API Key",
      ].filter(Boolean);
    if (active === "image" && imagePreset.kind === "sd-webui")
      return [
        !String(settings.image_base_url).trim() && "SD WebUI 地址",
      ].filter(Boolean);
    return [];
  }

  const fingerprint = JSON.stringify([
    active,
    ...sectionKeys[active].map((key) => settings[key]),
    aiKeyConfigured,
    visionKeyConfigured,
    active === "vision" && visionId === "follow" ? settings.ai_base_url : null,
    active === "vision" && visionId === "follow" ? settings.ai_model : null,
  ]);
  const retryFailed = () =>
    failed &&
    void (failed[0] === "launch_at_login"
      ? persistLaunchAtLogin(Boolean(failed[1].value))
      : persist(failed[0], failed[1].value));
  const statusNode = failed ? (
    <button type="button" className="settings-retry" onClick={retryFailed}>
      保存失败，点击重试
    </button>
  ) : (
    <span>
      {sectionState === "saving"
        ? "保存中…"
        : sectionState === "saved"
          ? "已保存"
          : "尚未修改"}
    </span>
  );
  const details = (
    <div className="settings-detail">
      <h2>
        {active === "ai"
          ? "AI 服务"
          : active === "vision"
            ? "视觉模型"
            : active === "image"
              ? "图像生成"
              : "数据与应用"}
      </h2>
      <p>{descriptions[active]}</p>
      <div className="settings-save-summary">保存状态：{statusNode}</div>
      {active !== "data" && (
        <>
          <button
            type="button"
            className="editor-action"
            onClick={() => {
              const missing = missingFields();
              setCheckResult({
                fingerprint,
                message: missing.length
                  ? `缺少：${missing.join("、")}`
                  : "配置完整",
              });
            }}
          >
            检查配置
          </button>
          {checkResult?.fingerprint === fingerprint && (
            <p role="status">{checkResult.message}</p>
          )}
        </>
      )}
    </div>
  );

  let main;
  if (active === "ai")
    main = (
      <SettingsSection
        title="AI 服务"
        description="OpenAI 兼容服务的常用配置。"
        status={statusNode}
      >
        <ProviderSelect
          label="服务商预设"
          value={String(settings.ai_preset)}
          options={AI_PRESETS.map(({ id, label }) => ({ id, label }))}
          onChange={handleAiPreset}
        />
        <SecretField
          label="API Key"
          storageKey="ai.apiKey"
          actionLabel="保存 API Key"
          knownConfigured={aiKeyConfigured}
          onConfiguredChange={setAiKeyConfigured}
        />
        <details className="settings-advanced">
          <summary>高级设置</summary>
          <label className="field">
            <span className="field-label">API Base URL</span>
            <input
              className="field-input"
              disabled={!aiPreset.baseUrlEditable && Boolean(aiPreset.baseURL)}
              value={String(settings.ai_base_url)}
              onChange={(event) =>
                void persist("ai_base_url", event.target.value)
              }
            />
          </label>
          <label className="field">
            <span className="field-label">默认模型</span>
            <input
              className="field-input"
              list="ai-model-suggestions"
              value={String(settings.ai_model)}
              onChange={(event) => void persist("ai_model", event.target.value)}
            />
            <datalist id="ai-model-suggestions">
              {aiPreset.suggestedModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </label>
        </details>
      </SettingsSection>
    );
  else if (active === "vision")
    main = (
      <SettingsSection
        title="视觉模型"
        description="跟随 AI 服务或使用独立视觉服务。"
        status={statusNode}
      >
        <ProviderSelect
          label="识图服务来源"
          value={visionId}
          options={[
            { id: "follow", label: "跟随 AI 服务" },
            ...AI_PRESETS.map(({ id, label }) => ({ id, label })),
          ]}
          onChange={handleVisionPreset}
        />
        <label className="field">
          <span className="field-label">识图模型</span>
          <input
            className="field-input"
            value={String(settings.vision_model)}
            onChange={(event) =>
              void persist("vision_model", event.target.value)
            }
          />
        </label>
        {visionPreset && (
          <>
            <details className="settings-advanced">
              <summary>高级设置</summary>
              <label className="field">
                <span className="field-label">识图 API Base URL</span>
                <input
                  className="field-input"
                  disabled={
                    !visionPreset.baseUrlEditable &&
                    Boolean(visionPreset.baseURL)
                  }
                  value={String(settings.vision_base_url)}
                  onChange={(event) =>
                    void persist("vision_base_url", event.target.value)
                  }
                />
              </label>
            </details>
              <SecretField
              label="识图 API Key（可留空）"
              storageKey="vision.apiKey"
                actionLabel="保存识图 Key"
                knownConfigured={visionKeyConfigured}
              onConfiguredChange={setVisionKeyConfigured}
            />
          </>
        )}
      </SettingsSection>
    );
  else if (active === "image")
    main = (
      <SettingsSection
        title="图像生成"
        description="测试台使用的图像服务。"
        status={statusNode}
      >
        <ProviderSelect
          label="服务商预设"
          value={String(settings.image_preset)}
          options={IMAGE_PRESETS.map(({ id, label }) => ({ id, label }))}
          onChange={handleImagePreset}
        />
        {imagePreset.kind !== "mock" && (
          <details className="settings-advanced">
            <summary>高级设置</summary>
            <label className="field">
              <span className="field-label">
                {imagePreset.kind === "sd-webui"
                  ? "SD WebUI 地址"
                  : "API Base URL"}
              </span>
              <input
                className="field-input"
                disabled={
                  imagePreset.kind === "openai" &&
                  !imagePreset.baseUrlEditable &&
                  Boolean(imagePreset.baseURL)
                }
                value={String(settings.image_base_url)}
                onChange={(event) =>
                  void persist("image_base_url", event.target.value)
                }
              />
            </label>
            {imagePreset.kind === "openai" && (
              <label className="field">
                <span className="field-label">图像模型</span>
                <input
                  className="field-input"
                  value={String(settings.image_model)}
                  onChange={(event) =>
                    void persist("image_model", event.target.value)
                  }
                />
              </label>
            )}
          </details>
        )}
      </SettingsSection>
    );
  else
    main = (
      <SettingsSection
        title="数据与应用"
        description="备份以及桌面偏好。"
        status={statusNode}
      >
        <ImportExportPanel />
        <ProviderSelect
          label="主题模式"
          value={String(settings.theme_mode)}
          options={[
            { id: "light", label: "亮色" },
            { id: "dark", label: "暗色" },
            { id: "system", label: "跟随系统" },
          ]}
          onChange={(value) => void persist("theme_mode", value)}
        />
        <label className="settings-toggle">
          <input
            checked={Boolean(settings.launch_at_login)}
            type="checkbox"
            onChange={(event) =>
              void persistLaunchAtLogin(event.target.checked)
            }
          />
          <span>开机自启</span>
        </label>
      </SettingsSection>
    );

  return (
    <WorkspaceLayout
      resource={
        <SettingsNav
          active={active}
          onSelect={(category) => {
            setActive(category);
            setCheckResult(null);
          }}
        />
      }
      resourceLabel="设置分类"
      main={
        <div className="settings-layout" role="region" aria-label="设置内容">
          {main}
        </div>
      }
      detail={details}
      detailLabel="配置状态与帮助"
    />
  );
}
