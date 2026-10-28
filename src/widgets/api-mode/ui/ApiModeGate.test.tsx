import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiModeGate } from "./ApiModeGate";
import type { RuntimeConfig } from "@/src/shared/config/runtime-config";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a> }));

const config: RuntimeConfig = { mode: "api", apiBaseUrl: "https://api.example.test" };

afterEach(() => vi.unstubAllGlobals());

describe("API mode connection gate", () => {
  it("stays in API mode on network failure and retries the configured endpoints", async () => {
    let offline = true;
    const requestedUrls: string[] = [];
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input));
      if (offline) throw new TypeError("Offline");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<ApiModeGate config={config} screen="create"><p>Форма API</p></ApiModeGate>);

    expect(await screen.findByText("Нет соединения с сервером")).toBeInTheDocument();
    expect(screen.getByText("Форма API")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(requestedUrls).toEqual(["https://api.example.test/api/health"]);

    offline = false;
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Сервер доступен"));
    expect(screen.getByText("Форма API")).toBeInTheDocument();
  });
});
