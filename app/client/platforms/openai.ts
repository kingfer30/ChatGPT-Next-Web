import {
  ApiPath,
  DEFAULT_API_HOST,
  DEFAULT_MODELS,
  OpenaiPath,
  REQUEST_TIMEOUT_MS,
  ServiceProvider,
} from "@/app/constant";
import { useAccessStore, useAppConfig, useChatStore } from "@/app/store";

import { ChatOptions, getHeaders, LLMApi, LLMModel, LLMUsage } from "../api";
import Locale from "../../locales";
import {
  EventStreamContentType,
  fetchEventSource,
} from "@fortaine/fetch-event-source";
import { prettyObject } from "@/app/utils/format";
import { getClientConfig } from "@/app/config/client";
import { makeAzurePath } from "@/app/azure";

export interface OpenAIListModelResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    root: string;
  }>;
}

export class ChatGPTApi implements LLMApi {
  private disableListModels = true;

  path(path: string): string {
    const accessStore = useAccessStore.getState();

    const isAzure = accessStore.provider === ServiceProvider.Azure;

    if (isAzure && !accessStore.isValidAzure()) {
      throw Error(
        "incomplete azure config, please check it in your settings page",
      );
    }

    let baseUrl = isAzure ? accessStore.azureUrl : accessStore.openaiUrl;

    if (baseUrl.length === 0) {
      const isApp = !!getClientConfig()?.isApp;
      baseUrl = isApp ? DEFAULT_API_HOST : ApiPath.OpenAI;
    }

    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }
    if (!baseUrl.startsWith("http") && !baseUrl.startsWith(ApiPath.OpenAI)) {
      baseUrl = "https://" + baseUrl;
    }

    if (isAzure) {
      path = makeAzurePath(path, accessStore.azureApiVersion);
    }

    return [baseUrl, path].join("/");
  }

  extractMessage(res: any, model = "") {
    if (model.indexOf("dall-e") >= 0 && !!res.data) {
      if (res.data.length == 0) {
        return "";
      }
      let h = "";
      for (let i = 0; i < res.data.length; i++) {
        const d = res.data[i];
        //[![使用说明](/navigation.png)](/navigation.png)
        h +=
          (d.revised_prompt || "") +
          "\n\n[![Image_" +
          (i + 1) +
          "](" +
          d.url +
          ")](" +
          d.url +
          ") \n\n";
      }
      return h;
    }
    return res.choices?.at(0)?.message?.content ?? "";
  }

  async chat(options: ChatOptions) {
    const modelConfig = {
      ...useAppConfig.getState().modelConfig,
      ...useChatStore.getState().currentSession().mask.modelConfig,
      ...{
        model: options.config.model,
      },
    };

    let requestPayload;
    const isO1 = options.config.model.startsWith("o1-");
    if (modelConfig.model.indexOf("dall-e") >= 0) {
      let prompt_msg = options.messages[options.messages.length - 1].content;
      requestPayload = {
        prompt: prompt_msg,
        model: modelConfig.model,
        quality: modelConfig.dalle3_quality,
        size:
          modelConfig.model.indexOf("dall-e-3") >= 0
            ? modelConfig.dalle3_size
            : modelConfig.dalle2_size,
        n:
          modelConfig.model.indexOf("dall-e-3") >= 0
            ? 1
            : modelConfig.dalle2_num,
      };
    } else if (
      modelConfig.model.indexOf("gpt-4-vision") >= 0 ||
      modelConfig.model.indexOf("gpt-4o") >= 0 ||
      modelConfig.model.indexOf("claude-3") >= 0
    ) {
      let messages;
      messages = options.messages.map((v) => {
        let m: { role: string; content: string | {} } = {
          role: v.role,
          content: v.content,
        };
        if (v.ImageContent != undefined && v.ImageContent.length > 0) {
          let imgContent = [];
          imgContent.push({
            type: "text",
            text: v.content,
          });
          for (let i = 0; i < v.ImageContent.length; i++) {
            const d = v.ImageContent[i];
            imgContent.push({
              type: "image_url",
              image_url: {
                url: d,
                detail: modelConfig.vision_mode,
              },
            });
          }
          m = {
            role: v.role,
            content: imgContent,
          };
        }
        return m;
      });
      requestPayload = {
        messages,
        stream: options.config.stream,
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        presence_penalty: modelConfig.presence_penalty,
        frequency_penalty: modelConfig.frequency_penalty,
        top_p: modelConfig.top_p,
        max_tokens: Math.max(modelConfig.max_tokens, 4096),
      };
    } else {
      const messages: ChatOptions["messages"] = [];
      for (const v of options.messages) {
        if (!(isO1 && v.role === "system"))
          messages.push({ role: v.role, content: v.content });
      }
      requestPayload = {
        messages,
        stream: !isO1 ? options.config.stream : false,
        model: modelConfig.model,
        temperature: !isO1 ? modelConfig.temperature : 1,
        presence_penalty: !isO1 ? modelConfig.presence_penalty : 0,
        frequency_penalty: !isO1 ? modelConfig.frequency_penalty : 0,
        top_p: !isO1 ? modelConfig.top_p : 1,
      };
    }
    console.log("[Request] openai payload: ", requestPayload);

    const shouldStream =
      !!options.config.stream &&
      modelConfig.model.indexOf("dall-e") < 0 &&
      !isO1;
    const controller = new AbortController();
    options.onController?.(controller);

    try {
      let chatPath = "";
      if (modelConfig.model.indexOf("dall-e") >= 0) {
        chatPath = this.path(OpenaiPath.DallePath);
      } else {
        chatPath = this.path(OpenaiPath.ChatPath);
      }
      const chatPayload = {
        method: "POST",
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
        headers: getHeaders(),
      };

      // make a fetch request
      const requestTimeoutId = setTimeout(
        () => controller.abort(),
        modelConfig.model.indexOf("dall-e") > 0 || isO1
          ? REQUEST_TIMEOUT_MS * 4
          : REQUEST_TIMEOUT_MS,
      );

      if (shouldStream) {
        let responseText = "";
        let remainText = "";
        let finished = false;

        // animate response to make it looks smooth
        function animateResponseText() {
          if (finished || controller.signal.aborted) {
            responseText += remainText;
            console.log("[Response Animation] finished");
            return;
          }

          if (remainText.length > 0) {
            const fetchCount = Math.max(1, Math.round(remainText.length / 60));
            const fetchText = remainText.slice(0, fetchCount);
            responseText += fetchText;
            remainText = remainText.slice(fetchCount);
            options.onUpdate?.(responseText, fetchText);
          }

          requestAnimationFrame(animateResponseText);
        }

        // start animaion
        animateResponseText();

        const finish = () => {
          if (!finished) {
            finished = true;
            options.onFinish(responseText + remainText);
          }
        };

        controller.signal.onabort = finish;

        fetchEventSource(chatPath, {
          ...chatPayload,
          async onopen(res) {
            clearTimeout(requestTimeoutId);
            const contentType = res.headers.get("content-type");
            console.log(
              "[OpenAI] request response content type: ",
              contentType,
            );

            if (contentType?.startsWith("text/plain")) {
              responseText = await res.clone().text();
              return finish();
            }

            if (
              !res.ok ||
              !res.headers
                .get("content-type")
                ?.startsWith(EventStreamContentType) ||
              res.status !== 200
            ) {
              const responseTexts = [responseText];
              let extraInfo = await res.clone().text();
              try {
                const resJson = await res.clone().json();
                extraInfo = prettyObject(resJson);
              } catch {}

              if (res.status === 401) {
                responseTexts.push(Locale.Error.Unauthorized);
              }

              if (extraInfo) {
                responseTexts.push(extraInfo);
              }

              responseText = responseTexts.join("\n\n");

              return finish();
            }
          },
          onmessage(msg) {
            if (msg.data === "[DONE]" || finished) {
              return finish();
            }
            const text = msg.data;
            try {
              const json = JSON.parse(text) as {
                choices: Array<{
                  delta: {
                    content: string;
                  };
                }>;
              };
              const delta = json.choices[0]?.delta?.content;
              if (delta) {
                remainText += delta;
              }
            } catch (e) {
              console.error("[Request] parse error", text);
            }
          },
          onclose() {
            finish();
          },
          onerror(e) {
            options.onError?.(e);
            throw e;
          },
          openWhenHidden: true,
        });
      } else {
        const res = await fetch(chatPath, chatPayload);
        clearTimeout(requestTimeoutId);

        if (res.status == 401) {
          throw new Error(Locale.Error.Unauthorized);
        }
        const resJson = await res.json();
        const message = this.extractMessage(resJson, modelConfig.model);
        options.onFinish(message);
      }
    } catch (e) {
      console.log("[Request] failed to make a chat request", e);
      options.onError?.(e as Error);
    }
  }
  async usage() {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
        .getDate()
        .toString()
        .padStart(2, "0")}`;
    const ONE_DAY = 1 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDate = formatDate(startOfMonth);
    const endDate = formatDate(new Date(Date.now() + ONE_DAY));

    const [used, subs] = await Promise.all([
      fetch(
        this.path(
          `${OpenaiPath.UsagePath}?start_date=${startDate}&end_date=${endDate}`,
        ),
        {
          method: "GET",
          headers: getHeaders(),
        },
      ),
      fetch(this.path(OpenaiPath.SubsPath), {
        method: "GET",
        headers: getHeaders(),
      }),
    ]);

    if (used.status === 401) {
      throw new Error(Locale.Error.Unauthorized);
    }

    if (!used.ok || !subs.ok) {
      throw new Error("Failed to query usage from openai");
    }

    const response = (await used.json()) as {
      total_usage?: number;
      error?: {
        type: string;
        message: string;
      };
    };

    const total = (await subs.json()) as {
      hard_limit_usd?: number;
    };

    if (response.error && response.error.type) {
      throw Error(response.error.message);
    }

    if (response.total_usage) {
      response.total_usage = Math.round(response.total_usage) / 100;
    }

    if (total.hard_limit_usd) {
      total.hard_limit_usd = Math.round(total.hard_limit_usd * 100) / 100;
    }

    return {
      used: response.total_usage,
      total: total.hard_limit_usd,
    } as LLMUsage;
  }

  async models(): Promise<LLMModel[]> {
    if (this.disableListModels) {
      return DEFAULT_MODELS.slice();
    }

    const res = await fetch(this.path(OpenaiPath.ListModelPath), {
      method: "GET",
      headers: {
        ...getHeaders(),
      },
    });

    const resJson = (await res.json()) as OpenAIListModelResponse;
    const chatModels = resJson.data?.filter((m) => m.id.startsWith("gpt-"));
    console.log("[Models]", chatModels);

    if (!chatModels) {
      return [];
    }

    return chatModels.map((m) => ({
      name: m.id,
      available: true,
    }));
  }
}
export { OpenaiPath };
