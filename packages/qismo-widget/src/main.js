import App from './App.svelte';

class Qismo {
	constructor(AppId, params = {}) {
		if(!AppId) throw new Error('Multichannel AppId is required');
		this.appId = AppId;
		this.staging = params.staging;
		this.options = params.options;
		this.baseUrl = 'https://multichannel.qiscus.com';
		this.mobileBreakPoint = 500;
		this.onLoginSuccess = params.onLoginSuccess ? params.onLoginSuccess : () => {};
		this.onLoginError = params.onLoginError ? params.onLoginError : () => {};
		this.onRoomChanged = params.onRoomChanged ? params.onRoomChanged : () => {};
		this.onHeaderClicked = params.onHeaderClicked ? params.onHeaderClicked : () => {};
		this.onNewMessages = params.onNewMessages ? params.onNewMessages : () => {};
		this.onMinimize = params.onMinimize ? params.onMinimize : () => {};
		this.onMaximize = params.onMaximize ? params.onMaximize : () => {};
		if(params.options) {
			if(params.options.qismoIframeUrl) this.baseUrl = params.options.qismoIframeUrl;
			if(params.options.mobileBreakPoint) this.mobileBreakPoint = params.options.mobileBreakPoint;
			if(params.options.widgetDesktopSizes) this.widgetDesktopSizes = params.options.widgetDesktopSizes;
			if(params.options.extra_fields) this.extra_fields = params.options.extra_fields;
		}
		this.appendCSS(params.options);
		this.render();
		this.bindEvent(window, 'message', (e) => {
			if(!e.data) return;
			if(e.data.event_name == 'login-success' && this.onLoginSuccess) {
				// let's render the CSS, hotfix for custom css race condition
				this.widget.attachCustomCSS();
				// trigger the loginSuccessCallback
				this.onLoginSuccess(e.data.data);
			}
			if(e.data.event_name == 'login-error' && this.onLoginError) this.onLoginError(e.data.data);
			if(e.data.event_name == 'room-changed' && this.onRoomChanged) this.onRoomChanged(e.data.data);
			if(e.data.event_name == 'new-messages' && this.onNewMessages) this.onNewMessages(e.data.data);
			if(e.data.event_name == 'typing' && this.onTyping) this.onTyping(e.data.data);
			if(e.data.event_name == 'header-clicked' && this.onHeaderClicked) this.onHeaderClicked();
			if(e.data.event_name == 'close-welcome-iframe') this.widget.openNextIframe();
			if(e.data.event_name == 'close-welcome-message') this.widget.closeWelcomeMessage();
			if(e.data.event_name == 'close-attention-grabber') this.widget.closeAttentionGrabber();
			if(e.data.event_name == 'close-login-form') this.widget.toggleLoginForm();
			if(e.data.event_name == 'close-channel-form') this.widget.openPreviousIframe();
			if(e.data.event_name == 'open-next-form') this.widget.openNextForm();
			if(e.data.event_name == 'open-previous-form') this.widget.openPreviousForm();
			if(e.data.event_name == 'minimize-widget') this.onMinimize();
			if(e.data.event_name == 'maximize-widget') this.onMaximize();
			if (e.data.event_name == 'iframe-height-change') {
				if (document.getElementById("qcw-welcome-iframe")) {
					document.getElementById("qcw-welcome-iframe").style.height = e.data.height + "px";
					this.widget.welcomeMessageSizes[1] = e.data.height;
				}
			}
			if (e.data.event_name == "toggle-widget") this.widget.toggleWidget();
			if(e.data.event_name == 'login') this.widget.login({
				display_name: e.data.display_name,
				unique_id: e.data.unique_id,
				extra_fields: e.data.extra_fields,
			});
			if (e.data.event_name == 'finish-load-form') {
				// this.widget.finishLoadForm();
			}
		});
	}
	appendCSS(options) {
		const css = document.createElement('link');
		css.setAttribute('rel', 'stylesheet');
		css.setAttribute('href', `https://qiscus-sdk.s3-ap-southeast-1.amazonaws.com/public/qismo/qismo-v5.css`);
		if (options.qismoIframeUrl) css.setAttribute('href', options.qismoIframeUrl+`/css/qismo-v5.css`);
		document.head.appendChild(css);
	}
	// addEventListener support for IE8
	bindEvent(element, eventName, eventHandler) {
		if (element.addEventListener){
			element.addEventListener(eventName, eventHandler, false);
		} else if (element.attachEvent) {
			element.attachEvent('on' + eventName, eventHandler);
		}
	}
	log(param, output) {
		if(this.params.verbose) console.log(`=== Qiscus ==> ${param}`, output || '');
	}
	chatTarget(target) {
		return this.core.chatTarget(target);
	}
	sendMessage(msg) {
		// Make sure you are sending a string, and to stringify JSON
		document.getElementById('qcw-iframe').contentWindow.postMessage(msg, '*');
	};
	logout() {
		localStorage.clear();
		this.widget.isLogin = false;
		this.widget.isLoginFormOpened = false;
		this.widget.isWidgetOpened = false;
		this.widget.isChannelFormOpened = false;
	}
	render() {
		// check if we have an element to latch into
		const el = document.getElementById('qismo-widget');
		if(!el) document.body.insertAdjacentHTML('beforeend', '<div id="qismo-widget"></div>');
		const props = {
			appId: this.appId,
			staging: this.staging,
			options: this.options,
		};
		if(this.widgetDesktopSizes) props.widgetDesktopSizes = this.widgetDesktopSizes;
		this.widget = new App({
			target: document.getElementById('qismo-widget'),
			props
		});
	}
}

export default Qismo;