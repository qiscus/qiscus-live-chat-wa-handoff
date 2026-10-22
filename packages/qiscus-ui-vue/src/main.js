// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';
import Toasted from 'vue-toasted';
import QiscusWidget from './App';
import QiscusCore from './lib/SDKCore';
import HttpClient from './lib/aiAssistant';
import AdsTracker from './lib/adsTracker';
import QENV from './lib/qenv';
import { maskSystemEventAgentName } from './helpers/systemEventMask';

const aiAssistant = new HttpClient();
const adsTracker = new AdsTracker();
const qenv = new QENV();
if (typeof window !== 'undefined') {
  window.aiAssistant = aiAssistant;
  window.adsTracker = adsTracker;
  window.qenv = qenv;
  // Expose the system-event masker so the legacy inbox blade (which is not part
  // of this bundle) can reuse the exact same logic for the room-list last-message
  // preview — getLastComment() in inbox.blade.php / supervisor/inbox.blade.php.
  // Keeps a single source of truth instead of a third copy of the regex.
  window.maskSystemEventAgentName = maskSystemEventAgentName;
}

Vue.use(Toasted, {
  position: 'bottom-right',
  duration: 3000,
  theme: 'bubble',
});
Vue.config.productionTip = false;
Vue.prototype.$core = QiscusCore;

function renderSDK() {
  /* eslint-disable no-new */
  new Vue({
    render(h) {
      return h(QiscusWidget);
    },
  }).$mount('#qiscus-widget');
}

export default {
  render: renderSDK,
  core: QiscusCore,
};
