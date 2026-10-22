class HttpClient {
  constructor(baseURL = null, appId = null, authorization = null) {
    this._baseURL = baseURL;
    this._appId = appId;
    this._authorization = authorization;
  }

  // Getter function for baseURL
  get baseURL() {
    return this._baseURL;
  }

  // Setter function for baseURL
  set baseURL(value) {
    this._baseURL = value;
  }

  // Getter function for appId
  get appId() {
    return this._appId;
  }

  // Setter function for appId
  set appId(value) {
    this._appId = value;
  }

  // Getter function for authorization
  get authorization() {
    return this._authorization;
  }

  // Setter function for authorization
  set authorization(value) {
    this._authorization = value;
  }

  makeRequest(method, url, data, headers) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fullURL = this._baseURL ? this._baseURL + url : url;
      xhr.open(method, fullURL, true);
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          xhr.setRequestHeader(key, value);
        }
      }
      if (this._appId) {
        xhr.setRequestHeader("Qiscus-App-Id", this._appId);
      }
      if (this._authorization) {
        xhr.setRequestHeader("X-Authorization", this._authorization);
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error("Request failed"));
          }
        }
      };
      xhr.onerror = function () {
        reject(new Error("Request failed"));
      };

      if (method === "POST" && data instanceof FormData) {
        xhr.send(data);
      } else {
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(data ? JSON.stringify(data) : null);
      }
    });
  }

  get(url, headers = {}) {
    return this.makeRequest("GET", url, null, headers);
  }

  post(url, data, headers = {}) {
    return this.makeRequest("POST", url, data, headers);
  }

  put(url, data, headers = {}) {
    return this.makeRequest("PUT", url, data, headers);
  }

  delete(url, headers = {}) {
    return this.makeRequest("DELETE", url, null, headers);
  }

  isRegistered() {
    return this.makeRequest("GET", "/api/v1/apps/is-registered", null, {});
  }

  isValid() {
    return this.makeRequest("GET", "/api/v1/apps/is-valid", null, {});
  }

  usageMonthly() {
    return this.makeRequest(
      "GET",
      "/api/v1/apps/usage-current-month",
      null,
      {}
    );
  }

  getConversation(room_id, limit) {
    return this.makeRequest(
      "GET",
      `/api/v1/qiscus/get-conversations?room_id=${room_id}&limit=${limit}`,
      null,
      {}
    );
  }

  getSummarize(room_id) {
    return this.makeRequest(
      "GET",
      `/api/v1/qiscus/summarize?room_id=${room_id}`,
      null,
      {}
    );
  }

  usageAnnually() {
    return this.makeRequest("GET", "/api/v1/apps/last-one-year", null, {});
  }

  profile() {
    return this.makeRequest("GET", "/api/v1/apps/profile", null, {});
  }

  registerToken(data) {
    return this.makeRequest(
      "POST",
      "/api/v1/apps/register-chat-gpt-token",
      data,
      {}
    );
  }

  setSummarize(data) {
    return this.makeRequest("POST", "/api/v1/qiscus/summarize", data, {});
  }

  paraphrase(data) {
    return this.makeRequest(
      "POST",
      "/api/v1/chat-gpt/paraphrase",
      { data: data },
      {}
    );
  }

  generateSummarize(data) {
    return this.makeRequest("POST", "/api/v1/chat-gpt/get-summarize", data, {});
  }

  completions(data) {
    return this.makeRequest(
      "POST",
      "/api/v1/chat-gpt/get-completions",
      data,
      {}
    );
  }

  pekaBgt(question, history, channel_id) {
    return this.makeRequest(
      "POST",
      "/api/v1/embeddings/generate-ideas",
      { questions: question, chat_history: history, channel_id: channel_id },
      {}
    );
  }

  paraphraseLonger(data) {
    return this.makeRequest(
      "POST",
      "/api/v1/chat-gpt/paraphrase-longer",
      { data: data },
      {}
    );
  }

  paraphraseShorter(data) {
    return this.makeRequest(
      "POST",
      "/api/v1/chat-gpt/paraphrase-shorter",
      { data: data },
      {}
    );
  }

  getLanguages() {
    return this.makeRequest("GET", "/api/v1/languages/", null, {});
  }

  translationText(data) {
    const { lang, text } = data
    return this.makeRequest(
      "POST",
      `/api/v1/chat-gpt/get-translation/${lang}`,
      { data: text },
      {}
    );
  }
}

export default HttpClient;
