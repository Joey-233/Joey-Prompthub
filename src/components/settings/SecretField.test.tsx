import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { SecretField } from "./SecretField";

it("groups secret actions separately from the non-wrapping status", async () => {
  window.promptHub.secure.has = vi.fn().mockResolvedValue(false);
  const { container } = render(
    <SecretField label="API Key" storageKey="ai.apiKey" actionLabel="保存" />,
  );

  await waitFor(() => expect(screen.getByLabelText("API Key")).toBeEnabled());
  expect(container.querySelector(".secret-status")).toBeTruthy();
  expect(container.querySelector(".secret-action-controls")).toContainElement(
    screen.getByRole("button", { name: "保存" }),
  );
});

it("serializes save and clear operations", async () => {
  const user = userEvent.setup();
  let finishSave!: () => void;
  window.promptHub.secure.has = vi.fn().mockResolvedValue(false);
  window.promptHub.secure.set = vi.fn().mockReturnValue(
    new Promise<void>((resolve) => {
      finishSave = resolve;
    }),
  );
  window.promptHub.secure.delete = vi.fn().mockResolvedValue(undefined);
  render(
    <SecretField label="API Key" storageKey="ai.apiKey" actionLabel="保存" />,
  );
  await waitFor(() => expect(screen.getByLabelText("API Key")).toBeEnabled());
  await user.type(screen.getByLabelText("API Key"), "secret");
  const save = screen.getByRole("button", { name: "保存" });
  await user.click(save);
  expect(save).toBeDisabled();
  expect(screen.getByLabelText("API Key")).toBeDisabled();
  await act(async () => finishSave());
  expect(await screen.findByRole("button", { name: "清除" })).toBeEnabled();
});

it("does not publish a stale initial has result after unmount", async () => {
  let finishHas!: (value: boolean) => void;
  window.promptHub.secure.has = vi.fn().mockReturnValue(
    new Promise((resolve) => {
      finishHas = resolve;
    }),
  );
  const onConfiguredChange = vi.fn();
  const view = render(
    <SecretField
      label="API Key"
      storageKey="ai.apiKey"
      actionLabel="保存"
      onConfiguredChange={onConfiguredChange}
    />,
  );
  expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  view.unmount();
  await act(async () => finishHas(true));
  expect(onConfiguredChange).not.toHaveBeenCalled();
});

it("does not reveal a secret returned for an old storage key", async () => {
  const user = userEvent.setup();
  let finishReveal!: (value: string) => void;
  window.promptHub.secure.has = vi.fn().mockResolvedValue(true);
  window.promptHub.secure.reveal = vi.fn().mockReturnValue(
    new Promise((resolve) => {
      finishReveal = resolve;
    }),
  );
  const view = render(
    <SecretField label="Key" storageKey="old.key" actionLabel="保存" />,
  );
  await user.click(await screen.findByRole("button", { name: "显示" }));
  view.rerender(
    <SecretField label="Key" storageKey="new.key" actionLabel="保存" />,
  );
  await act(async () => finishReveal("old-secret"));
  expect(screen.queryByText("old-secret")).not.toBeInTheDocument();
});
