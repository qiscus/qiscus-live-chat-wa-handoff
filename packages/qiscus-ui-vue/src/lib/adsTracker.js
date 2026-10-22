/* eslint-disable */
class AdsTracker {
  constructor(baseUrl = null, appId = null, authorization = null) {
    this._baseUrl = baseUrl;
    this._appId = appId;
    this._authorization = authorization;
  }

  set baseUrl(value) {
    this._baseUrl = value;
  }
  set appId(value) {
    this._appId = value;
  }
  set authorization(value) {
    this._authorization = value;
  }

  http(method, url, data, headers) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const fullURL = this._baseUrl ? this._baseUrl + url : url;
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

  isRegistered() {
    return this.http("GET", "/api/v1/apps/is-registered" + "?app_code=" + this._appId, null, {});
  }
  getListAds(roomId) {
    return this.http("GET", "/api/v1/conversions/rooms-ads/" + roomId, null, {});
  }
  getlistEvent() {
    return this.http("GET", "/api/v1/conversions/events", null, {});
  }
  convert({ eventName, agentName, conversionId, price = null, currency = null }) {
    const payload = {
      name: eventName,
      agent_name: agentName,
      conversion_id: conversionId,
    };
    if (price !== null && currency) {
      payload['price'] = price;
      payload['currency'] = currency;
    }
    return this.http("POST", "/api/v1/conversions/convert", payload, {});
  }
}

export default AdsTracker;
