const { seedWorkspace } = require('./utils/store')
const { CLOUD_ENV_ID, MOCK_MODE } = require('./utils/config')
const api = require('./utils/api')

// #region agent log
function debugLog(hypothesisId, message, data) {
  const payload = JSON.stringify({
    sessionId: '141e8c',
    runId: 'pre-fix',
    hypothesisId,
    location: 'app.js:onLaunch',
    message,
    data,
    timestamp: Date.now()
  })
  if (typeof wx !== 'undefined' && wx.request) {
    wx.request({
      url: 'http://127.0.0.1:7580/ingest/9734d264-dd0e-44d5-bdc5-e045ca344e21',
      method: 'POST',
      header: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '141e8c' },
      data: payload,
      fail: () => {}
    })
  }
  console.info('[orbit-debug]', hypothesisId, message, data || {})
}
// #endregion

App({
  globalData: {
    mockMode: MOCK_MODE,
    cloudEnvId: CLOUD_ENV_ID,
    networkAvailable: true,
    user: {
      id: 'demo-user',
      nickname: 'Orbit 用户'
    }
  },

  onLaunch() {
    // #region agent log
    debugLog('A', 'onLaunch start', { mockMode: MOCK_MODE, cloudEnvId: CLOUD_ENV_ID })
    // #endregion
    if (MOCK_MODE) {
      seedWorkspace()
      // #region agent log
      debugLog('E', 'mock mode seeded', {})
      // #endregion
      return
    }
    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
      // #region agent log
      debugLog('A', 'wx.cloud.init ok', { env: CLOUD_ENV_ID })
      // #endregion
    } catch (error) {
      // #region agent log
      debugLog('A', 'wx.cloud.init failed', { message: error && error.message })
      // #endregion
      console.warn('wx.cloud.init failed', error)
    }
    wx.login({
      success: () => api.bootstrapUser()
        .then(result => {
          // #region agent log
          debugLog('A', 'authBootstrap ok', { hasUser: Boolean(result && result.id) })
          // #endregion
        })
        .catch(error => {
          // #region agent log
          debugLog('A', 'authBootstrap failed', { code: error.code, requestId: error.requestId })
          // #endregion
          console.warn('authBootstrap failed', error.code, error.requestId)
        })
    })
    wx.getNetworkType({
      success: res => {
        this.globalData.networkAvailable = res.networkType !== 'none'
        // #region agent log
        debugLog('D', 'network type', { networkType: res.networkType })
        // #endregion
      }
    })
    wx.onNetworkStatusChange(res => {
      this.globalData.networkAvailable = res.isConnected
    })
    // #region agent log
    debugLog('B', 'onLaunch complete', {})
    // #endregion
  },

  onError(error) {
    // #region agent log
    if (!this._debugErrorLogged) {
      this._debugErrorLogged = true
      debugLog('C', 'app onError', { error: String(error) })
    }
    // #endregion
    console.error('App onError', error)
  }
})
