class QENV {
  constructor(appUrl = null, authToken = null) {
    this._appUrl = appUrl;
    this._authToken = authToken;
  }

  set appUrl(value) {
    this._appUrl = value;
  }
  set authToken(value) {
    this._authToken = value;
  }
}

export default QENV;
